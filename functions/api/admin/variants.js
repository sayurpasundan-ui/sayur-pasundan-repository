import { json, readJson, requireDb, normalizeStatus, numberOr, safeText, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  try { const { results=[] } = await requireDb(env).prepare(`SELECT v.*,p.name AS product_name FROM variants v JOIN products p ON p.id=v.product_id ORDER BY p.name,v.sort_order,v.id_varian LIMIT 2000`).all(); return json(results); }
  catch(e){ return json({error:String(e?.message||"Gagal mengambil varian")},503); }
}
export async function onRequestPost({ request, env }) {
  const auth = await requireAdmin(request, env); if (!auth.ok) return auth.response;
  if (!sameOrigin(request)) return json({error:"Origin tidak diizinkan."},403);
  const b=await readJson(request); if(!b || !Number.isInteger(Number(b.product_id)) || !safeText(b.sku_varian,120)) return json({error:"Product ID dan SKU Varian wajib diisi."},400);
  try { const db=requireDb(env); const result=await db.prepare(`INSERT INTO variants (product_id,sku_varian,merk,nama_varian,nama_produk_tampil,status,sort_order,keterangan) VALUES (?,?,?,?,?,?,?,?)`).bind(Number(b.product_id),safeText(b.sku_varian,120),safeText(b.merk,100),safeText(b.nama_varian,200),safeText(b.nama_produk_tampil,220),normalizeStatus(b.status,"active"),numberOr(b.sort_order),safeText(b.keterangan)).run(); return json({ok:true,id:result.meta?.last_row_id},201); }
  catch(e){ return json({error:String(e?.message||"Gagal membuat varian")},400); }
}
