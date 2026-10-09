import { json, readJson, requireDb, safeText, toIntBool, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
export async function onRequestGet({request,env}){
 const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;
 try{const {results=[]}=await requireDb(env).prepare(`SELECT ph.*,p.name AS product_name_master,v.sku_varian,v.merk,v.nama_varian FROM product_photos ph JOIN products p ON p.id=ph.product_id LEFT JOIN variants v ON v.id_varian=ph.source_variant_id ORDER BY p.name LIMIT 5000`).all();return json(results);}
 catch(e){return json({error:String(e?.message||"Gagal mengambil foto")},503);}
}
export async function onRequestPost({request,env}){
 const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;if(!sameOrigin(request))return json({error:"Origin tidak diizinkan."},403);
 const b=await readJson(request);const productId=Number(b?.product_id);if(!b||!Number.isInteger(productId)||productId<=0||!safeText(b.image_url,500))return json({error:"Produk dan URL/path foto wajib diisi."},400);
 const sourceVariantId=Number(b.source_variant_id)>0?Number(b.source_variant_id):null;
 try{const db=requireDb(env);await db.prepare(`INSERT INTO product_photos (product_id,source_variant_id,image_url,product_name,sale_unit_label,is_primary) VALUES (?,?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET source_variant_id=excluded.source_variant_id,image_url=excluded.image_url,product_name=excluded.product_name,sale_unit_label=excluded.sale_unit_label,is_primary=excluded.is_primary`).bind(productId,sourceVariantId,safeText(b.image_url,500),safeText(b.product_name,220),safeText(b.sale_unit_label,180),1).run();const row=await db.prepare("SELECT id FROM product_photos WHERE product_id=?").bind(productId).first();return json({ok:true,id:row?.id},201);}
 catch(e){return json({error:String(e?.message||"Gagal menyimpan foto")},400);}
}
