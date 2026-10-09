import fs from "node:fs/promises";
import path from "node:path";
import { readProductWorkbook, normalizeData, cleanForDeployData, auditData, sqlLiteral, missingLocalPhotoAssets } from "./lib-excel.mjs";

const file=process.argv[2];
if(!file){console.error('Pemakaian: npm run import:excel -- "path/ke/workbook.xlsx"');process.exit(2);}
const root=process.cwd();const input=path.resolve(file);const output=path.join(root,"generated","import");
const specs=[
 {key:"categories",file:"001_categories",table:"categories",pk:"id",cols:["id","name","slug","description","status","sort_order"]},
 {key:"products",file:"002_products",table:"products",pk:"id",cols:["id","sku","name","slug","category_id","short_description","description","tips_storage","cooking_ideas","stock","stock_mode","stock_status","status","is_featured","sort_order"]},
 {key:"variants",file:"003_variants",table:"variants",pk:"id_varian",cols:["id_varian","product_id","sku_varian","merk","nama_varian","nama_produk_tampil","status","sort_order","keterangan"]},
 {key:"units",file:"004_sale_units",table:"sale_units",pk:"id_satuan",cols:["id_satuan","id_varian","kode_satuan","nama_satuan","sale_type","harga","allow_nominal_purchase","nominal_min","is_default","status","sort_order","keterangan"]},
 {key:"photos",file:"005_product_photos",table:"product_photos",pk:"product_id",cols:["id","product_id","source_variant_id","image_url","product_name","sale_unit_label","is_primary"]},
 {key:"related",file:"006_related_products",table:"related_products",pk:"product_id",cols:["product_id","related_product_id","relation_type","sort_order"]},
];
function statement(spec,row){
 const cols=spec.cols;const values=cols.map(c=>sqlLiteral(row[c]));
 if(spec.key==="related")return `INSERT INTO related_products (${cols.join(",")}) VALUES (${values.join(",")}) ON CONFLICT(product_id,related_product_id,relation_type) DO UPDATE SET sort_order=excluded.sort_order;`;
 const updates=cols.filter(c=>c!==spec.pk && !(spec.key==="photos" && c==="id")).map(c=>`${c}=excluded.${c}`);if(spec.key!=="photos")updates.push("updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')");
 return `INSERT INTO ${spec.table} (${cols.join(",")}) VALUES (${values.join(",")}) ON CONFLICT(${spec.pk}) DO UPDATE SET ${updates.join(",")};`;
}
try{
 const cleaned=cleanForDeployData(normalizeData(await readProductWorkbook(input)),root);
 const data=cleaned.data;const audit=auditData(data);
 console.log("Jumlah sebelum pembersihan:",cleaned.before);
 console.log("Jumlah setelah pembersihan:",audit.counts);
 console.log(`Tindakan pembersihan: ${cleaned.actions.length}`);
 for(const action of cleaned.actions)console.warn(` - [${action.table}] ${action.action}: ${action.id} — ${action.name}${action.reason?` (${action.reason})`:""}`);
 if(audit.warnings.length)for(const w of audit.warnings)console.warn(`WARNING: ${w}`);
 if(audit.errors.length){console.error("Impor dibatalkan. Perbaiki dulu:");for(const e of audit.errors)console.error(` - ${e}`);process.exit(1);}
 const missingPhotos=missingLocalPhotoAssets(data.photos,root);
 if(missingPhotos.length){
  const missingSet=new Set(missingPhotos.map(p=>`${p.id}|${p.image_url}`));
  data.photos=data.photos.filter(p=>!missingSet.has(`${p.id}|${p.image_url}`));
  console.warn(`Melewati ${missingPhotos.length} baris foto lokal karena file-nya belum ada di public/. Tambahkan file sesuai path lalu jalankan impor ulang setelah audit.`);
 }
 await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
 const report=["# Laporan pembersihan data untuk impor", "", `Sumber: ${input}`, "", "Catatan: hitungan sebelum dihitung setelah normalisasi dasar (termasuk penyaringan baris kosong dan pemilihan maksimum satu foto per produk), bukan jumlah mentah semua baris worksheet.", "", "## Jumlah record", "", "| Data | Sebelum pembersihan deploy | Setelah pembersihan deploy |", "|---|---:|---:|"];
 for(const key of Object.keys(cleaned.before))report.push(`| ${key} | ${cleaned.before[key]} | ${cleaned.after[key]} |`);
 report.push("", "## Tindakan", "");
 for(const action of cleaned.actions)report.push(`- **${action.table} — ${action.action}** — ID ${action.id}; ${action.name || "(tanpa nama)"}. ${action.reason || ""}`);
 await fs.writeFile(path.join(output,"CLEANUP_REPORT.md"),report.join("\n")+"\n","utf8");
 const batchSize=50;let fileCount=0;
 for(const spec of specs){
  const rows=data[spec.key]||[];
  for(let start=0;start<rows.length;start+=batchSize){
   const batch=rows.slice(start,start+batchSize);
   if(!batch.length)continue;
   const num=String(Math.floor(start/batchSize)+1).padStart(3,"0");
   const lines=["-- Generated from workbook by scripts/import-excel.mjs.","-- D1 enforces foreign keys; this file does not delete records missing from the workbook.",...batch.map(row=>statement(spec,row))];
   const filename=`${spec.file}_${num}.sql`;
   await fs.writeFile(path.join(output,filename),lines.join("\n")+"\n","utf8");fileCount++;
  }
 }
 const ps=`param([Parameter(Mandatory=$true)][string]$DatabaseName)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($DatabaseName)) { throw 'Nama database D1 remote wajib diisi.' }
Write-Host "Target D1 remote: $DatabaseName"
$confirmation = Read-Host "Ketik persis nama D1 untuk mengonfirmasi target impor"
if ($confirmation -ne $DatabaseName) { throw 'Konfirmasi nama D1 tidak cocok. Impor dibatalkan.' }
Get-ChildItem '${output.replace(/\\/g,"/")}/*.sql' | Sort-Object Name | ForEach-Object {
  Write-Host "Menjalankan $($_.Name) ke $DatabaseName"
  npx wrangler d1 execute $DatabaseName --remote --file=$($_.FullName)
  if ($LASTEXITCODE -ne 0) { throw "Impor gagal pada $($_.Name)" }
}
Write-Host 'Impor remote selesai.'`;
 await fs.writeFile(path.join(output,"apply-all.ps1"),ps,"utf8");
 const localPs=`$ErrorActionPreference = 'Stop'\nGet-ChildItem '${output.replace(/\\/g,"/")}/*.sql' | Sort-Object Name | ForEach-Object {\n  Write-Host "Menjalankan lokal $($_.Name)"\n  npx wrangler d1 execute sayur-pasundan-local --local --file=$($_.FullName)\n  if ($LASTEXITCODE -ne 0) { throw "Impor lokal gagal pada $($_.Name)" }\n}\nWrite-Host 'Impor lokal selesai.'`;
 await fs.writeFile(path.join(output,"apply-all-local.ps1"),localPs,"utf8");
 console.log(`\nBerhasil membuat ${fileCount} file SQL di ${output}`);
 console.log("Untuk data lokal: jalankan generated/import/apply-all-local.ps1. Untuk database remote: jangan jalankan apply-all.ps1 sebelum target D1, laporan, dan backup dikonfirmasi.");
}catch(error){console.error(`Impor gagal: ${error.message}`);process.exit(1);}
