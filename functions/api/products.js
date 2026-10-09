import { json } from "../_lib/http.js";

export async function onRequestGet({ env, request }) {
  if (!env?.DB) return json({ error: "Database belum tersambung." }, 503);
  const url = new URL(request.url);
  const categoryId = url.searchParams.get("category");
  const search = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const relatedTo = url.searchParams.get("related_to");
  try {
    const conditions = ["lower(p.status)='active'", "lower(v.status)='active'", "lower(u.status)='active'"];
    const bindings = [];
    if (categoryId && /^\d+$/.test(categoryId)) { conditions.push("p.category_id = ?"); bindings.push(Number(categoryId)); }
    if (search) { conditions.push("(p.name LIKE ? OR p.short_description LIKE ? OR v.merk LIKE ? OR v.nama_varian LIKE ?)"); bindings.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (relatedTo && /^\d+$/.test(relatedTo)) { conditions.push("p.id IN (SELECT related_product_id FROM related_products WHERE product_id = ? ORDER BY sort_order LIMIT 8)"); bindings.push(Number(relatedTo)); }
    const sql = `
      SELECT p.id, p.sku, p.name, p.slug, p.category_id, p.short_description, p.description,
             p.tips_storage, p.cooking_ideas, p.stock, p.stock_mode, lower(p.stock_status) AS stock_status,
             p.status, p.is_featured, p.sort_order, p.created_at, c.name AS category_name,
             COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
               WHERE oi.product_id = p.id AND o.status IN ('processed','delivering','completed')), 0) AS units_sold,
             (SELECT ph.image_url FROM product_photos ph WHERE ph.product_id = p.id
               ORDER BY ph.is_primary DESC, ph.id ASC LIMIT 1) AS image_url,
             v.id_varian, v.sku_varian, v.merk, v.nama_varian, v.nama_produk_tampil,
             u.id_satuan, u.kode_satuan, u.nama_satuan, lower(u.sale_type) AS sale_type,
             u.harga, u.allow_nominal_purchase, u.nominal_min, u.is_default AS unit_is_default,
             u.sort_order AS unit_sort_order
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN variants v ON v.product_id = p.id
      JOIN sale_units u ON u.id_varian = v.id_varian
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.is_featured DESC, p.sort_order, p.name, v.sort_order, u.sort_order, u.id_satuan`;
    const { results = [] } = await env.DB.prepare(sql).bind(...bindings).all();
    const products = new Map();
    for (const row of results) {
      if (!products.has(row.id)) {
        products.set(row.id, {
          id: row.id, sku: row.sku, name: row.name, slug: row.slug,
          category_id: row.category_id, category_name: row.category_name,
          short_description: row.short_description, description: row.description,
          tips_storage: row.tips_storage, cooking_ideas: row.cooking_ideas,
          stock: row.stock, stock_mode: row.stock_mode || "unlimited", stock_status: row.stock_status, status: row.status,
          is_featured: row.is_featured, sort_order: row.sort_order, created_at: row.created_at, units_sold: Number(row.units_sold || 0), image_url: row.image_url, variants: [], _variants: new Map(),
        });
      }
      const product = products.get(row.id);
      if (row.id_varian == null) continue;
      if (!product._variants.has(row.id_varian)) {
        const variant = {
          id_varian: row.id_varian, sku_varian: row.sku_varian, merk: row.merk,
          nama_varian: row.nama_varian, nama_produk_tampil: row.nama_produk_tampil,
          units: [], _unitIds: new Set(),
        };
        product._variants.set(row.id_varian, variant);
        product.variants.push(variant);
      }
      const variant = product._variants.get(row.id_varian);
      if (row.id_satuan != null && !variant._unitIds.has(row.id_satuan)) {
        variant._unitIds.add(row.id_satuan);
        variant.units.push({
          id_satuan: row.id_satuan, kode_satuan: row.kode_satuan, nama_satuan: row.nama_satuan,
          sale_type: row.sale_type, harga: row.harga, allow_nominal_purchase: row.allow_nominal_purchase,
          nominal_min: row.nominal_min, is_default: row.unit_is_default, sort_order: row.unit_sort_order,
        });
      }
    }
    return json([...products.values()].map(product => {
      delete product._variants;
      product.variants = product.variants.map(v => { delete v._unitIds; return v; });
      return product;
    }));
  } catch (error) {
    return json({ error: "Gagal mengambil produk. Pastikan migration dan impor data sudah benar.", detail: String(error?.message || "Unknown error") }, 503);
  }
}
