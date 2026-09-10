import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const docs = path.join(process.cwd(), "docs");
const file = fs
  .readdirSync(docs)
  .find((n) => n.toLowerCase().includes("approach") && n.endsWith(".xlsx"));

if (!file) {
  console.error("No Approaches xlsx in docs/");
  process.exit(1);
}

const workbook = XLSX.read(fs.readFileSync(path.join(docs, file)), {
  type: "buffer",
  cellDates: true,
});
console.log("FILE", file);
console.log("SHEETS", workbook.SheetNames);

for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  console.log("\n===", name, "rows=", rows.length, "===");
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const row = rows[i];
    const preview = row
      .slice(0, 12)
      .map((c) => String(c).replace(/\s+/g, " ").slice(0, 70));
    console.log("R" + (i + 1), preview);
  }
}
