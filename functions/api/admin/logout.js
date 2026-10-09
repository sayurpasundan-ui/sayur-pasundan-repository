import { json, sameOrigin } from "../../_lib/http.js";
import { expiredSessionCookie } from "../../_lib/auth.js";
export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  return json({ ok: true }, 200, { "set-cookie": expiredSessionCookie() });
}
