import { compareWcagSc, parseWcagSuccessCriteria } from "@/lib/wcag";
import { WCAG_SC_BY_ID } from "@/lib/wcag-catalog";

export interface SelectOption {
  value: string;
  label: string;
}

/** Wiki Bug Type values (canonical). */
export const BUG_TYPE_OPTIONS: SelectOption[] = [
  { value: "SR", label: "SR (Screen Readers)" },
  { value: "KB", label: "KB (Keyboard)" },
  { value: "CC", label: "CC (Color Contrast)" },
  { value: "Zoom", label: "Zoom" },
  { value: "HTML", label: "HTML" },
  { value: "TalkBack", label: "TalkBack" },
  { value: "VoiceOver", label: "VoiceOver" },
  { value: "URL", label: "URL" },
  { value: "Other A11y", label: "Other A11y" },
];

/** Wiki Platform values (canonical). */
export const PLATFORM_OPTIONS: SelectOption[] = [
  { value: "Any", label: "Any" },
  { value: "Web", label: "Web" },
  { value: "iOS", label: "iOS" },
  { value: "Android", label: "Android" },
  { value: "Android/iOS", label: "Android/iOS" },
  { value: "Mobile Web", label: "Mobile Web" },
  { value: "Mobile Native", label: "Mobile Native" },
];

/** Wiki company columns: Team, UTest, Crownspeak, Barcelo, Pros. */
export const COMPANY_STATUS_OPTIONS: SelectOption[] = [
  { value: "N/A", label: "N/A" },
  { value: "Valid Bug (Low)", label: "Valid Bug (Low)" },
  { value: "Valid Bug (Medium)", label: "Valid Bug (Medium)" },
  { value: "Valid Bug (High)", label: "Valid Bug (High)" },
  { value: "Valid Bug (Critical)", label: "Valid Bug (Critical)" },
  { value: "Valid Bug", label: "Valid Bug (sin severidad)" },
  { value: "BP / UX", label: "BP / UX" },
  { value: "Apply", label: "Apply" },
  { value: "TBD", label: "TBD" },
];

export const COMPANY_FIELD_KEYS = [
  "Team",
  "UTest",
  "Crownspeak",
  "Barcelo",
  "Pros.",
] as const;

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchOption(
  raw: string,
  options: readonly SelectOption[]
): string | null {
  const t = fold(raw);
  if (!t) return null;
  for (const option of options) {
    if (fold(option.value) === t || fold(option.label) === t) return option.value;
  }
  return null;
}

export function normalizeBugType(raw: string): string {
  const hit = matchOption(raw, BUG_TYPE_OPTIONS);
  if (hit) return hit;
  const t = fold(raw);
  if (!t) return "";
  if (/\btalkback\b/.test(t)) return "TalkBack";
  if (/\bvoiceover\b/.test(t)) return "VoiceOver";
  if (
    /\bsr\b/.test(t) ||
    t.includes("screen reader") ||
    t.includes("lector") ||
    /\bnvda\b|\bjaws\b/.test(t)
  ) {
    return "SR";
  }
  if (/\bkb\b/.test(t) || t.includes("keyboard") || t.includes("teclado")) {
    return "KB";
  }
  if (
    /\bcc\b/.test(t) ||
    t.includes("contrast") ||
    t.includes("contraste") ||
    t.includes("color") ||
    t.includes("visual")
  ) {
    return "CC";
  }
  if (t.includes("zoom")) return "Zoom";
  if (/\bhtml\b/.test(t)) return "HTML";
  if (/\burl\b/.test(t)) return "URL";
  if (t.includes("other") || t.includes("functional") || t.includes("forms") || t.includes("image")) {
    return "Other A11y";
  }
  return raw.trim();
}

export function normalizePlatform(raw: string): string {
  const hit = matchOption(raw, PLATFORM_OPTIONS);
  if (hit) return hit;
  const t = fold(raw);
  if (!t) return "";
  const android = t.includes("android");
  const ios = /\bios\b/.test(t) || t.includes("iphone") || t.includes("ipad");
  if (android && ios) return "Android/iOS";
  if (t.includes("mobile native")) return "Mobile Native";
  if (t.includes("mobile web")) return "Mobile Web";
  if (android) return "Android";
  if (ios) return "iOS";
  if (t.includes("html") || t.includes("web") || t.includes("navegador") || t.includes("browser")) {
    return "Web";
  }
  if (t.includes("all") || t.includes("any") || t.includes("todas") || t.includes("cualquiera")) {
    return "Any";
  }
  return raw.trim();
}

export function normalizeCompanyStatus(raw: string): string {
  const hit = matchOption(raw, COMPANY_STATUS_OPTIONS);
  if (hit) return hit;
  const t = fold(raw);
  if (!t || t === "-" || t === "—") return "N/A";
  if (t.includes("critic") || t.includes("bloquea") || t.includes("blocker")) {
    return "Valid Bug (Critical)";
  }
  if (
    t.includes("high") ||
    t.includes("alto") ||
    t.includes("grave") ||
    t.includes("sever")
  ) {
    return "Valid Bug (High)";
  }
  if (t.includes("medium") || t.includes("medio") || t.includes("moderad")) {
    return "Valid Bug (Medium)";
  }
  if (t.includes("low") || t.includes("bajo") || t.includes("menor") || t.includes("minor")) {
    return "Valid Bug (Low)";
  }
  if (t.includes("valid bug")) return "Valid Bug";
  if (t.includes("bp") || t.includes("ux") || t.includes("best practice")) return "BP / UX";
  if (/\btbd\b/.test(t) || t.includes("por definir")) return "TBD";
  if (t.includes("apply") || t.includes("aplica")) return "Apply";
  if (
    t.includes("n/a") ||
    t.includes("not a bug") ||
    t.includes("no es un bug")
  ) {
    return "N/A";
  }
  return raw.trim();
}

/** Pick a wiki severity for an inferred valid bug. Default: Medium. */
export function inferCompanySeverity(blob: string): string {
  const t = fold(blob);
  if (!t) return "Valid Bug (Medium)";
  if (
    /critic|bloquea|blocker|inusable|keyboard trap|trampa de teclado/.test(t)
  ) {
    return "Valid Bug (Critical)";
  }
  if (
    /high|alto|grave|sin nombre accesible|no anunci/.test(t)
  ) {
    return "Valid Bug (High)";
  }
  if (/low|bajo|menor|minor|cosmetic|best practice|bp \/ ux/.test(t)) {
    return "Valid Bug (Low)";
  }
  return "Valid Bug (Medium)";
}

export function normalizeCpValue(raw: string): string {
  const ids = parseWcagSuccessCriteria(raw);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique.sort(compareWcagSc).join(", ");
}

export function isKnownWcagSc(id: string): boolean {
  return WCAG_SC_BY_ID.has(id);
}

/** Snap AI/free-text ficha values onto the wiki selectors when possible. */
export function normalizeApproachMetadata(
  metadata: Record<string, string>
): Record<string, string> {
  const next = { ...metadata };
  if (next.CP != null) next.CP = normalizeCpValue(next.CP);
  if (next["Bug Type"] != null) next["Bug Type"] = normalizeBugType(next["Bug Type"]);
  if (next.Platform != null) next.Platform = normalizePlatform(next.Platform);
  for (const key of COMPANY_FIELD_KEYS) {
    if (next[key] != null) next[key] = normalizeCompanyStatus(next[key]);
  }
  return next;
}

export function optionsWithCurrent(
  options: readonly SelectOption[],
  current: string
): SelectOption[] {
  const trimmed = current.trim();
  if (!trimmed || options.some((o) => o.value === trimmed)) return [...options];
  return [...options, { value: trimmed, label: `${trimmed} (actual)` }];
}

export function optionValuesList(options: readonly SelectOption[]): string {
  return options.map((o) => `"${o.value}"`).join(", ");
}
