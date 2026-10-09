export async function onRequestGet({env,params}){
 if(!env.PRODUCT_IMAGES)return new Response("Image storage is not configured",{status:503});
 const key=String(params.key||"").replace(/[^a-zA-Z0-9._-]/g,"");
 if(!key)return new Response("Not found",{status:404});
 const object=await env.PRODUCT_IMAGES.get(key);
 if(!object)return new Response("Not found",{status:404});
 const headers=new Headers();object.writeHttpMetadata(headers);headers.set("etag",object.httpEtag);headers.set("cache-control","public, max-age=31536000, immutable");
 return new Response(object.body,{headers});
}
