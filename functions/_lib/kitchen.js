// Keranjang Kebutuhan Dapur: mengubah rencana menu menjadi daftar belanja yang dicocokkan dengan katalog.
// Harga, satuan jual, dan stok SELALU dibaca dari katalog (D1), bukan dari data resep.
// Pencocokan hanya memakai pemetaan yang diverifikasi admin (recipe_ingredient_map) atau pilihan eksplisit pelanggan.
import "../../public/assets/units.js";
import "../../public/assets/recipe-core.js";
import { getBaseRecipe, loadMappings } from "./recipes.js";

const RC = globalThis.RecipeCore;
export const MAX_PLAN_ITEMS = 21;

const UNIT_SELECT = `
  SELECT u.id_satuan, u.id_varian, u.nama_satuan, lower(u.sale_type) AS sale_type, u.harga, u.allow_nominal_purchase, u.nominal_min,
         u.is_default AS unit_is_default, u.sort_order AS unit_sort, v.product_id, v.merk, v.nama_varian, v.sort_order AS variant_sort,
         p.name AS product_name, p.stock_mode, lower(p.stock_status) AS stock_status,
         (SELECT ph.image_url FROM product_photos ph WHERE ph.product_id = p.id ORDER BY ph.is_primary DESC, ph.id ASC LIMIT 1) AS image_url
  FROM sale_units u JOIN variants v ON v.id_varian = u.id_varian JOIN products p ON p.id = v.product_id
  WHERE lower(u.status)='active' AND lower(v.status)='active' AND lower(p.status)='active'`;

const placeholders = ids => ids.map(() => "?").join(",");

export function shapeUnit(row) {
  const unavailable = String(row.stock_mode || "unlimited").toLowerCase() !== "unlimited" && row.stock_status === "out_of_stock";
  return {
    id_satuan: Number(row.id_satuan), id_varian: Number(row.id_varian), product_id: Number(row.product_id),
    product_name: row.product_name, variant_label: [row.merk, row.nama_varian].filter(Boolean).join(" "),
    nama_satuan: row.nama_satuan, sale_type: row.sale_type, harga: Number(row.harga),
    available: !unavailable, stock_status: row.stock_status || (unavailable ? "out_of_stock" : "in_stock"), image_url: row.image_url || null,
    variant_sort: Number(row.variant_sort || 0), unit_sort: Number(row.unit_sort || 0), is_default: Number(row.unit_is_default || 0)
  };
}

export async function loadUnitsByIds(db, ids) {
  const list = [...new Set(ids.filter(n => Number.isInteger(n) && n > 0))];
  if (!list.length) return new Map();
  const { results = [] } = await db.prepare(`${UNIT_SELECT} AND u.id_satuan IN (${placeholders(list)})`).bind(...list).all();
  return new Map(results.map(r => [Number(r.id_satuan), shapeUnit(r)]));
}
export async function loadAllUnits(db) {
  const { results = [] } = await db.prepare(`${UNIT_SELECT} ORDER BY p.name, v.sort_order, u.sort_order, u.id_satuan`).all();
  return results.map(shapeUnit);
}
export async function loadUnitsByProducts(db, productIds) {
  const list = [...new Set(productIds.filter(n => Number.isInteger(n) && n > 0))];
  if (!list.length) return new Map();
  const { results = [] } = await db.prepare(`${UNIT_SELECT} AND p.id IN (${placeholders(list)}) ORDER BY p.id, v.sort_order, u.sort_order, u.id_satuan`).bind(...list).all();
  const byProduct = new Map();
  for (const row of results) { const unit = shapeUnit(row); if (!byProduct.has(unit.product_id)) byProduct.set(unit.product_id, []); byProduct.get(unit.product_id).push(unit); }
  return byProduct;
}

const roundMoney = n => Math.round(n);
const stepOf = unit => (unit.sale_type === "measure" ? 0.5 : 1);
const cartLabel = unit => `${unit.variant_label ? unit.variant_label + " · " : ""}${unit.nama_satuan}`;

function describeTarget(unit) {
  return {
    product: { id: unit.product_id, name: unit.product_name, image_url: unit.image_url },
    variant: { id: unit.id_varian, label: unit.variant_label || "Default" },
    unit: { id: unit.id_satuan, label: unit.nama_satuan, sale_type: unit.sale_type, harga: unit.harga, step: stepOf(unit) },
    available: unit.available, stock_status: unit.stock_status
  };
}

function explain(line, purchase, unit) {
  const need = line.display;
  const buy = `${RC.formatAmount(purchase.quantity)} × ${unit.nama_satuan}`;
  const leftover = purchase.leftover > 0.0001 ? ` Sisa sekitar ${RC.displayQuantity(purchase.leftover, line.unit)}.` : "";
  return `Resep butuh ${need}. Dibeli ${buy} (dibulatkan ke atas sesuai satuan jual).${leftover}`;
}

// body: { items:[{recipe_id, servings}], choices:{ [lineId]: { id_satuan, quantity? } } }
export async function computeNeeds(db, body) {
  const rawItems = Array.isArray(body?.items) ? body.items.slice(0, MAX_PLAN_ITEMS) : [];
  const entries = [], problems = [];
  for (const item of rawItems) {
    const recipe = getBaseRecipe(item?.recipe_id);
    if (!recipe) { problems.push(`Resep ${String(item?.recipe_id || "").slice(0, 20)} tidak ditemukan.`); continue; }
    const servings = Math.max(1, Math.min(20, Math.round(Number(item.servings)) || recipe.servings));
    entries.push({ recipe, servings });
  }
  const aggregated = RC.aggregateIngredients(entries);
  const mappings = await loadMappings(db);
  const choices = body?.choices && typeof body.choices === "object" ? body.choices : {};

  const wanted = [];
  for (const line of aggregated) {
    const m = mappings.get(line.key), c = choices[line.id];
    if (m && m.status === "verified" && m.id_satuan) wanted.push(Number(m.id_satuan));
    if (c && Number.isInteger(Number(c.id_satuan))) wanted.push(Number(c.id_satuan));
  }
  const unitsById = await loadUnitsByIds(db, wanted);
  const productIds = [...unitsById.values()].map(u => u.product_id);
  const unitsByProduct = await loadUnitsByProducts(db, productIds);

  const lines = aggregated.map(line => {
    const m = mappings.get(line.key), choice = choices[line.id];
    const out = {
      id: line.id, key: line.key, name: line.name, unit: line.unit, family: line.family, amount: line.amount, display: line.display, optional: line.optional,
      sources: line.sources, status: "perlu_dipilih", source: null, match: null, purchase: null, subtotal: 0, options: [], messages: []
    };
    const chosen = choice && unitsById.get(Number(choice.id_satuan)) || null;
    if (choice && !chosen) out.messages.push("Produk yang dipilih sudah tidak tersedia. Pilih produk lain.");
    const mapped = m && m.status === "verified" && m.id_satuan ? unitsById.get(Number(m.id_satuan)) || null : null;
    if (m && m.status === "verified" && !mapped && !chosen) out.messages.push("Produk pasangan bahan ini sedang tidak tersedia di katalog. Pilih produk lain.");
    if (m && m.status === "pantry" && !chosen) { out.status = "dapur"; out.messages.push("Biasanya sudah tersedia di dapur. Tidak dijual di toko / tidak dihitung otomatis."); return out; }
    if (m && m.status === "unavailable" && !chosen) { out.status = "tidak_dijual"; out.messages.push("Belum tersedia di toko."); return out; }
    const target = chosen || mapped;
    if (!target) return out; // perlu_dipilih: tidak ada pemetaan terverifikasi dan pelanggan belum memilih
    out.source = chosen ? "pelanggan" : "pemetaan";
    out.match = describeTarget(target);
    out.options = (unitsByProduct.get(target.product_id) || []).map(u => ({ id_satuan: u.id_satuan, label: cartLabel(u), harga: u.harga, available: u.available, sale_type: u.sale_type }));
    const factors = !chosen && m ? m.factors : (chosen && m && Number(m.id_satuan) === chosen.id_satuan ? m.factors : null);
    const purchase = RC.purchaseFor(line.amount, line.unit, target, factors);
    let quantity;
    if (purchase) {
      quantity = purchase.quantity;
      out.purchase = { quantity, step: purchase.step, per_unit: purchase.per_unit, basis: purchase.basis, covered: purchase.covered, leftover: purchase.leftover, manual: false, explanation: explain(line, purchase, target) };
      out.status = target.available ? "siap" : "stok_habis";
    } else {
      const step = stepOf(target), asked = Number(choice && choice.quantity);
      quantity = asked > 0 && asked <= 999 && Math.abs(asked / step - Math.round(asked / step)) < 1e-6 ? asked : 1;
      out.purchase = { quantity, step, per_unit: null, basis: null, covered: null, leftover: null, manual: true,
        explanation: `Takaran resep (${line.display}) tidak bisa dipastikan setara dengan satuan jual "${target.nama_satuan}". Tentukan sendiri jumlah yang dibeli.` };
      out.status = target.available ? "manual" : "stok_habis";
    }
    if (!target.available) out.messages.push("Stok produk ini habis.");
    out.subtotal = roundMoney(target.harga * quantity);
    return out;
  });

  return { lines, problems, entries: entries.map(e => ({ recipe_id: e.recipe.id, servings: e.servings })) };
}

// Data baris keranjang (format yang sama dengan keranjang website: lihat detail.js / app.js)
export function cartItemFromLine(line) {
  if (!line.match || !line.purchase || !line.match.available) return null;
  const { product, variant, unit } = line.match, quantity = line.purchase.quantity;
  return { key: `${product.id}:${variant.id}:${unit.id}:qty`, id_satuan: unit.id, product_id: product.id, id_varian: variant.id, name: product.name,
    variant_label: variant.label === "Default" ? "" : variant.label, unit_label: unit.label, unit_price: unit.harga, quantity, quantity_step: unit.step, nominal_amount: null,
    line_total: Math.round(unit.harga * quantity) };
}
