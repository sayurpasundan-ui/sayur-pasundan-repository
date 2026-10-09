import { json } from "../../_lib/http.js";
import { requireAdmin } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireAdmin(request, env);
  return auth.ok ? json({ authenticated: true }) : auth.response;
}
