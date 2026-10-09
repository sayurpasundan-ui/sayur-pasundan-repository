import { json, readJson, requireDb, normalizeStatus, numberOr, safeText, sameOrigin } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
export async function onRequestPut({ request, env, params }) {
 const auth=await requireAdmin(request,env); if(!auth.ok)return auth.response; if(!sameOrigin(request))return json({error:"Origin tidak diizinkan."},403);
 const id=Number(params.id), b=await readJson(request); if(!Number.isInteger(id)||id<=0||!b||!Number.isInteger(Number(b.product_id))||!safeText(b.sku_varian,120))return json({error:"Data varian tidak lengkap."},400);
 try { await requireDb(env).prepare(`UPDATE variants SET product_id=?,sku_varian=?,merk=?,nama_varian=?,nama_produk_tampil=?,status=?,sort_order=?,keterangan=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id_varian=?`).bind(Number(b.product_id),safeText(b.sku_varian,120),safeText(b.merk,100),safeText(b.nama_varian,200),safeText(b.nama_produk_tampil,220),normalizeStatus(b.status,"active"),numberOr(b.sort_order),safeText(b.keterangan),id).run(); return json({ok:true}); }
 catch(e){return json({error:String(e?.message||"Gagal memperbarui varian")},400);}
}
export async function onRequestDelete({ request, env, params }) {
 const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;if(!sameOrigin(request))return json({error:"Origin tidak diizinkan."},403);const id=Number(params.id);if(!Number.isInteger(id)||id<=0)return json({error:"ID varian tidak valid."},400);
 try{await requireDb(env).prepare("UPDATE variants SET status='archived',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id_varian=?").bind(id).run();return json({ok:true,message:"Varian diarsipkan."});}catch{return json({error:"Varian gagal diarsipkan."},400);}
}
