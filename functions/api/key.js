import { json, requireDb } from "../../_lib/http.js";
import { getVapid } from "../../_lib/notify.js";

// Kunci publik VAPID untuk pendaftaran notifikasi di browser (aman dibuka publik).
export async function onRequestGet({ request, env }) {
  try {
    const vapid = await getVapid(requireDb(env), new URL(request.url).origin);
    return json({ publicKey: vapid.publicKey });
  } catch (error) {
    console.error("[push/key]", error?.message || error);
    return json({ error: "Notifikasi belum tersedia." }, 503);
  }
}
