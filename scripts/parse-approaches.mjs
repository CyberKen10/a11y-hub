import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import * as XLSX from "xlsx";

/** Prefix so Wiki rows never collide with a later Google Sheets import. */
export const WIKI_SOURCE_PREFIX = "Wiki Approaches · ";

const HEADER_ALIASES = {
  id: ["id"],
  status: ["status"],
  cp: ["cp"],
  bugType: ["bug type"],
  platform: ["platform"],
  topic: ["bug description / topic", "topic"],
  approach: ["approach to be followed"],
  approachEs: [
    "aproach to be followed (spanish)",
    "approach to be followed (spanish)",
    "approach (esp)",
  ],
  team: ["team"],
  utest: ["utest"],
  crownspeak: ["crownspeak"],
  barcelo: ["barcelo"],
  pros: ["pros.", "pros"],
  comments: ["comments"],
  reference: ["reference link"],
};

const META_LABEL = {
  id: "wiki_id",
  status: "Status",
  cp: "CP",
  bugType: "Bug Type",
  platform: "Platform",
  team: "Team",
  utest: "UTest",
  crownspeak: "Crownspeak",
  barcelo: "Barcelo",
  pros: "Pros.",
  comments: "Comments",
  reference: "Reference link",
};

const COMPANY_KEYS = new Set(["team", "utest", "crownspeak", "barcelo", "pros"]);

const SKIP_REVIEWER_HEADER = new Set([
  "id",
  "status",
  "cp",
  "bug type",
  "platform",
  "bug description / topic",
  "topic",
  "approach to be followed",
  "aproach to be followed (spanish)",
  "approach to be followed (spanish)",
  "approach (esp)",
  "where it applies",
  "where it does not apply",
  "team",
  "utest",
  "crownspeak",
  "barcelo",
  "pros.",
  "pros",
  "comments",
  "reference link",
  "message to team in channel (formula)",
]);

const TAB_TAG = {
  Approaches: "Approaches",
  "PDFs Approaches": "PDF",
  "UTest - Not a Bug Examples": "UTest",
  Grouping: "Grouping",
};

function norm(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function headerIndex(headers, aliases) {
  const lower = headers.map((h) => norm(h).toLowerCase());
  for (const alias of aliases) {
    const i = lower.indexOf(alias);
    if (i >= 0) return i;
  }
  return -1;
}

/** Más de 4 personas (5 votos distintos) para marcar Aprobado. */
const APPROVAL_QUORUM = 5;

function approvalStateFromWiki(raw, reviewers) {
  const s = String(raw ?? "").toLowerCase();
  if (s === "discarded" || s === "rejected" || s === "obsolete") return "discarded";
  return reviewers.length >= APPROVAL_QUORUM ? "approved" : "pending";
}

function collectReviewers(headers, row) {
  const names = [];
  headers.forEach((header, i) => {
    const key = norm(header).toLowerCase();
    if (!key || SKIP_REVIEWER_HEADER.has(key) || key.includes("formula")) return;
    const value = norm(row[i]).toLowerCase();
    if (value === "true" || value === "yes" || value === "1") {
      names.push(norm(header));
    }
  });
  return names;
}

function firstUrl(value) {
  const match = String(value ?? "").match(/https?:\/\/\S+/i);
  return match ? match[0] : "";
}

function isBannerRow(title, approach, approachEs, wikiId) {
  if (!wikiId && title && !approach && !approachEs) return true;
  const t = title.toLowerCase();
  return t.startsWith("from ") || t === "topic";
}

function uniqueTags(values) {
  const seen = new Set();
  const tags = [];
  for (const raw of values) {
    const tag = norm(raw);
    if (!tag || tag.toLowerCase() === "n/a") continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag.slice(0, 40));
    if (tags.length >= 12) break;
  }
  return tags;
}

export function findWorkbook(cwd = process.cwd()) {
  const docs = path.join(cwd, "docs");
  const file = fs
    .readdirSync(docs)
    .find((n) => n.toLowerCase().includes("approach") && n.endsWith(".xlsx"));
  if (!file) throw new Error("No encontré Wiki Approaches .xlsx en docs/");
  return {
    file,
    path: path.join(docs, file),
    workbook: XLSX.read(fs.readFileSync(path.join(docs, file)), { type: "buffer" }),
  };
}

function firstCells(row, n = 16) {
  return (row ?? []).slice(0, n).map((c) => norm(c).toLowerCase());
}

function parseTable(sheet, tabName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  let headerRow = -1;
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const first = firstCells(rows[i]);
    const joined = first.join(" ");
    // Ignore comments/banners parked in far-right columns.
    if (
      first.includes("id") &&
      (joined.includes("bug description") || joined.includes("topic"))
    ) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return [];
  const headers = (rows[headerRow] ?? []).map((h) => norm(h));
  const col = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    col[key] = headerIndex(headers, aliases);
  }
  if (col.topic < 0) return [];

  const items = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const get = (k) => (col[k] >= 0 ? norm(row[col[k]]) : "");
    const wikiId = get("id");
    const title = get("topic");
    const approach = get("approach");
    const approachEs = get("approachEs");
    if (!title && !approach && !approachEs) continue;
    if (isBannerRow(title, approach, approachEs, wikiId)) continue;

    const metadata = {};
    for (const key of Object.keys(META_LABEL)) {
      const value = get(key);
      if (!value) continue;
      if (!COMPANY_KEYS.has(key) && value.toLowerCase() === "n/a") continue;
      metadata[META_LABEL[key]] = value;
    }
    metadata.Origen = tabName;
    const reviewers = collectReviewers(headers, row);
    if (reviewers.length > 0) metadata.wiki_reviewers = reviewers;
    metadata.approval_state = approvalStateFromWiki(get("status"), reviewers);

    const body = [
      approach ? `## Approach\n${approach}` : "",
      approachEs ? `## Approach (español)\n${approachEs}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const displayTitle = title || wikiId;
    if (!displayTitle) continue;

    items.push({
      wiki_id: wikiId || `${TAB_TAG[tabName] ?? tabName}-${i + 1}`,
      title: displayTitle.length >= 3 ? displayTitle : `${wikiId} ${displayTitle}`.trim(),
      summary: (approachEs || approach || displayTitle).slice(0, 280),
      content: (body || displayTitle).slice(0, 100_000),
      metadata,
      tags: uniqueTags([
        TAB_TAG[tabName] ?? tabName,
        get("bugType"),
        get("platform"),
        get("cp"),
      ]),
      status: "published",
      source_sheet_tab: `${WIKI_SOURCE_PREFIX}${tabName}`,
      source_sheet_row: i + 1,
      sources: firstUrl(get("reference"))
        ? [{ label: "Referencia", url: firstUrl(get("reference")) }]
        : [],
    });
  }
  return items;
}

export function parseGrouping(sheet, tabName) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  let headerRow = -1;
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const first = firstCells(rows[i]);
    const joined = first.join(" ");
    if (first.includes("topic") && joined.includes("where it applies")) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return [];
  const headers = (rows[headerRow] ?? []).map((h) => norm(h));
  const col = {
    topic: headerIndex(headers, ["topic"]),
    applies: headerIndex(headers, ["where it applies"]),
    notApplies: headerIndex(headers, ["where it does not apply"]),
    approachEs: headerIndex(headers, [
      "aproach to be followed (spanish)",
      "approach to be followed (spanish)",
    ]),
    team: headerIndex(headers, ["team"]),
    utest: headerIndex(headers, ["utest"]),
    crownspeak: headerIndex(headers, ["crownspeak"]),
    barcelo: headerIndex(headers, ["barcelo"]),
    pros: headerIndex(headers, ["pros.", "pros"]),
    comments: headerIndex(headers, ["comments"]),
    reference: headerIndex(headers, ["reference link"]),
  };
  if (col.topic < 0) return [];

  const items = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const get = (k) => (col[k] >= 0 ? norm(row[col[k]]) : "");
    const title = get("topic");
    if (!title || title.toLowerCase() === "topic") continue;
    const applies = get("applies");
    const notApplies = get("notApplies");
    const spanish = get("approachEs");
    const comments = get("comments");
    if (!applies && !notApplies && !spanish && !comments) continue;

    const wikiId = `GRP-${i + 1}`;
    const metadata = {
      wiki_id: wikiId,
      Origen: tabName,
      approval_state: "pending",
    };
    for (const key of ["team", "utest", "crownspeak", "barcelo", "pros"]) {
      const value = get(key);
      if (value) metadata[META_LABEL[key]] = value;
    }
    if (comments) metadata.Comments = comments;

    const body = [
      applies ? `## Dónde aplica\n${applies}` : "",
      notApplies ? `## Dónde no aplica\n${notApplies}` : "",
      spanish ? `## Approach (español)\n${spanish}` : "",
      comments ? `## Comentarios\n${comments}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const url = get("reference");
    items.push({
      wiki_id: wikiId,
      title: title.length >= 3 ? title : `Grouping ${title}`,
      summary: (applies || spanish || title).slice(0, 280),
      content: (body || title).slice(0, 100_000),
      metadata,
      tags: uniqueTags(["Grouping", get("team"), get("utest")]),
      status: "published",
      source_sheet_tab: `${WIKI_SOURCE_PREFIX}${tabName}`,
      source_sheet_row: i + 1,
      sources: url && /^https?:\/\//i.test(url) ? [{ label: "Referencia", url }] : [],
    });
  }
  return items;
}

export function loadApproachWikiItems(cwd = process.cwd()) {
  const { file, path: filePath, workbook } = findWorkbook(cwd);
  const tabs = ["Approaches", "PDFs Approaches", "UTest - Not a Bug Examples"];
  const items = [];
  for (const tab of tabs) {
    if (!workbook.Sheets[tab]) continue;
    items.push(...parseTable(workbook.Sheets[tab], tab));
  }
  if (workbook.Sheets.Grouping) {
    items.push(...parseGrouping(workbook.Sheets.Grouping, "Grouping"));
  }
  return { file, path: filePath, items };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const { file, items } = loadApproachWikiItems();
  const byTab = {};
  const byStatus = {};
  const byApproval = {};
  for (const item of items) {
    byTab[item.source_sheet_tab] = (byTab[item.source_sheet_tab] ?? 0) + 1;
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    const approval = item.metadata?.approval_state ?? "pending";
    byApproval[approval] = (byApproval[approval] ?? 0) + 1;
  }
  console.log("file", file);
  console.log("items", items.length);
  console.log("byTab", byTab);
  console.log("byStatus", byStatus);
  console.log("byApproval", byApproval);
  console.log("sample", JSON.stringify(items[0], null, 2));
}
