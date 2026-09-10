# A11y Hub

Plataforma interna de conocimiento

- **Hub de contenido** organizado por apartados (Approaches, Metodologías, Estándares, Patrones, Herramientas, Casos de estudio, Investigación, Plantillas, Glosario, Recursos).
- **Chat RAG con citas**: pregunta en lenguaje natural (texto o voz) y recibe respuestas basadas únicamente en el conocimiento publicado, con fuentes verificables y lectura en voz alta.
- **Creación asistida por IA**: añade approaches, metodologías, etc. escribiendo un prompt o dictando por voz; la IA propone la estructura y una persona revisa y confirma antes de publicar.
- **Google Sheets como espejo**: la base de datos (Supabase/PostgreSQL) es la fuente de verdad; cada publicación se refleja en pestañas `Hub · <tipo>` del Sheet. La importación inicial lee las pestañas originales sin modificarlas.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4, shadcn/ui (Radix) |
| Backend | Server Actions + Route Handlers de Next.js |
| Base de datos | Supabase (PostgreSQL + pgvector + Auth + Storage + RLS) |
| IA | Vercel AI SDK + **Gemini gratis** (chat, embeddings, dictado y lectura). OpenAI es opcional. |
| Búsqueda | Híbrida: vectorial (HNSW, coseno) + full-text de Postgres, fusionadas con RRF |
| Integración | Google Sheets API (cuenta de servicio) |

## Puesta en marcha (paso a paso, desde cero)

Necesitas 3 cuentas, las tres con capa gratuita: [Supabase](https://supabase.com), [Google AI Studio](https://aistudio.google.com/app/apikey) (Gemini, sin tarjeta) y [Google Cloud](https://console.cloud.google.com) (solo para el Sheet). Tiempo estimado: 30–40 minutos.

### Paso 1 — Crear el proyecto en Supabase (base de datos)

1. Entra en [supabase.com](https://supabase.com) → **Sign in** (puedes usar tu cuenta de GitHub o Google).
2. Pulsa **New project**:
   - **Name**: `a11y-hub` (o el que quieras).
   - **Database password**: genera una y guárdala (no la necesitarás a diario, pero no la pierdas).
   - **Region**: la más cercana a tu equipo.
3. Espera 1–2 minutos a que el proyecto termine de crearse.
4. Ejecuta la migración (crea todas las tablas, la seguridad y los 10 apartados):
   - En el menú lateral de Supabase, abre **SQL Editor** → **New query**.
   - Abre el archivo [`supabase/migrations/20260910000000_init.sql`](supabase/migrations/20260910000000_init.sql) de este proyecto, copia **todo** su contenido y pégalo en el editor.
   - Pulsa **Run** (abajo a la derecha). Debe decir "Success. No rows returned".
5. Copia las 3 claves que necesitarás en el Paso 4:
   - Menú lateral → **Project Settings** (engranaje) → **API Keys**:
     - **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
     - **anon / public key** → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **service_role key** (pulsa "Reveal") → será `SUPABASE_SERVICE_ROLE_KEY`. ⚠️ Esta clave es secreta: no la compartas ni la subas a git.
6. Configura la autenticación:
   - Menú lateral → **Authentication** → **Sign In / Providers**: verifica que **Email** esté habilitado (lo está por defecto).
   - **Authentication** → **URL Configuration**:
     - **Site URL**: `http://localhost:3000` (cámbiala por tu dominio cuando despliegues).
     - **Redirect URLs**: añade `http://localhost:3000/auth/confirm`.

### Paso 2 — Crear la API key de Gemini (gratis)

Esta es la IA del hub: chat, embeddings, dictado y lectura. **No pide tarjeta.**

1. Entra en [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) con tu cuenta de Google.
2. Acepta los términos si te los pide.
3. Pulsa **Create API key** → elige un proyecto de Google Cloud (puedes usar el mismo que el Sheet o crear uno nuevo llamado `a11y-hub`).
4. Copia la clave (empieza por `AIza…`). Será `GOOGLE_GENERATIVE_AI_API_KEY`.

Límites de la capa gratuita (más que suficiente para un equipo interno): del orden de 15 peticiones/minuto y ~1.500 al día en Flash. Fuera de la UE/UK, Google puede usar prompts de la capa gratuita para mejorar sus productos.

Si más adelante quieres OpenAI de pago, pon `AI_PROVIDER=openai` y `OPENAI_API_KEY=sk-…`. No mezcles embeddings: al cambiar de proveedor hay que reindexar.

### Paso 3 — Conectar Google Sheets (cuenta de servicio)

Esto permite importar tu Sheet actual y mantener el espejo automático.

1. Entra en [console.cloud.google.com](https://console.cloud.google.com).
2. Arriba a la izquierda, crea un proyecto nuevo (p. ej. `a11y-hub`) y selecciónalo.
3. Habilita la API: en el buscador superior escribe **"Google Sheets API"** → ábrela → **Enable**.
4. Crea la cuenta de servicio:
   - Menú → **IAM & Admin** → **Service Accounts** → **Create service account**.
   - Nombre: `a11y-hub-sheets` → **Create and continue** → no hace falta asignar roles → **Done**.
5. Genera la clave:
   - Haz clic en la cuenta recién creada → pestaña **Keys** → **Add key** → **Create new key** → tipo **JSON** → se descarga un archivo `.json`.
   - De ese archivo necesitas dos valores: `client_email` (será `GOOGLE_SERVICE_ACCOUNT_EMAIL`) y `private_key` (será `GOOGLE_PRIVATE_KEY`).
6. Comparte tu spreadsheet con la cuenta de servicio:
   - Abre tu Google Sheet → botón **Compartir** → pega el `client_email` (algo como `a11y-hub-sheets@a11y-hub.iam.gserviceaccount.com`) → permiso **Editor** → enviar.
7. Copia el ID del spreadsheet: es la parte larga de la URL, entre `/d/` y `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`ESTE-ES-EL-ID`**`/edit` → será `GOOGLE_SHEET_ID`.

### Paso 4 — Variables de entorno

En la raíz del proyecto:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env.local
```

Abre `.env.local` y rellena cada línea con lo que copiaste:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co        # Paso 1.5
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                      # Paso 1.5
SUPABASE_SERVICE_ROLE_KEY=eyJ...                          # Paso 1.5 (secreta)

AI_PROVIDER=google                                        # gratis por defecto
GOOGLE_GENERATIVE_AI_API_KEY=AIza...                      # Paso 2
# OPENAI_API_KEY=sk-...                                   # solo si cambias a AI_PROVIDER=openai

ALLOWED_EMAIL_DOMAINS=tuempresa.com                       # dominio de correo permitido (vacío = cualquiera)

GOOGLE_SERVICE_ACCOUNT_EMAIL=a11y-hub-sheets@....iam.gserviceaccount.com   # Paso 3.5
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"  # Paso 3.5, en UNA línea con \n
GOOGLE_SHEET_ID=1AbC...                                   # Paso 3.7
```

Notas:
- `GOOGLE_PRIVATE_KEY`: copia el valor de `private_key` del JSON **tal cual**, entre comillas dobles; los `\n` literales son correctos, la app los convierte.
- Los modelos Gemini (`GEMINI_CHAT_MODEL`, etc.) son opcionales; el default es `gemini-2.5-flash`.
- `.env.local` está en `.gitignore`: nunca se sube al repositorio.

### Paso 5 — Arrancar y crear tu cuenta de administrador

```bash
npm install
npm run dev
```

1. Abre [http://localhost:3000](http://localhost:3000) → te redirige al login.
2. Pestaña **Crear cuenta** → registra tu correo (del dominio permitido) y contraseña.
3. Revisa tu bandeja de entrada y pulsa el enlace de confirmación de Supabase.
4. Inicia sesión. **Como eres el primer usuario, ya eres administrador.** Los siguientes entran como lectores y tú les subes el rol en **Administración → Usuarios**.

### Paso 6 — Importar tu Google Sheet

1. En la app: **Administración → Importar desde Sheets** → **Conectar y listar pestañas**.
2. Elige una pestaña → verás una vista previa de las primeras filas.
3. Indica la **fila de encabezados**: si la pestaña tiene un banner o título encima de la tabla, selecciona la fila donde están los nombres reales de las columnas (todo lo anterior se ignora).
4. Mapea las columnas: cuál es el **título** (obligatoria) y, si existen, resumen, contenido y tags. Las columnas sin mapear no se pierden: quedan como campos del elemento y también se indexan para el chat.
5. Elige el **apartado de destino** (p. ej. Approaches) y deja marcado **Publicar directamente**.
6. Pulsa **Importar**. Repite con cada pestaña del Sheet, eligiendo su apartado.
7. Ve a **Administración → Sincronización** y pulsa **Procesar pendientes** hasta que no queden trabajos: eso genera los embeddings (chat) y escribe el espejo en el Sheet.

**Ejemplo concreto: la pestaña "Wiki - Approaches"** (spreadsheet `1Fo30tY…`, ya configurado en `.env.local`):

| Ajuste | Valor |
| --- | --- |
| Fila de encabezados | **2** (la fila 1 es el banner "Nuevo approach agregado!") |
| Título | `Bug Description / Topic` |
| Contenido | `Approach to be followed` |
| Resumen / Tags | — No usar — |
| Apartado de destino | Approaches |

Las demás columnas (`ID`, `Status`, `CP`, `Bug Type`, `Platform`, `Aproach to be followed (Spanish)`, `Team`…) se guardan como campos del elemento, se muestran en su ficha y el chat también las usa. Las filas separadoras tipo "From Crownspeak" se omiten solas porque no tienen título.

### Paso 7 — Probar todo

- **Chat**: entra en *Chat con la información*, pregunta algo de tu contenido; debe responder con citas `[1]` que enlazan a las fichas. Prueba el micrófono y el botón *Escuchar*.
- **Añadir con IA**: botón *Añadir con IA* en la barra superior → dicta o escribe "Quiero añadir un approach nuevo llamado X que consiste en…" → revisa la propuesta → **Confirmar y publicar** → verifica que aparece la fila nueva en la pestaña `Hub · Approaches` de tu Sheet.

### Problemas comunes

| Síntoma | Causa probable |
| --- | --- |
| "Google Sheets no está configurado" | Falta alguna de las 3 variables de Google o la clave privada quedó mal pegada. |
| El espejo falla con error de permisos | No compartiste el Sheet con el `client_email` como Editor. |
| El chat responde "No encuentro esa información" a todo | El contenido no está publicado o faltan trabajos de indexación: procesa pendientes en Sincronización. |
| No llega el correo de confirmación | Revisa spam; en Supabase **Authentication → Logs** puedes ver el envío. |
| Error 401 / "API key" en el chat | Falta `GOOGLE_GENERATIVE_AI_API_KEY` o la clave es inválida. |

## Flujo de datos

1. **Importar**: Administración → Importar desde Sheets. Selecciona pestaña, mapea columnas (título, resumen, contenido, tags) y ejecuta. Es idempotente: reimportar solo procesa filas nuevas o cambiadas (checksum por fila). Las columnas sin mapear se conservan como campos del elemento.
2. **Publicar**: al publicar un elemento (manual, por IA o importado) se hace chunking por encabezados, se generan embeddings y se actualiza el espejo en Sheets. Los fallos quedan como trabajos reintenables en Administración → Sincronización.
3. **Preguntar**: el chat recupera con búsqueda híbrida (RLS aplicado), responde solo con las fuentes y cita cada afirmación `[1]`. Cada respuesta enlaza a los elementos usados y puede leerse en voz alta.
4. **Añadir por voz/prompt**: botón "Añadir con IA" → escribe o dicta → la IA propone tipo, título, resumen, contenido, tags y campos específicos → revisas (con diff "de X a Y" si actualiza uno existente) → confirmas → se guarda, versiona, indexa y espeja.

## Calidad

```bash
npm run test       # unit (chunking, esquemas, indexable)
npm run lint
npm run test:e2e   # Playwright + axe (requiere entorno configurado y `npx playwright install`)
npm run eval:rag   # hit-rate del retrieval con evals/rag-eval.json (ejecutar tras importar contenido real)
```

- Objetivo WCAG 2.2 AA: skip link, navegación completa por teclado, `aria-current`, `role="log"`/`aria-live` en el chat, estados con `role="status"`/`role="alert"`, foco visible, modo claro/oscuro.
- Ejecuta `npm run eval:rag` antes y después de cambiar el modelo de embeddings, el chunking o `hybrid_search`; ajusta los casos de `evals/rag-eval.json` a tu contenido real.

## Documentación

- [`docs/architecture.md`](docs/architecture.md) — arquitectura, modelo de datos, seguridad.
- [`docs/operations.md`](docs/operations.md) — operación diaria: roles, importación, sincronización, costes.
