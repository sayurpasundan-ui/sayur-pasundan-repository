import { json } from "../_lib/http.js";
import { readStoreSettings } from "../_lib/store-config.js";

function normalizeWhatsApp(value) {
  const digits = String(value || "081221031765").replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}
export async function onRequestGet({ env }) {
  const settings = await readStoreSettings(env?.DB, env);
  return json({
    storeName: settings.storeName,
    tagline: settings.tagline,
    whatsappPhone: normalizeWhatsApp(settings.whatsappPhone),
    storeEmail: settings.storeEmail,
    warehouseAddress: settings.warehouseAddress,
    warehouseLat: settings.warehouseLat,
    warehouseLng: settings.warehouseLng,
    codMaxOrderTotal: settings.codMaxOrderTotal,
    freeShippingMinimum: settings.freeShippingMinimum,
    nearShippingFee: settings.nearShippingFee,
    farShippingFee: settings.farShippingFee,
    nearRadiusKm: settings.nearRadiusKm,
    codAllowedDistricts: settings.codAllowedDistricts,
    codAllowedCity: settings.codAllowedCity,
    codAllowedProvince: settings.codAllowedProvince,
    codEnabled: settings.codEnabled,
    transferExpiryHours: settings.transferExpiryHours,
  });
}
