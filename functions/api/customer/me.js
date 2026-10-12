import { json } from "../../_lib/http.js";
import { requireCustomer } from "../../_lib/customer-auth.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireCustomer(request, env);
  if (!auth.ok) return auth.response;
  return json({ authenticated: true, customer: auth.customer });
}
