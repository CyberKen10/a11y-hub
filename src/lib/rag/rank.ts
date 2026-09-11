import type { ApprovalState } from "@/lib/approaches";

export const CHAT_TOP_DOCS = 3;

const APPROVAL_BOOST = 0.2;
const DISCARDED_PENALTY = 0.3;

/** Nudges approved approaches up, unless the question asks for pending ones. */
export function applyApprovalBoost<T extends { item_id: string; score: number }>(
  rows: T[],
  stateById: Map<string, ApprovalState>,
  preferPending: boolean
): T[] {
  return rows.map((row) => {
    const state = stateById.get(row.item_id);
    let delta = 0;
    if (preferPending) {
      if (state === "pending") delta = APPROVAL_BOOST;
    } else if (state === "approved") {
      delta = APPROVAL_BOOST;
    } else if (state === "discarded") {
      delta = -DISCARDED_PENALTY;
    }
    return delta === 0 ? row : { ...row, score: row.score + delta };
  });
}

/** Keeps the best-scoring row per document, then the top `limit` docs. */
export function topDocumentsByScore<T extends { item_id: string; score: number }>(
  rows: T[],
  limit = CHAT_TOP_DOCS
): T[] {
  const ranked = [...rows].sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const picked: T[] = [];
  for (const row of ranked) {
    if (seen.has(row.item_id)) continue;
    seen.add(row.item_id);
    picked.push(row);
    if (picked.length >= limit) break;
  }
  return picked;
}
