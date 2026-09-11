import { formatWcagLine } from "@/lib/wcag";

export type ApprovalState = "approved" | "pending" | "discarded";

export interface HubApproval {
  approved_by_id: string;
  approved_by_name: string;
  approved_by_email: string;
  approved_at: string;
}

export interface Approver {
  name: string;
  source: "wiki" | "hub";
  id?: string;
  email?: string;
  at?: string;
}

export const COMPANY_FIELDS = [
  { key: "Team", label: "Team" },
  { key: "UTest", label: "UTest" },
  { key: "Crownspeak", label: "Crownspeak" },
  { key: "Barcelo", label: "Barcelo" },
  { key: "Pros.", label: "Pros." },
] as const;

/** Excel headers shown as a visible ficha, in sheet order. */
export const WIKI_FICHA_FIELDS = [
  { key: "wiki_id", label: "ID" },
  { key: "Status", label: "Status wiki" },
  { key: "CP", label: "SC WCAG" },
  { key: "Bug Type", label: "Bug Type" },
  { key: "Platform", label: "Platform" },
  ...COMPANY_FIELDS,
  { key: "Comments", label: "Comments" },
  { key: "Reference link", label: "Reference link" },
  { key: "Origen", label: "Pestaña wiki" },
] as const;

/** Keys stored for hub logic; not dumped as generic metadata. */
export const INTERNAL_META_KEYS = [
  "approval_state",
  "hub_approval",
  "hub_approvals",
  "wiki_reviewers",
  "wcag_scs",
] as const;

/** “Más de 4 personas”: se marca Aprobado al llegar a 5 votos distintos. */
export const APPROVAL_QUORUM = 5;

export const APPROVAL_LABEL: Record<ApprovalState, string> = {
  approved: "Aprobado",
  pending: "Sin aprobar",
  discarded: "Descartado",
};

export function isInternalMetaKey(key: string): boolean {
  return (INTERNAL_META_KEYS as readonly string[]).includes(key);
}

export function isDiscardedWikiStatus(status: unknown): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  return s === "discarded" || s === "rejected" || s === "obsolete";
}

function normName(value: string): string {
  return value.trim().toLowerCase();
}

export function asHubApproval(value: unknown): HubApproval | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.approved_by_id !== "string" || !rec.approved_by_id) return null;
  return {
    approved_by_id: rec.approved_by_id,
    approved_by_name: String(rec.approved_by_name ?? rec.approved_by_email ?? ""),
    approved_by_email: String(rec.approved_by_email ?? ""),
    approved_at: String(rec.approved_at ?? ""),
  };
}

export function listHubApprovals(
  metadata: Record<string, unknown> | null | undefined
): HubApproval[] {
  const seen = new Set<string>();
  const list: HubApproval[] = [];
  const push = (raw: unknown) => {
    const item = asHubApproval(raw);
    if (!item || seen.has(item.approved_by_id)) return;
    seen.add(item.approved_by_id);
    list.push(item);
  };
  if (Array.isArray(metadata?.hub_approvals)) {
    for (const row of metadata.hub_approvals) push(row);
  }
  push(metadata?.hub_approval);
  return list;
}

export function getWikiReviewers(
  metadata: Record<string, unknown> | null | undefined
): string[] {
  const listed = metadata?.wiki_reviewers;
  if (Array.isArray(listed)) {
    return listed.map((n) => String(n).trim()).filter(Boolean);
  }
  return [];
}

/** Unique people who already approved (wiki votes + hub users). */
export function listApprovers(
  metadata: Record<string, unknown> | null | undefined
): Approver[] {
  const seen = new Set<string>();
  const approvers: Approver[] = [];

  for (const hub of listHubApprovals(metadata)) {
    const key = normName(hub.approved_by_name || hub.approved_by_email);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    approvers.push({
      name: hub.approved_by_name || hub.approved_by_email,
      source: "hub",
      id: hub.approved_by_id,
      email: hub.approved_by_email,
      at: hub.approved_at,
    });
  }

  for (const name of getWikiReviewers(metadata)) {
    const key = normName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    approvers.push({ name, source: "wiki" });
  }

  return approvers;
}

export function getApproverCount(
  metadata: Record<string, unknown> | null | undefined
): number {
  return listApprovers(metadata).length;
}

export function userAlreadyApproved(
  metadata: Record<string, unknown> | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  return listHubApprovals(metadata).some((row) => row.approved_by_id === userId);
}

export function getApprovalState(
  metadata: Record<string, unknown> | null | undefined
): ApprovalState {
  if (isDiscardedWikiStatus(metadata?.Status)) return "discarded";
  return getApproverCount(metadata) >= APPROVAL_QUORUM ? "approved" : "pending";
}

export function withComputedApproval(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const hubApprovals = listHubApprovals(metadata);
  return {
    ...metadata,
    hub_approvals: hubApprovals,
    approval_state: getApprovalState({ ...metadata, hub_approvals: hubApprovals }),
  };
}

export function addHubApproval(
  metadata: Record<string, unknown>,
  vote: HubApproval
): Record<string, unknown> {
  const current = listHubApprovals(metadata);
  if (current.some((row) => row.approved_by_id === vote.approved_by_id)) {
    return withComputedApproval({ ...metadata, hub_approvals: current });
  }
  return withComputedApproval({
    ...metadata,
    hub_approvals: [...current, vote],
  });
}

export function looksLikeApproach(
  metadata: Record<string, unknown> | null | undefined,
  typeSlug?: string | null
): boolean {
  if (typeSlug === "approaches") return true;
  if (!metadata) return false;
  return Boolean(
    metadata.wiki_id ||
      metadata.Status ||
      metadata.Team ||
      metadata.UTest ||
      metadata.Crownspeak ||
      metadata.Barcelo
  );
}

export function queryPrefersPending(query: string): boolean {
  return /sin aprobar|no aprob|pendiente|under review|under discussion|descartad/i.test(
    query
  );
}

export function formatApprovalLine(
  metadata: Record<string, unknown> | null | undefined
): string {
  const state = getApprovalState(metadata);
  const approvers = listApprovers(metadata);
  const parts = [
    `Estado: ${APPROVAL_LABEL[state]} (${approvers.length} de ${APPROVAL_QUORUM})`,
  ];
  if (approvers.length > 0) {
    parts.push(`Ya aprobaron: ${approvers.map((a) => a.name).join(", ")}`);
  } else {
    parts.push("Todavía no hay aprobaciones.");
  }
  return parts.join(". ");
}

export function formatCompanyLine(
  metadata: Record<string, unknown> | null | undefined
): string {
  return COMPANY_FIELDS.map(({ key, label }) => {
    const value = metadata?.[key];
    if (value == null || String(value).trim() === "") return null;
    return `${label}: ${String(value)}`;
  })
    .filter(Boolean)
    .join(" · ");
}

export function formatSourceFicha(
  metadata: Record<string, unknown> | null | undefined
): string {
  return [
    formatWcagLine(metadata),
    formatApprovalLine(metadata),
    formatCompanyLine(metadata),
  ]
    .filter(Boolean)
    .join("\n");
}

export function stripInternalMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!isInternalMetaKey(key)) next[key] = value;
  }
  return next;
}

export function mergePreservedApproval(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const current = existing ?? {};
  const next = { ...stripInternalMetadata(incoming) };
  if (Array.isArray(incoming.wiki_reviewers)) {
    next.wiki_reviewers = incoming.wiki_reviewers;
  } else if (Array.isArray(current.wiki_reviewers)) {
    next.wiki_reviewers = current.wiki_reviewers;
  }
  next.hub_approvals = listHubApprovals({
    hub_approvals: current.hub_approvals,
    hub_approval: current.hub_approval,
  });
  return withComputedApproval(next);
}
