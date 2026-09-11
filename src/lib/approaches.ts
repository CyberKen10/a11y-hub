import { formatWcagLine } from "@/lib/wcag";
import type { KnowledgeFieldDef } from "@/lib/types";
import {
  BUG_TYPE_OPTIONS,
  COMPANY_STATUS_OPTIONS,
  inferCompanySeverity,
  normalizeApproachMetadata,
  normalizeBugType,
  normalizePlatform,
  PLATFORM_OPTIONS,
} from "@/lib/approach-options";
import { WCAG_SC_SELECT_OPTIONS } from "@/lib/wcag-catalog";

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

/** Fields a person fills when creating/editing an approach (IA + formulario). */
export const APPROACH_COMPOSER_FIELDS: KnowledgeFieldDef[] = [
  {
    key: "CP",
    label: "SC WCAG",
    kind: "multiselect",
    options: WCAG_SC_SELECT_OPTIONS,
    help: "Elige uno o más criterios de éxito WCAG 2.2.",
  },
  {
    key: "when_to_use",
    label: "Cuándo usarlo",
    kind: "textarea",
    help: "Situación en la que aplica este approach.",
  },
  {
    key: "pros",
    label: "Ventajas",
    kind: "list",
    help: "Beneficios de seguir este approach.",
  },
  {
    key: "cons",
    label: "Limitaciones",
    kind: "list",
    help: "Excepciones, riesgos o cuando no aplica.",
  },
  {
    key: "Bug Type",
    label: "Bug Type",
    kind: "select",
    options: [...BUG_TYPE_OPTIONS],
    help: "Tipo de hallazgo, como en la wiki.",
  },
  {
    key: "Platform",
    label: "Platform",
    kind: "select",
    options: [...PLATFORM_OPTIONS],
    help: "Dónde se reproduce el issue.",
  },
  {
    key: "Team",
    label: "Team",
    kind: "select",
    options: [...COMPANY_STATUS_OPTIONS],
    help: "Aplicabilidad y severidad (Low → Critical) para Team.",
  },
  {
    key: "UTest",
    label: "UTest",
    kind: "select",
    options: [...COMPANY_STATUS_OPTIONS],
    help: "Aplicabilidad y severidad (Low → Critical) para UTest.",
  },
  {
    key: "Crownspeak",
    label: "Crownspeak",
    kind: "select",
    options: [...COMPANY_STATUS_OPTIONS],
    help: "Aplicabilidad y severidad (Low → Critical) para Crownspeak.",
  },
  {
    key: "Barcelo",
    label: "Barcelo",
    kind: "select",
    options: [...COMPANY_STATUS_OPTIONS],
    help: "Aplicabilidad y severidad (Low → Critical) para Barcelo.",
  },
  {
    key: "Pros.",
    label: "Pros.",
    kind: "select",
    options: [...COMPANY_STATUS_OPTIONS],
    help: "Aplicabilidad y severidad (Low → Critical) para Pros.",
  },
  {
    key: "Comments",
    label: "Comments",
    kind: "textarea",
    help: "Notas internas de la ficha.",
  },
];

export function composerFieldsFor(
  slug: string,
  typeFields?: KnowledgeFieldDef[] | null
): KnowledgeFieldDef[] {
  if (slug === "approaches") return APPROACH_COMPOSER_FIELDS;
  return typeFields ?? [];
}

export function withAllComposerMetadata(
  slug: string,
  metadata: Record<string, unknown> | null | undefined,
  typeFields?: KnowledgeFieldDef[] | null
): Record<string, string> {
  const next: Record<string, string> = {};
  const raw = metadata ?? {};
  for (const field of composerFieldsFor(slug, typeFields)) {
    const value = raw[field.key];
    next[field.key] =
      value == null ? "" : Array.isArray(value) ? value.map(String).join(", ") : String(value);
  }
  return next;
}

function firstSentence(text: string, max = 220): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^.+?[.!?…](?:\s|$)/);
  const sentence = (match ? match[0] : trimmed).trim();
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

function inferWcagCp(blob: string): string {
  const t = blob.toLowerCase();
  const scs: string[] = [];
  const add = (id: string) => {
    if (!scs.includes(id)) scs.push(id);
  };
  if (/contraste|contrast|4\.5|3:1|color/.test(t)) add("1.4.3");
  if (/\balt\b|imagen|image|figura|svg/.test(t)) add("1.1.1");
  if (/teclado|keyboard|tabulaci[oó]n|\btab\b/.test(t)) add("2.1.1");
  if (/foco|focus|visible/.test(t)) add("2.4.7");
  if (/lector|screen reader|nvda|jaws|voiceover|talkback/.test(t)) add("4.1.2");
  if (/etiqueta|label|nombre accesible|aria-label|4\.1\.2/.test(t)) add("4.1.2");
  if (/encabezado|heading|\bh[1-6]\b/.test(t)) add("1.3.1");
  if (/enlace|link purpose|prop[oó]sito del enlace/.test(t)) add("2.4.4");
  if (/formulario|error|obligatori/.test(t)) {
    add("3.3.1");
    add("3.3.2");
  }
  if (/idioma|lang|language/.test(t)) add("3.1.1");
  if (/subt[ií]tulo|caption|v[ií]deo|audio/.test(t)) add("1.2.2");
  if (scs.length === 0) add("4.1.2");
  return scs.join(", ");
}

function inferBugType(blob: string): string {
  const value = normalizeBugType(blob);
  return BUG_TYPE_OPTIONS.some((o) => o.value === value) ? value : "Other A11y";
}

function inferPlatform(blob: string): string {
  const value = normalizePlatform(blob);
  return PLATFORM_OPTIONS.some((o) => o.value === value) ? value : "Any";
}

function inferCompanyNote(blob: string): string {
  const t = blob.toLowerCase();
  if (/no es un bug|not a bug|falso positivo/.test(t)) return "N/A";
  return inferCompanySeverity(blob);
}

/**
 * Last-resort fill so an approach proposal never ships empty fields.
 * Used after the model runs; prefers whatever the IA already wrote.
 */
export function fillBlankApproachMetadata(
  metadata: Record<string, string>,
  ctx: { title: string; summary: string; content: string }
): Record<string, string> {
  const blob = `${ctx.title}\n${ctx.summary}\n${ctx.content}`;
  const next = { ...metadata };
  const filled: string[] = [];
  const take = (key: string, value: string) => {
    if (String(next[key] ?? "").trim()) return;
    next[key] = value;
    filled.push(key);
  };

  const topic = ctx.title.trim() || "este issue";
  const gist =
    firstSentence(ctx.summary) ||
    firstSentence(ctx.content) ||
    `el problema de accesibilidad descrito en “${topic}”`;

  take("CP", inferWcagCp(blob));
  take(
    "when_to_use",
    `Cuando se observe ${gist} En pruebas de accesibilidad (QA, audit o ciclo de bugs) sobre “${topic}”.`
  );
  take(
    "pros",
    "Unifica cómo se reproduce y se reporta el hallazgo, alinea el reporte con WCAG y ahorra idas y vueltas con desarrollo."
  );
  take(
    "cons",
    "Hay que validarlo en el producto real; el contexto de origen puede omitir excepciones de plataforma o de cliente."
  );
  take("Bug Type", inferBugType(blob));
  take("Platform", inferPlatform(blob));
  take("Team", inferCompanyNote(blob));
  take("UTest", inferCompanyNote(blob));
  take("Crownspeak", inferCompanyNote(blob));
  take("Barcelo", inferCompanyNote(blob));
  take("Pros.", inferCompanyNote(blob));

  const existingComments = String(next.Comments ?? "").trim();
  if (!existingComments) {
    next.Comments =
      filled.length > 0
        ? `Campos completados a partir del contexto (${filled.join(", ")}). Revisa SC WCAG y clientes antes de publicar.`
        : `Ficha de “${topic}”. Revisa SC WCAG y clientes antes de publicar.`;
  } else if (filled.length > 0) {
    next.Comments = `${existingComments}\n\nTambién se completaron: ${filled.join(", ")}.`;
  }

  return normalizeApproachMetadata(next);
}

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
