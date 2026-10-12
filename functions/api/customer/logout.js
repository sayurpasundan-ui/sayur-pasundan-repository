import { json, sameOrigin } from "../../_lib/http.js";
import { expiredCustomerSessionCookie } from "../../_lib/customer-auth.js";

export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json({ error: "Origin tidak diizinkan." }, 403);
  return json({ ok: true }, 200, { "set-cookie": expiredCustomerSessionCookie() });
}
