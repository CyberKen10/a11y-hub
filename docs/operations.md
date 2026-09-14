# Operación

## Roles

| Rol | Puede |
| --- | --- |
| Lector | Ver contenido publicado, usar el chat, dar feedback. |
| Editor | Además: crear/editar/publicar/archivar contenido, subir adjuntos, usar **Añadir**. |
| Administrador | Además: importar Excel o Sheet, panel de sincronización, usuarios/roles, auditoría, eliminar. |

Las cuentas se crean en **Supabase → Authentication → Users → Add user** (Auto Confirm). El primer usuario recibe rol admin; el resto entra como lector y un admin le sube el rol en **Administración → Usuarios**. Desactiva **Allow new users to sign up** en Authentication → Providers → Email para que nadie se dé de alta solo.

## Importar conocimiento

1. **Excel:** Administración → Importar conocimiento → sube un .xlsx desde el PC.
2. **Google Sheet:** pega el enlace. Comparte el Sheet con la cuenta de servicio como Lector (`GOOGLE_SERVICE_ACCOUNT_EMAIL`).
3. Tras cargar, procesa los pendientes en **Administración → Sincronización** para que el chat encuentre el contenido.

## Sincronización

- Cada publicación o importación deja trabajos de `reindex` (chat). Si fallan, el dato en el hub no se pierde; se reintenta desde el panel (máx. 5 intentos).
- El dashboard avisa cuando hay indexaciones fallidas.

## Costes de IA

El default es **Gemini (Google AI Studio), capa gratuita**: chat (`gemini-3.6-flash`; `gemini-2.5-flash` ya no admite claves nuevas), embeddings (`gemini-embedding-001`), dictado (audio al mismo modelo) y TTS (`gemini-3.1-flash-tts-preview`). No hay factura. Hay cupos diarios (aprox. 15 req/min y ~1.500/día en Flash).

OpenAI es opcional (`AI_PROVIDER=openai`). Si cambias de proveedor, reindexa todo: los embeddings no son intercambiables. Compara `npm run eval:rag` antes y después.

## Mantenimiento

- **Reindexar un elemento**: vuelve a publicarlo, o reintenta su job `reindex` en el panel.
- **Backups**: usa los backups automáticos de Supabase.
- **Evaluación RAG**: mantén `evals/rag-eval.json` con ~10–20 preguntas reales del equipo y ejecútalo en cada cambio del pipeline.
- **Auditoría**: Administración → Auditoría registra creaciones, ediciones, cambios de rol, importaciones y borrados.
