import "server-only";
import { google, type sheets_v4 } from "googleapis";
import { env, isSheetsConfigured } from "@/lib/env";

/**
 * Mirror format — one row per knowledge item, one tab per section:
 * ID | Tipo | Título | Resumen | Contenido | Tags | Estado | Actualizado
 */
export const MIRROR_HEADERS = [
  "ID",
  "Tipo",
  "Título",
  "Resumen",
  "Contenido",
  "Tags",
  "Estado",
  "Actualizado",
] as const;

export interface MirrorRow {
  id: string;
  typeName: string;
  title: string;
  summary: string;
  content: string;
  tags: string;
  status: string;
  updatedAt: string;
}

function getSheetsClient(): sheets_v4.Sheets {
  if (!isSheetsConfigured()) {
    throw new Error(
      "Google Sheets no está configurado (revisa GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY y GOOGLE_SHEET_ID)."
    );
  }
  const auth = new google.auth.JWT({
    email: env.google.serviceAccountEmail,
    key: env.google.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function listSheetTabs(): Promise<string[]> {
  const sheets = getSheetsClient();
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: env.google.sheetId!,
    fields: "sheets(properties(title))",
  });
  return (data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));
}

/**
 * Reads a tab and returns all raw rows (1-based row numbers). The header row
 * is chosen by the caller — real-world sheets often have banners above it.
 */
export async function readTab(
  tab: string
): Promise<{ rows: { rowNumber: number; values: string[] }[] }> {
  const sheets = getSheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: env.google.sheetId!,
    range: `'${tab.replace(/'/g, "''")}'!A1:ZZ100000`,
  });
  const values = (data.values ?? []) as string[][];
  return {
    rows: values.map((row, i) => ({
      rowNumber: i + 1,
      values: row.map((v) => String(v ?? "")),
    })),
  };
}

async function ensureTab(sheets: sheets_v4.Sheets, tab: string): Promise<void> {
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId: env.google.sheetId!,
    fields: "sheets(properties(title))",
  });
  const exists = (data.sheets ?? []).some((s) => s.properties?.title === tab);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: env.google.sheetId!,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tab } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.google.sheetId!,
    range: `'${tab}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...MIRROR_HEADERS]] },
  });
}

/**
 * Writes/updates the mirror row for an item and returns the row number used.
 * Lookup order: known row → search by ID in column A → append.
 */
export async function upsertMirrorRow(
  tab: string,
  row: MirrorRow,
  knownRowNumber: number | null
): Promise<number> {
  const sheets = getSheetsClient();
  await ensureTab(sheets, tab);

  const values = [
    [
      row.id,
      row.typeName,
      row.title,
      row.summary,
      row.content,
      row.tags,
      row.status,
      row.updatedAt,
    ],
  ];

  let targetRow = knownRowNumber;

  if (targetRow) {
    // Verify the known row still belongs to this item.
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: env.google.sheetId!,
      range: `'${tab}'!A${targetRow}`,
    });
    const cell = data.values?.[0]?.[0];
    if (cell !== row.id) targetRow = null;
  }

  if (!targetRow) {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: env.google.sheetId!,
      range: `'${tab}'!A1:A100000`,
    });
    const column = (data.values ?? []).map((r) => r[0]);
    const idx = column.findIndex((v) => v === row.id);
    if (idx >= 0) targetRow = idx + 1;
  }

  if (targetRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.google.sheetId!,
      range: `'${tab}'!A${targetRow}:H${targetRow}`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
    return targetRow;
  }

  const { data: appendData } = await sheets.spreadsheets.values.append({
    spreadsheetId: env.google.sheetId!,
    range: `'${tab}'!A1:H1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  const updatedRange = appendData.updates?.updatedRange ?? "";
  const match = /![A-Z]+(\d+)/.exec(updatedRange);
  return match ? Number(match[1]) : 0;
}
