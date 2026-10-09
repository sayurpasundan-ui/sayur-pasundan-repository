import ExcelJS from "exceljs";
import { existsSync } from "node:fs";

const sheetSpecs = {
  Kategori: { key: "categories", fields: ["id","name","slug","description","status","sort_order"] },
  Produk: { key: "products", fields: ["id","sku","name","slug","category_id","short_description","description","tips_storage","cooking_ideas","stock","stock_mode","stock_status","status","is_featured","sort_order"] },
  Varian_Produk: { key: "variants", fields: ["id_varian","product_id","sku_varian","merk","nama_varian","nama_produk_tampil","status","sort_order","keterangan"] },
  Satuan_Produk: { key: "units", fields: ["id_satuan","id_varian","kode_satuan","nama_satuan","sale_type","harga","allow_nominal_purchase","nominal_min","is_default","status","sort_order","keterangan"] },
  Foto_Produk: { key: "photos", fields: ["id","source_variant_id","product_id","image_url","product_name","sale_unit_label","is_primary"] },
  Produk_Terkait: { key: "related", fields: ["product_id","related_product_id","relation_type","sort_order"] },
};

function normalHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function scalar(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (Object.hasOwn(value, "result")) return scalar(value.result);
    if (Object.hasOwn(value, "text")) return scalar(value.text);
    if (Object.hasOwn(value, "hyperlink")) return scalar(value.text || value.hyperlink);
    if (Object.hasOwn(value, "richText")) return value.richText.map(part => part.text || "").join("");
    return null;
  }
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  return value;
}
function normalizeEnum(value, fallback = null) {
  if (value == null || value === "") return fallback;
  return String(value).trim().toLowerCase().replace(/[ -]+/g, "_");
}
function intBool(value) {
  if (value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true") return 1;
  if (value === false || value === 0 || value === "0" || value == null || value === "") return 0;
  return Number(value) ? 1 : 0;
}
function numberValue(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}
function getCell(row, map, name) {
  const index = map.get(name);
  return index == null ? null : scalar(row.getCell(index + 1).value);
}

export async function readProductWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const data = {};
  for (const [sheetName, spec] of Object.entries(sheetSpecs)) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      if (sheetName === "Produk_Terkait" || sheetName === "Foto_Produk") { data[spec.key] = []; continue; }
      throw new Error(`Sheet wajib tidak ditemukan: ${sheetName}`);
    }
    const headerRow = sheet.getRow(1);
    const map = new Map();
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const name = normalHeader(scalar(cell.value));
      if (name && !map.has(name)) map.set(name, colNumber - 1);
    });
    const records = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const record = {};
      for (const field of spec.fields) {
        let inputField = field;
        if (sheetName === "Foto_Produk") {
          const aliases = {source_variant_id:"id_varian",product_name:"nama_produk",sale_unit_label:"jenis_satuan"};
          inputField = aliases[field] || field;
        }
        record[field] = getCell(row, map, inputField);
      }
      const key = spec.fields[0];
      if (record[key] == null && Object.values(record).every(v => v == null || v === "")) return;
      if (Object.values(record).every(v => v == null || v === "")) return;
      // Rows in Foto_Produk are often prepared before the image is assigned.
      // Do not import placeholder rows because product_photos.image_url is required.
      if (sheetName === "Foto_Produk" && !record.image_url) return;
      records.push(record);
    });
    data[spec.key] = records;
  }
  // Foto_Produk pada workbook menunjuk ke ID_Varian. Turunkan product_id dari relasi varian.
  const productByVariant = new Map((data.variants || []).map(row => [String(row.id_varian), row.product_id]));
  for (const photo of (data.photos || [])) {
    photo.product_id = productByVariant.get(String(photo.source_variant_id)) ?? null;
  }
  return data;
}

export function normalizeData(data) {
  const clone = structuredClone(data);
  for (const row of clone.categories) { row.id=numberValue(row.id);row.slug=String(row.slug||"").trim().toLowerCase();row.sort_order=numberValue(row.sort_order,0);row.status=normalizeEnum(row.status,"active"); }
  for (const row of clone.products) {
    row.id=numberValue(row.id);row.category_id=numberValue(row.category_id);row.stock=numberValue(row.stock,0);row.stock_mode=normalizeEnum(row.stock_mode,"unlimited");if(!new Set(["unlimited","tracked"]).has(row.stock_mode))row.stock_mode="unlimited";row.sort_order=numberValue(row.sort_order,0);row.is_featured=intBool(row.is_featured);row.status=normalizeEnum(row.status,"draft");row.stock_status=normalizeEnum(row.stock_status,"out_of_stock");
  }
  for (const row of clone.variants) { row.id_varian=numberValue(row.id_varian);row.product_id=numberValue(row.product_id);row.sort_order=numberValue(row.sort_order,0);row.status=normalizeEnum(row.status,"active"); }
  for (const row of clone.units) { row.id_satuan=numberValue(row.id_satuan);row.id_varian=numberValue(row.id_varian);row.harga=numberValue(row.harga,0);row.allow_nominal_purchase=intBool(row.allow_nominal_purchase);row.nominal_min=numberValue(row.nominal_min);row.is_default=intBool(row.is_default);row.sort_order=numberValue(row.sort_order,0);row.sale_type=normalizeEnum(row.sale_type,"piece");row.status=normalizeEnum(row.status,"active"); }
  for (const row of clone.photos) { row.id=numberValue(row.id);row.source_variant_id=numberValue(row.source_variant_id);row.product_id=numberValue(row.product_id);row.is_primary=intBool(row.is_primary); }
  // Model website saat ini menggunakan tepat satu foto utama per produk.
  // Pilih deterministik: varian dengan sort_order terkecil, satuan default, lalu ID foto terkecil.
  const variantsById = new Map(clone.variants.map(row => [row.id_varian, row]));
  const unitsByVariantLabel = new Map();
  for (const unit of clone.units) unitsByVariantLabel.set(`${unit.id_varian}|${String(unit.nama_satuan || "").trim().toLowerCase()}`, unit);
  const photoScore = photo => {
    const variant = variantsById.get(photo.source_variant_id);
    const unit = unitsByVariantLabel.get(`${photo.source_variant_id}|${String(photo.sale_unit_label || "").trim().toLowerCase()}`);
    return [variant?.sort_order ?? 999999, unit && unit.is_default === 1 ? 0 : 1, unit?.sort_order ?? 999999, photo.is_primary ? 0 : 1, photo.id ?? 999999];
  };
  const compareScore = (a,b) => { const x=photoScore(a), y=photoScore(b); for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]-y[i];} return 0; };
  const photosByProduct = new Map();
  for (const photo of clone.photos) { const key=photo.product_id; if(key==null)continue; const current=photosByProduct.get(key); if(!current||compareScore(photo,current)<0)photosByProduct.set(key,photo); }
  clone.photos=[...photosByProduct.values()];
  for (const row of clone.related) { row.product_id=numberValue(row.product_id);row.related_product_id=numberValue(row.related_product_id);row.sort_order=numberValue(row.sort_order,0);row.relation_type=normalizeEnum(row.relation_type,"related"); }
  return clone;
}


/**
 * Apply the owner-approved clean-deploy rules to a copy of the normalized workbook data.
 * The workbook itself is never edited; invalid/ambiguous rows are excluded from this import only.
 */
export function cleanForDeployData(input, repoRoot) {
  const data = structuredClone(input);
  const before = Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length]));
  const actions = [];
  const describe = (table, id, name, action, reason) => actions.push({ table, id: id ?? "(kosong)", name: name ?? "", action, reason });
  const keyOf = value => String(value ?? "").trim().toLocaleLowerCase("id-ID");
  const duplicateValues = (rows, getValue) => {
    const counts = new Map();
    for (const row of rows) {
      const value = keyOf(getValue(row));
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
  };
  const countBy = (rows, getValue) => {
    const counts = new Map();
    for (const row of rows) {
      const value = getValue(row);
      if (value == null || value === "") continue;
      counts.set(String(value), (counts.get(String(value)) || 0) + 1);
    }
    return counts;
  };

  // Drop ambiguous or incomplete categories rather than guess their IDs.
  const dupCategoryIds = duplicateValues(data.categories, row => row.id);
  const dupCategorySlugs = duplicateValues(data.categories, row => row.slug);
  data.categories = data.categories.filter(row => {
    let reason = null;
    if (row.id == null || !keyOf(row.name) || !keyOf(row.slug)) reason = "ID/nama/slug kategori wajib kosong";
    else if (dupCategoryIds.has(keyOf(row.id))) reason = "ID kategori duplikat/ambigu";
    else if (dupCategorySlugs.has(keyOf(row.slug))) reason = "slug kategori duplikat/ambigu";
    if (reason) describe("Kategori", row.id, row.name, "Dihapus", reason);
    return !reason;
  });
  const categoryIds = new Set(data.categories.map(row => String(row.id)));

  // Identify products whose row identity is already invalid before checking duplicate names/slugs.
  const duplicateProductIds = duplicateValues(data.products, row => row.id);
  const duplicateProductSkus = duplicateValues(data.products, row => row.sku);
  const dropProductIds = new Set();
  const baseProducts = [];
  for (const row of data.products) {
    let reason = null;
    if (row.id == null || !keyOf(row.sku) || !keyOf(row.name) || !keyOf(row.slug)) reason = "ID/SKU/nama/slug produk wajib kosong";
    else if (duplicateProductIds.has(keyOf(row.id))) reason = "ID produk duplikat/ambigu";
    else if (duplicateProductSkus.has(keyOf(row.sku))) reason = "SKU produk duplikat/ambigu";
    else if (!categoryIds.has(String(row.category_id))) reason = `category_id ${row.category_id} tidak ditemukan`;
    if (reason) {
      if (row.id != null) dropProductIds.add(row.id);
      describe("Produk", row.id, row.name, "Dihapus", reason);
    } else baseProducts.push(row);
  }

  // A product counts as viable only when it has an unambiguous variant and at least one valid sale unit.
  const variantIdCounts = countBy(data.variants, row => row.id_varian);
  const variantSkuDuplicates = duplicateValues(data.variants, row => row.sku_varian);
  const unitIdCounts = countBy(data.units, row => row.id_satuan);
  const baseProductIds = new Set(baseProducts.map(row => row.id));
  const validUnitsForCandidate = data.units.filter(row => {
    const price = Number(row.harga);
    return row.id_satuan != null && unitIdCounts.get(String(row.id_satuan)) === 1 &&
      row.id_varian != null && keyOf(row.kode_satuan) && keyOf(row.nama_satuan) &&
      ["piece", "pack", "measure"].includes(row.sale_type) && Number.isFinite(price) && price >= 0;
  });
  const viableProductIds = new Set(data.variants.filter(row => {
    const idCount = variantIdCounts.get(String(row.id_varian)) || 0;
    return row.id_varian != null && idCount === 1 && baseProductIds.has(row.product_id) &&
      keyOf(row.sku_varian) && !variantSkuDuplicates.has(keyOf(row.sku_varian)) &&
      (keyOf(row.nama_produk_tampil) || keyOf(row.nama_varian)) &&
      validUnitsForCandidate.some(unit => unit.id_varian === row.id_varian);
  }).map(row => row.product_id));

  // For duplicate product names/slugs, keep a row only when exactly one member is sellable.
  // Example: Pakcoy 1031 has no variant/unit chain, while Pakcoy 1482 does; keep 1482.
  const handledDuplicateGroups = new Set();
  for (const [field, label] of [["name", "nama produk"], ["slug", "slug produk"]]) {
    const groups = new Map();
    for (const row of baseProducts) {
      const value = keyOf(row[field]);
      if (!value) continue;
      groups.set(value, [...(groups.get(value) || []), row]);
    }
    for (const [value, group] of groups) {
      if (group.length < 2) continue;
      const groupIds = group.map(row => row.id).sort((a, b) => Number(a) - Number(b));
      const signature = `${field}|${value}|${groupIds.join(",")}`;
      if (handledDuplicateGroups.has(signature)) continue;
      handledDuplicateGroups.add(signature);
      const candidates = group.filter(row => !dropProductIds.has(row.id) && viableProductIds.has(row.id));
      if (candidates.length === 1) {
        const keepId = candidates[0].id;
        for (const row of group) {
          if (row.id === keepId || dropProductIds.has(row.id)) continue;
          dropProductIds.add(row.id);
          describe("Produk", row.id, row.name, "Dihapus", `${label} ambigu (${row[field]}); ID ${keepId} dipertahankan karena memiliki varian dan satuan valid.`);
        }
      } else {
        for (const row of group) {
          if (dropProductIds.has(row.id)) continue;
          dropProductIds.add(row.id);
          describe("Produk", row.id, row.name, "Dihapus", `${label} ambigu (${row[field]}); tidak ada tepat satu kandidat dengan varian dan satuan valid.`);
        }
      }
    }
  }
  data.products = baseProducts.filter(row => !dropProductIds.has(row.id));
  const productIds = new Set(data.products.map(row => row.id));

  // Drop variants with missing/duplicated IDs, duplicated SKUs, missing names, or invalid product parents.
  const finalVariantIdCounts = countBy(data.variants, row => row.id_varian);
  const finalVariantSkuDuplicates = duplicateValues(data.variants, row => row.sku_varian);
  const displayNameCounts = countBy(data.variants.filter(row => productIds.has(row.product_id)), row => `${row.product_id}|${keyOf(row.nama_produk_tampil)}`);
  const validVariants = [];
  for (const row of data.variants) {
    let reason = null;
    if (row.id_varian == null) reason = "id_varian kosong; tidak dapat dipakai sebagai primary key";
    else if (finalVariantIdCounts.get(String(row.id_varian)) > 1) reason = "id_varian duplikat/ambigu";
    else if (!productIds.has(row.product_id)) reason = `product_id ${row.product_id} tidak ditemukan atau produk induk dihapus`;
    else if (!keyOf(row.sku_varian) || finalVariantSkuDuplicates.has(keyOf(row.sku_varian))) reason = "sku_varian kosong/duplikat";
    else if (!keyOf(row.nama_produk_tampil) && !keyOf(row.nama_varian)) reason = "nama varian/produk tampil kosong";
    else if (keyOf(row.nama_produk_tampil) && displayNameCounts.get(`${row.product_id}|${keyOf(row.nama_produk_tampil)}`) > 1) reason = "nama_produk_tampil duplikat dalam produk yang sama";
    if (reason) describe("Varian_Produk", row.id_varian, row.nama_produk_tampil || row.nama_varian, "Dihapus", reason);
    else validVariants.push(row);
  }
  const variantIds = new Set(validVariants.map(row => row.id_varian));

  // Drop orphan, duplicated, or invalid sale units.
  const validUnits = [];
  for (const row of data.units) {
    let reason = null;
    const price = Number(row.harga);
    if (row.id_satuan == null) reason = "id_satuan kosong";
    else if (unitIdCounts.get(String(row.id_satuan)) > 1) reason = "id_satuan duplikat/ambigu";
    else if (!variantIds.has(row.id_varian)) reason = `id_varian ${row.id_varian} tidak valid setelah pembersihan varian`;
    else if (!keyOf(row.kode_satuan) || !keyOf(row.nama_satuan)) reason = "kode_satuan/nama_satuan kosong";
    else if (!["piece", "pack", "measure"].includes(row.sale_type) || !Number.isFinite(price) || price < 0) reason = "jenis satuan atau harga tidak valid";
    if (reason) describe("Satuan_Produk", row.id_satuan, `${row.kode_satuan || ""} ${row.nama_satuan || ""}`.trim(), "Dihapus", reason);
    else validUnits.push(row);
  }

  // Variants without any valid sale unit are not useful for the live catalog; remove them.
  const variantIdsWithUnits = new Set(validUnits.map(row => row.id_varian));
  data.variants = validVariants.filter(row => {
    if (variantIdsWithUnits.has(row.id_varian)) return true;
    describe("Varian_Produk", row.id_varian, row.nama_produk_tampil || row.nama_varian, "Dihapus", "tidak memiliki satuan jual valid");
    return false;
  });
  data.units = validUnits.filter(row => variantIdsWithUnits.has(row.id_varian));

  // Keep valid products without units as draft so they can be completed later in Admin Panel.
  const sellableProductIds = new Set(data.variants.filter(variant => data.units.some(unit => unit.id_varian === variant.id_varian)).map(variant => variant.product_id));
  data.products = data.products.map(row => {
    if (sellableProductIds.has(row.id)) return row;
    if (row.status !== "draft" || row.is_featured !== 0) {
      describe("Produk", row.id, row.name, "Dipindahkan ke draft", "belum memiliki varian dan satuan jual valid; dapat dilengkapi melalui Admin Panel.");
    } else {
      describe("Produk", row.id, row.name, "Dipertahankan sebagai draft", "belum memiliki varian dan satuan jual valid; tidak tampil di katalog.");
    }
    return { ...row, status: "draft", is_featured: 0 };
  });

  // Exclude recommendation rows whose source/target product was removed, plus self-links/duplicates.
  const relatedSeen = new Set();
  data.related = data.related.filter(row => {
    let reason = null;
    if (!productIds.has(row.product_id)) reason = `product_id ${row.product_id} tidak valid setelah pembersihan`;
    else if (!productIds.has(row.related_product_id)) reason = `related_product_id ${row.related_product_id} tidak valid setelah pembersihan`;
    else if (row.product_id === row.related_product_id) reason = "relasi produk ke dirinya sendiri";
    else {
      const key = `${row.product_id}|${row.related_product_id}|${row.relation_type || "related"}`;
      if (relatedSeen.has(key)) reason = "relasi duplikat";
      else relatedSeen.add(key);
    }
    if (reason) describe("Produk_Terkait", `${row.product_id}→${row.related_product_id}`, row.relation_type, "Dihapus", reason);
    return !reason;
  });

  // Photos are optional until manual upload. Keep at most one existing supported image per product.
  const variantById = new Map(data.variants.map(row => [row.id_varian, row]));
  const validPhotos = data.photos.filter(row => {
    if (!productIds.has(row.product_id) || !variantById.has(row.source_variant_id)) {
      describe("Foto_Produk", row.id, row.product_name, "Dilewati", "produk atau varian asal tidak valid");
      return false;
    }
    return true;
  });
  const missingPhotos = missingLocalPhotoAssets(validPhotos, repoRoot);
  if (missingPhotos.length) {
    const missingKeys = new Set(missingPhotos.map(row => `${row.id}|${row.image_url}`));
    validPhotos.splice(0, validPhotos.length, ...validPhotos.filter(row => !missingKeys.has(`${row.id}|${row.image_url}`)));
    describe("Foto_Produk", `${missingPhotos.length} referensi`, "Foto lokal belum tersedia", "Dikosongkan dari impor", "Path tidak memiliki file fisik di public/. Foto akan diunggah manual setelah website berjalan.");
  }
  const photosByProduct = new Map();
  for (const photo of validPhotos) {
    if (!photosByProduct.has(photo.product_id)) photosByProduct.set(photo.product_id, photo);
    else describe("Foto_Produk", photo.id, photo.product_name, "Dilewati", "hanya satu foto utama per produk yang didukung saat ini");
  }
  data.photos = [...photosByProduct.values()];

  const after = Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length]));
  return { data, before, after, actions };
}

export function auditData(data) {
  const errors=[],warnings=[];
  const checkUnique=(rows,field,label,{warning=false}={})=>{
    const values=new Map();
    for(const row of rows){const v=row[field];if(v==null||v==="")continue;const k=String(v);values.set(k,(values.get(k)||0)+1);}
    const duplicate=[...values.entries()].filter(([,n])=>n>1);
    if(duplicate.length){const msg=`${label}: ${duplicate.length} nilai duplikat; contoh ${duplicate.slice(0,8).map(([k,n])=>`${k} (${n}x)`).join(", ")}`;(warning?warnings:errors).push(msg);}
  };
  const checkIds=(rows,field,label)=>checkUnique(rows,field,`ID ${label}`);
  const requireFields=(rows,fields,label)=>{
    const bad=rows.filter(row=>fields.some(field=>row[field]==null||row[field]===""));
    if(bad.length)errors.push(`${label}: ${bad.length} baris kehilangan kolom wajib (${fields.join(", ")}); periksa ID/baris Excel yang bersangkutan.`);
  };
  requireFields(data.categories,["id","name","slug"],"Kategori");
  requireFields(data.products,["id","sku","name","slug"],"Produk");
  requireFields(data.variants,["id_varian","product_id","sku_varian"],"Varian Produk");
  requireFields(data.units,["id_satuan","id_varian","kode_satuan","nama_satuan","harga","sale_type"],"Satuan Produk");
  requireFields(data.photos,["id","product_id","image_url"],"Foto Produk");
  requireFields(data.related,["product_id","related_product_id"],"Produk Terkait");
  checkIds(data.categories,"id","Kategori");checkIds(data.products,"id","Produk");checkIds(data.variants,"id_varian","Varian");checkIds(data.units,"id_satuan","Satuan");checkIds(data.photos,"id","Foto");
  checkUnique(data.categories,"slug","Slug kategori");checkUnique(data.products,"sku","SKU produk");checkUnique(data.variants,"sku_varian","SKU varian");checkUnique(data.products,"slug","Slug produk");
  const normalizedNames = new Map();
  for (const row of data.products) {
    const key = String(row.name || "").trim().toLocaleLowerCase("id-ID");
    if (!key) continue;
    normalizedNames.set(key, [...(normalizedNames.get(key) || []), row.id]);
  }
  const ambiguousNames = [...normalizedNames.entries()].filter(([, ids]) => ids.length > 1);
  if (ambiguousNames.length) errors.push(`Nama produk ambigu/duplikat: ${ambiguousNames.length} kelompok; contoh ${ambiguousNames.slice(0, 8).map(([name, ids]) => `${name} (ID ${ids.join(", ")})`).join("; ")}. Hapus atau bedakan produknya sebelum impor.`);
  const categoryIds=new Set(data.categories.map(r=>String(r.id)));
  const productIds=new Set(data.products.map(r=>String(r.id)));
  const variantIds=new Set(data.variants.map(r=>String(r.id_varian)));
  const unitIds=new Set(data.units.map(r=>String(r.id_satuan)));
  const missing=(rows,field,valid,label)=>{
    const bad=rows.filter(r=>r[field]!=null&&r[field]!==""&&!valid.has(String(r[field])));
    if(bad.length)errors.push(`${label}: ${bad.length} baris mengacu ke ID yang tidak ditemukan; contoh ${bad.slice(0,8).map(r=>`${field}=${r[field]}${r.id!=null?` (baris ID ${r.id})`:r.id_varian!=null?` (ID Varian ${r.id_varian})`:r.id_satuan!=null?` (ID Satuan ${r.id_satuan})`:""}`).join(", ")}`);
  };
  missing(data.products,"category_id",categoryIds,"Relasi Produk → Kategori");
  missing(data.variants,"product_id",productIds,"Relasi Varian → Produk");
  missing(data.units,"id_varian",variantIds,"Relasi Satuan → Varian");
  missing(data.photos,"product_id",productIds,"Relasi Foto → Produk");
  checkUnique(data.photos,"product_id","Satu foto per produk");
  missing(data.related,"product_id",productIds,"Relasi produk utama → Produk_Terkait");
  missing(data.related,"related_product_id",productIds,"Relasi produk terkait → Produk_Terkait");
  for(const row of data.units){if(row.sale_type&&!new Set(["piece","pack","measure"]).has(row.sale_type))errors.push(`Satuan ID ${row.id_satuan}: sale_type '${row.sale_type}' bukan piece, pack, atau measure.`);}
  const statusValues=new Set(["draft","active","archived"]);
  for(const row of [...data.categories,...data.products,...data.variants,...data.units]){
    if(row.status&&!statusValues.has(row.status))errors.push(`Status '${row.status}' tidak valid pada baris ID ${row.id ?? row.id_varian ?? row.id_satuan ?? "?"}. Gunakan draft, active, atau archived.`);
  }
  const stockValues=new Set(["in_stock","low_stock","out_of_stock","pre_order"]);
  for(const row of data.products){if(!new Set(["unlimited","tracked"]).has(row.stock_mode))errors.push(`stock_mode '${row.stock_mode}' tidak valid pada Produk ID ${row.id}.`);}
  for(const row of data.products){if(row.stock_status&&!stockValues.has(row.stock_status))errors.push(`stock_status '${row.stock_status}' tidak valid pada Produk ID ${row.id}.`);}
  const variantsWithUnits = new Set(data.units.map(row => String(row.id_varian)));
  const sellableProductIds = new Set(data.variants.filter(row => variantsWithUnits.has(String(row.id_varian))).map(row => String(row.product_id)));
  const activeWithoutSellableVariant = data.products.filter(row => row.status === "active" && !sellableProductIds.has(String(row.id)));
  if (activeWithoutSellableVariant.length) warnings.push(`${activeWithoutSellableVariant.length} produk aktif belum memiliki varian/satuan jual; pertimbangkan mengubahnya ke draft agar tidak tampil saat siap produksi.`);
  const relationTypes=new Set(["similar","related","recommended","frequently_bought"]);
  for(const row of data.related){
    if(row.product_id!=null && row.related_product_id!=null && String(row.product_id)===String(row.related_product_id))errors.push(`Produk_Terkait tidak boleh menghubungkan produk ke dirinya sendiri (ID ${row.product_id}).`);
    if(row.relation_type && !relationTypes.has(row.relation_type))errors.push(`Produk_Terkait ${row.product_id} → ${row.related_product_id}: relation_type '${row.relation_type}' tidak dikenal.`);
  }
  const relationKeys=new Set();
  for(const row of data.related){
    const key=[row.product_id,row.related_product_id,row.relation_type||"related"].join("|");
    if(relationKeys.has(key))errors.push(`Produk_Terkait memiliki pasangan duplikat: ${key}.`);
    relationKeys.add(key);
  }
  return {errors,warnings,counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),idSets:{categoryIds,productIds,variantIds,unitIds}};
}

export function missingLocalPhotoAssets(photos, repoRoot) {
  return photos.filter(photo => {
    const value = String(photo.image_url || "").trim();
    if (!value || /^https?:\/\//i.test(value) || value.startsWith("/api/images/")) return false;
    const relative = value.replace(/^\/+/, "");
    return !pathExists(repoRoot, relative);
  });
}

function pathExists(repoRoot, relative) {
  // Static photo references are resolved relative to Pages' public/ directory.
  return localAssetExists(`${repoRoot}/public/${relative}`);
}

function localAssetExists(filePath) {
  return existsSync(filePath);
}

export function sqlLiteral(value) {
  if (value == null || value === "") return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g,"''").replace(/\u0000/g,"")}'`;
}
