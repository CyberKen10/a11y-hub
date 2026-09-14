import "server-only";
import { google, type sheets_v4 } from "googleapis";
import { env } from "@/lib/env";

export function isGoogleAuthConfigured(): boolean {
  return Boolean(env.google.serviceAccountEmail && env.google.privateKey);
}

function getSheetsClient(): sheets_v4.Sheets {
  if (!isGoogleAuthConfigured()) {
    throw new Error(
      "Falta la cuenta de servicio de Google (GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY). Compártela como Lector en el Sheet."
    );
  }
  const auth = new google.auth.JWT({
    email: env.google.serviceAccountEmail,
    key: env.google.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function listSheetTabs(spreadsheetId: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const { data } = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });
  return (data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));
}

export async function readTab(
  spreadsheetId: string,
  tab: string
): Promise<{ rows: { rowNumber: number; values: string[] }[] }> {
  const sheets = getSheetsClient();
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
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
