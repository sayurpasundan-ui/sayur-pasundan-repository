import path from "node:path";
import { readProductWorkbook, normalizeData, cleanForDeployData, auditData } from "./lib-excel.mjs";

const file = process.argv[2];
if (!file) {
  console.error('Pemakaian: npm run audit:excel -- "path/ke/workbook.xlsx"');
  process.exit(2);
}

try {
  const root = process.cwd();
  const raw = await readProductWorkbook(path.resolve(file));
  const cleaned = cleanForDeployData(normalizeData(raw), root);
  const data = cleaned.data;
  const audit = auditData(data);

  console.log(`\nAudit workbook: ${path.resolve(file)}`);
  console.log("Jumlah record sebelum pembersihan deploy (setelah normalisasi dasar):");
  for (const [key, count] of Object.entries(cleaned.before)) console.log(`  ${key.padEnd(12)} ${count}`);
  console.log("Jumlah baris yang akan digunakan untuk impor:");
  for (const [key, count] of Object.entries(audit.counts)) console.log(`  ${key.padEnd(12)} ${count}`);
  console.log(`\nTindakan pembersihan otomatis: ${cleaned.actions.length}`);
  for (const action of cleaned.actions) console.log(`  - [${action.table}] ${action.action}: ID ${action.id} — ${action.name || "(tanpa nama)"}. ${action.reason || ""}`);

  if (audit.warnings.length) {
    console.log("\nPERINGATAN:");
    for (const warning of audit.warnings) console.warn(`  ⚠ ${warning}`);
  } else {
    console.log("\nPeringatan: tidak ada.");
  }

  if (audit.errors.length) {
    console.error("\nERROR — jangan impor sebelum diperbaiki:");
    for (const error of audit.errors) console.error(`  ✖ ${error}`);
    process.exit(1);
  }
  console.log("\nLolos pemeriksaan setelah pembersihan deploy. Workbook sumber tidak diubah; baris yang tidak valid tidak masuk ke dataset impor.");
} catch (error) {
  console.error(`Audit gagal: ${error.message}`);
  process.exit(1);
}
