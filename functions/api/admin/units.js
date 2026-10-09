import { json, readJson, requireDb, normalizeStatus, numberOr, safeText, toIntBool, sameOrigin } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
 const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;
 try{const {results=[]}=await requireDb(env).prepare(`SELECT u.*,v.sku_varian,v.merk,v.nama_varian,p.name AS product_name FROM sale_units u JOIN variants v ON v.id_varian=u.id_varian JOIN products p ON p.id=v.product_id ORDER BY p.name,v.sort_order,u.sort_order,u.id_satuan LIMIT 5000`).all();return json(results);}
 catch(e){return json({error:String(e?.message||"Gagal mengambil satuan")},503);}
}
export async function onRequestPost({request,env}){
 const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;if(!sameOrigin(request))return json({error:"Origin tidak diizinkan."},403);
 const b=await readJson(request);if(!b||!Number.isInteger(Number(b.id_varian))||!safeText(b.kode_satuan,60)||!safeText(b.nama_satuan,180))return json({error:"Varian, kode satuan, dan nama satuan wajib diisi."},400);
 const saleType=String(b.sale_type||"piece").toLowerCase();if(!["piece","pack","measure"].includes(saleType))return json({error:"sale_type harus piece, pack, atau measure."},400);
 try{const db=requireDb(env);const result=await db.prepare(`INSERT INTO sale_units (id_varian,kode_satuan,nama_satuan,sale_type,harga,allow_nominal_purchase,nominal_min,is_default,status,sort_order,keterangan) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(Number(b.id_varian),safeText(b.kode_satuan,60),safeText(b.nama_satuan,180),saleType,numberOr(b.harga),toIntBool(b.allow_nominal_purchase),b.nominal_min===""||b.nominal_min==null?null:numberOr(b.nominal_min),toIntBool(b.is_default),normalizeStatus(b.status,"active"),numberOr(b.sort_order),safeText(b.keterangan)).run();return json({ok:true,id:result.meta?.last_row_id},201);}
 catch(e){return json({error:String(e?.message||"Gagal membuat satuan")},400);}
}
