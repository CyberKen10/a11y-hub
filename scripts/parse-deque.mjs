import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import mammoth from "mammoth";

export const DEQUE_SOURCE_PREFIX = "Deque · ";

const HEADING_RE =
  /^(\d{1,2}\.\d{1,2}\.\d{1,2})(?:\.([A-Za-z])|([A-Za-z])(?=\s|$)|[\s.]+([A-Za-z])(?=\s|$))?(?:\s+(.+))?$/;

const WCAG_NAMES = {
  "1.1.1": "Non-text Content",
  "1.2.1": "Audio-only and Video-only (Prerecorded)",
  "1.2.2": "Captions (Prerecorded)",
  "1.2.3": "Audio Description or Media Alternative (Prerecorded)",
  "1.2.4": "Captions (Live)",
  "1.2.5": "Audio Description (Prerecorded)",
  "1.3.1": "Info and Relationships",
  "1.3.2": "Meaningful Sequence",
  "1.3.3": "Sensory Characteristics",
  "1.3.4": "Orientation",
  "1.3.5": "Identify Input Purpose",
  "1.4.1": "Use of Color",
  "1.4.2": "Audio Control",
  "1.4.3": "Contrast (Minimum)",
  "1.4.4": "Resize Text",
  "1.4.5": "Images of Text",
  "1.4.10": "Reflow",
  "1.4.11": "Non-text Contrast",
  "1.4.12": "Text Spacing",
  "1.4.13": "Content on Hover or Focus",
  "2.1.1": "Keyboard",
  "2.1.2": "No Keyboard Trap",
  "2.1.4": "Character Key Shortcuts",
  "2.2.1": "Timing Adjustable",
  "2.2.2": "Pause, Stop, Hide",
  "2.3.1": "Three Flashes or Below Threshold",
  "2.4.1": "Bypass Blocks",
  "2.4.2": "Page Titled",
  "2.4.3": "Focus Order",
  "2.4.4": "Link Purpose (In Context)",
  "2.4.5": "Multiple Ways",
  "2.4.6": "Headings and Labels",
  "2.4.7": "Focus Visible",
  "2.4.11": "Focus Not Obscured (Minimum)",
  "2.5.1": "Pointer Gestures",
  "2.5.2": "Pointer Cancellation",
  "2.5.3": "Label in Name",
  "2.5.4": "Motion Actuation",
  "2.5.7": "Dragging Movements",
  "2.5.8": "Target Size (Minimum)",
  "3.1.1": "Language of Page",
  "3.1.2": "Language of Parts",
  "3.2.1": "On Focus",
  "3.2.2": "On Input",
  "3.2.3": "Consistent Navigation",
  "3.2.4": "Consistent Identification",
  "3.2.6": "Consistent Help",
  "3.3.1": "Error Identification",
  "3.3.2": "Labels or Instructions",
  "3.3.3": "Error Suggestion",
  "3.3.4": "Error Prevention (Legal, Financial, Data)",
  "3.3.7": "Redundant Entry",
  "3.3.8": "Accessible Authentication (Minimum)",
  "4.1.2": "Name, Role, Value",
  "4.1.3": "Status Messages",
};

export function unescapeMammoth(markdown) {
  return String(markdown ?? "")
    .replace(/!\[[^\]]*]\(data:[^)]+\)/g, "")
    .replace(/\\([.\\()[\]*_`])/g, "$1");
}

function stripDecor(line) {
  return line
    .trim()
    .replace(/^(?:\*\*|__)+/, "")
    .replace(/(?:\*\*|__)+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCheckpointHeading(line) {
  const stripped = stripDecor(line);
  if (!stripped || stripped.length > 120) return null;
  const match = HEADING_RE.exec(stripped);
  if (!match) return null;
  const scId = match[1];
  const variant = (match[2] || match[3] || match[4] || "").toLowerCase();
  const rest = (match[5] ?? "").trim();
  if (rest.split(/\s+/).length > 12) return null;
  return { scId, variant, heading: rest };
}

export function splitCheckpoints(markdown, fileName) {
  const text = unescapeMammoth(markdown).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const parts = [];
  let current = null;
  const body = [];

  const flush = () => {
    if (!current) return;
    current.body = body.join("\n").trim();
    if (current.body) parts.push(current);
    body.length = 0;
  };

  for (const line of lines) {
    const heading = parseCheckpointHeading(line);
    if (heading) {
      flush();
      current = {
        scId: heading.scId,
        variant: heading.variant,
        heading: heading.heading,
        body: "",
        fileName,
      };
      continue;
    }
    if (current) body.push(line);
  }
  flush();
  return parts;
}

function compareVariant(a, b) {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

function overviewSummary(body) {
  const unmarked = String(body ?? "").replace(/\*\*|__/g, "");
  const overview = /Overview\s*\n+([\s\S]+?)(?:\n\s*\n[A-Z_]|\n__|\n## |$)/i.exec(
    unmarked
  );
  const block = (overview?.[1] ?? unmarked).replace(/\s+/g, " ").trim();
  if (!block) return "";
  return block.length > 280 ? `${block.slice(0, 277).trim()}…` : block;
}

function variantLabel(part) {
  const letter = part.variant ? `.${part.variant}` : "";
  const name = part.heading || WCAG_NAMES[part.scId] || "";
  return `${part.scId}${letter}${name ? ` ${name}` : ""}`.trim();
}

export function itemsFromCheckpoints(parts) {
  const bySc = new Map();
  for (const part of parts) {
    const list = bySc.get(part.scId) ?? [];
    list.push(part);
    bySc.set(part.scId, list);
  }

  const items = [];
  for (const scId of [...bySc.keys()].sort()) {
    const group = (bySc.get(scId) ?? []).slice().sort((a, b) => {
      const variant = compareVariant(a.variant, b.variant);
      if (variant !== 0) return variant;
      return a.fileName.localeCompare(b.fileName);
    });
    const files = [...new Set(group.map((p) => p.fileName))];
    const variants = [
      ...new Set(group.map((p) => p.variant).filter(Boolean)),
    ].sort();
    const official = WCAG_NAMES[scId];
    const title = official ? `${scId} ${official}` : variantLabel(group[0]);

    const sections = group.map((part) => {
      const sameVariantInManyFiles =
        group.filter((p) => p.variant === part.variant).length > 1 &&
        files.length > 1;
      const heading = sameVariantInManyFiles
        ? `${variantLabel(part)} — ${part.fileName}`
        : variantLabel(part);
      return `## ${heading}\n\n${part.body}`.trim();
    });

    const summary =
      overviewSummary(group[0]?.body ?? "") ||
      `Cómo testear ${title} según Deque.`;

    items.push({
      title,
      summary,
      content: sections.join("\n\n"),
      tags: [
        "deque",
        "wcag",
        scId,
        ...files.map((f) =>
          f
            .replace(/\.docx$/i, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
        ),
      ].filter(Boolean),
      metadata: {
        CP: scId,
        wcag_refs: scId,
        variants: variants.join(", "),
        Origen: files.join(", "),
      },
      status: "published",
      source_sheet_tab: `${DEQUE_SOURCE_PREFIX}${scId}`,
      source_sheet_row: 1,
    });
  }
  return items;
}

export function itemsFromMarkdownDocs(docs) {
  return itemsFromCheckpoints(
    docs.flatMap((doc) => splitCheckpoints(doc.markdown, doc.fileName))
  );
}

async function markdownFromBuffer(buffer, fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return buffer.toString("utf8");
  }
  try {
    const result = await mammoth.convertToMarkdown({ buffer });
    return result.value;
  } catch {
    return buffer.toString("utf8");
  }
}

export async function loadDequeItemsFromBuffers(files) {
  const docs = [];
  for (const file of files) {
    docs.push({
      fileName: file.fileName,
      markdown: await markdownFromBuffer(file.buffer, file.fileName),
    });
  }
  return {
    file: files.map((f) => f.fileName).join(", "),
    items: itemsFromMarkdownDocs(docs),
  };
}

export function listDequeDocx(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /\.(docx|md|txt)$/i.test(name))
    .sort()
    .map((name) => path.join(dir, name));
}

export async function loadDequeItemsFromFolder(cwd = process.cwd()) {
  const dir = path.join(cwd, "deque");
  const paths = listDequeDocx(dir);
  if (paths.length === 0) return { file: "deque/", items: [] };
  const files = paths.map((filePath) => ({
    fileName: path.basename(filePath),
    buffer: fs.readFileSync(filePath),
  }));
  return loadDequeItemsFromBuffers(files);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const loaded = await loadDequeItemsFromFolder();
  console.log(
    JSON.stringify(
      {
        file: loaded.file,
        count: loaded.items.length,
        items: loaded.items.map((item) => ({
          title: item.title,
          variants: item.metadata.variants,
          origen: item.metadata.Origen,
          chars: item.content.length,
        })),
      },
      null,
      2
    )
  );
}
