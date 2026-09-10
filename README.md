# A11y Hub

Plataforma interna de conocimiento para una empresa de accesibilidad digital:

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
| IA | Vercel AI SDK + OpenAI (chat, embeddings, STT `gpt-4o-transcribe`, TTS `gpt-4o-mini-tts`) |
| Búsqueda | Híbrida: vectorial (HNSW, coseno) + full-text de Postgres, fusionadas con RRF |
| Integración | Google Sheets API (cuenta de servicio) |

## Puesta en marcha

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta la migración [`supabase/migrations/20260910000000_init.sql`](supabase/migrations/20260910000000_init.sql) en el SQL Editor (o `supabase db push` con la CLI).
3. En **Authentication → Providers**, habilita Email. Configura la URL del sitio y la redirect URL `https://<tu-dominio>/auth/confirm`.
4. **La primera cuenta que se registre se convierte automáticamente en administrador.**

### 2. Google Sheets (espejo)

1. Crea una cuenta de servicio en Google Cloud con la API de Sheets habilitada.
2. Comparte el spreadsheet con el correo de la cuenta de servicio (permiso Editor).
3. Copia el correo, la clave privada y el ID del spreadsheet a las variables de entorno.

### 3. Variables de entorno

```bash
cp .env.example .env.local
# rellena Supabase, OpenAI y Google
```

Todas las claves (OpenAI, service role, clave privada de Google) son **solo de servidor** y nunca llegan al navegador.

### 4. Ejecutar

```bash
npm install
npm run dev        # http://localhost:3000
```

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
