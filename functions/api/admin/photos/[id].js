import { json, readJson, requireDb, numberOr, safeText, toIntBool, sameOrigin } from "../../../_lib/http.js";
import { requireAdmin } from "../../../_lib/auth.js";
export async function onRequestPut({request,env,params}){
 const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;if(!sameOrigin(request))return json({error:"Origin tidak diizinkan."},403);
 const id=Number(params.id),b=await readJson(request);if(!Number.isInteger(id)||id<=0||!b||!Number.isInteger(Number(b.product_id))||Number(b.product_id)<=0||!safeText(b.image_url,500))return json({error:"Data foto tidak lengkap. Produk dan URL/path foto wajib diisi."},400);
 try{await requireDb(env).prepare(`UPDATE product_photos SET product_id=?,source_variant_id=?,image_url=?,product_name=?,sale_unit_label=?,is_primary=? WHERE id=?`).bind(Number(b.product_id),Number(b.source_variant_id)>0?Number(b.source_variant_id):null,safeText(b.image_url,500),safeText(b.product_name,220),safeText(b.sale_unit_label,180),1,id).run();return json({ok:true});}
 catch(e){return json({error:String(e?.message||"Gagal memperbarui foto")},400);}
}
export async function onRequestDelete({request,env,params}){
 const auth=await requireAdmin(request,env);if(!auth.ok)return auth.response;if(!sameOrigin(request))return json({error:"Origin tidak diizinkan."},403);
 const id=Number(params.id);if(!Number.isInteger(id)||id<=0)return json({error:"ID foto tidak valid."},400);
 try{await requireDb(env).prepare(`DELETE FROM product_photos WHERE id=?`).bind(id).run();return json({ok:true});}
 catch(e){return json({error:String(e?.message||"Gagal menghapus foto")},400);}
}
