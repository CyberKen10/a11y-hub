#!/usr/bin/env node
/**
 * Evaluación de recuperación RAG (hit-rate@k).
 *
 * Uso:
 *   node scripts/eval-rag.mjs
 *
 * Requiere en el entorno (o .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 *
 * Ejecútalo antes y después de cambiar el modelo de embeddings, el chunking
 * o la función hybrid_search para detectar regresiones de calidad.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Carga simple de .env.local si existe.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
  console.error(
    "Faltan variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY u OPENAI_API_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function embed(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI embeddings falló: ${response.status}`);
  }
  const data = await response.json();
  return data.data[0].embedding;
}

const evalFile = JSON.parse(readFileSync("evals/rag-eval.json", "utf-8"));
const topK = evalFile.top_k ?? 8;

let hits = 0;
const results = [];

for (const testCase of evalFile.cases) {
  const embedding = await embed(testCase.question);
  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: testCase.question,
    query_embedding: JSON.stringify(embedding),
    match_count: topK,
    filter_type_slugs: null,
  });
  if (error) {
    console.error(`RPC falló para "${testCase.question}": ${error.message}`);
    continue;
  }
  const titles = (data ?? []).map((r) => r.item_title.toLowerCase());
  const hit = titles.some((t) =>
    t.includes(testCase.expected_title_contains.toLowerCase())
  );
  if (hit) hits++;
  results.push({ question: testCase.question, hit, topTitles: titles.slice(0, 3) });
}

console.log("\n=== Evaluación RAG (hit-rate@" + topK + ") ===\n");
for (const r of results) {
  console.log(`${r.hit ? "✅" : "❌"} ${r.question}`);
  console.log(`   Top: ${r.topTitles.join(" | ") || "(sin resultados)"}\n`);
}
const total = evalFile.cases.length;
console.log(`Resultado: ${hits}/${total} (${Math.round((hits / total) * 100)}%)`);
process.exit(hits === total ? 0 : 1);
