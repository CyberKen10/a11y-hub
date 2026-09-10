# Operación

## Roles

| Rol | Puede |
| --- | --- |
| Lector | Ver contenido publicado, usar el chat, dar feedback. |
| Editor | Además: crear/editar/publicar/archivar contenido, subir adjuntos, usar "Añadir con IA". |
| Administrador | Además: importar de Sheets, panel de sincronización, usuarios/roles, auditoría, eliminar. |

El primer usuario registrado se convierte en admin automáticamente. Los siguientes entran como lectores y un admin les sube el rol en **Administración → Usuarios**.

Para restringir el alta a tu dominio corporativo define `ALLOWED_EMAIL_DOMAINS=tuempresa.com`.

## Importación de Approaches (Excel Wiki)

1. Coloca `docs/Wiki - Approaches .xlsx` en el repo (ya está).
2. Con las claves de Supabase en `.env.local`, ejecuta `npm run seed:approaches`, o en la app **Administración → Importar conocimiento → Cargar Wiki Approaches**.
3. Es idempotente por ID de wiki / fila. Tras cargar, procesa los trabajos `reindex` en **Administración → Sincronización** para que el chat encuentre el contenido.

## Importación desde Google Sheets (otras pestañas)

1. **Administración → Importar desde Sheets** → conectar → elegir pestaña.
2. Mapear columnas: título (obligatorio), resumen, contenido y tags (opcionales). El resto de columnas se conservan como campos del elemento (mismo dato que el Sheet).
3. Elegir apartado de destino y si se publica directamente.
4. Ejecutar. Es idempotente: puedes repetir la importación tras editar el Sheet y solo se procesan filas nuevas o cambiadas.

Tras importar, la indexación y el espejo quedan como trabajos en lotes: procesa los pendientes en **Administración → Sincronización**.

## Sincronización y fallos

- Cada publicación dispara `reindex` (chat) y `sheet_mirror` (Sheets). Si algo falla (p. ej. cuota de Google), **el dato en la base de datos nunca se pierde**; el trabajo queda `failed` y se reintenta desde el panel (máx. 5 intentos por trabajo).
- El dashboard avisa a los admins cuando hay sincronizaciones fallidas.
- El espejo vive en pestañas `Hub · <tipo>` del spreadsheet. No edites esas pestañas a mano: se sobrescriben en la siguiente sincronización. La fuente oficial es la plataforma.

## Costes de IA

El default es **Gemini (Google AI Studio), capa gratuita**: chat (`gemini-3.6-flash`; `gemini-2.5-flash` ya no admite claves nuevas), embeddings (`gemini-embedding-001`), dictado (audio al mismo modelo) y TTS (`gemini-3.1-flash-tts-preview`). No hay factura. Hay cupos diarios (aprox. 15 req/min y ~1.500/día en Flash).

OpenAI es opcional (`AI_PROVIDER=openai`). Si cambias de proveedor, reindexa todo: los embeddings no son intercambiables. Compara `npm run eval:rag` antes y después.

## Mantenimiento

- **Reindexar un elemento**: vuelve a publicarlo, o reintenta su job `reindex` en el panel.
- **Backups**: usa los backups automáticos de Supabase; el Sheet espejo sirve como copia legible extra.
- **Evaluación RAG**: mantén `evals/rag-eval.json` con ~10–20 preguntas reales del equipo y ejecútalo en cada cambio del pipeline.
- **Auditoría**: Administración → Auditoría registra creaciones, ediciones, cambios de rol, importaciones y borrados.
