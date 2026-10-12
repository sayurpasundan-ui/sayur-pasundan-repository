import { allowedCodDistricts as parseDistricts, normalizePlace } from "./order-utils.js";

const DEFAULTS = {
  store_name: "SAYUR PASUNDAN",
  tagline: "Rencanakan Masakan Anda",
  whatsapp_phone: "081221031765",
  store_email: "sayurpasundan@gmail.com",
  warehouse_address: "Jl Panggilingan, Kp Pasir Angin, Desa Sukamantri, Kecamatan Paseh, Kabupaten Bandung, Jawa Barat 40383",
  warehouse_lat: "-7.059522",
  warehouse_lng: "107.764035",
  free_shipping_minimum: "50000",
  near_shipping_fee: "5000",
  far_shipping_fee: "10000",
  near_radius_km: "3",
  transfer_expiry_hours: "24",
  cod_max_order_total: "200000",
  cod_allowed_districts: "Paseh,Majalaya,Solokan Jeruk,Ciparay",
  cod_allowed_city: "Kabupaten Bandung",
  cod_allowed_province: "Jawa Barat",
  cod_enabled: "1"
};

const ENV_MAP = {
  store_name: "STORE_NAME",
  tagline: "STORE_TAGLINE",
  whatsapp_phone: "PUBLIC_WA_PHONE",
  cod_max_order_total: "COD_MAX_ORDER_TOTAL",
  cod_allowed_districts: "COD_ALLOWED_DISTRICTS",
  cod_allowed_city: "COD_ALLOWED_CITY",
  cod_allowed_province: "COD_ALLOWED_PROVINCE"
};

export async function readStoreSettings(db, env = {}) {
  const values = { ...DEFAULTS };
  for (const [key, envName] of Object.entries(ENV_MAP)) {
    if (env?.[envName] != null && String(env[envName]).trim()) values[key] = String(env[envName]).trim();
  }
  if (db) {
    try {
      const { results = [] } = await db.prepare("SELECT setting_key,setting_value FROM store_settings").all();
      for (const row of results) if (Object.hasOwn(DEFAULTS, row.setting_key) && row.setting_value != null) values[row.setting_key] = String(row.setting_value);
    } catch { /* Before migration 0004, defaults and environment are used. */ }
  }
  const n = key => Number.isFinite(Number(values[key])) ? Number(values[key]) : Number(DEFAULTS[key]);
  return {
    raw: values,
    storeName: values.store_name,
    tagline: values.tagline,
    whatsappPhone: values.whatsapp_phone,
    storeEmail: values.store_email,
    warehouseAddress: values.warehouse_address,
    warehouseLat: n("warehouse_lat"),
    warehouseLng: n("warehouse_lng"),
    freeShippingMinimum: Math.max(0, n("free_shipping_minimum")),
    nearShippingFee: Math.max(0, n("near_shipping_fee")),
    farShippingFee: Math.max(0, n("far_shipping_fee")),
    nearRadiusKm: Math.max(0, n("near_radius_km")),
    transferExpiryHours: Math.min(168, Math.max(1, n("transfer_expiry_hours"))),
    codMaxOrderTotal: Math.max(1, n("cod_max_order_total")),
    codAllowedDistricts: String(values.cod_allowed_districts || "").split(",").map(normalizePlace).filter(Boolean),
    codAllowedCity: values.cod_allowed_city,
    codAllowedProvince: values.cod_allowed_province,
    codEnabled: values.cod_enabled !== "0"
  };
}

export async function getRawStoreSettings(db, env = {}) {
  return (await readStoreSettings(db, env)).raw;
}

export function codDistrictsMatch(settings, district) {
  return settings.codAllowedDistricts.includes(normalizePlace(district));
}

export function codOrderError(settings, { district, city, province, hasCoordinates, total } = {}) {
  if (!codDistrictsMatch(settings, district)) {
    return "COD hanya tersedia di kecamatan Paseh, Majalaya, Solokan Jeruk, dan Ciparay.";
  }
  if (normalizePlace(city) !== normalizePlace(settings.codAllowedCity)) {
    return `COD hanya tersedia di ${settings.codAllowedCity}.`;
  }
  if (normalizePlace(province) !== normalizePlace(settings.codAllowedProvince)) {
    return `COD hanya tersedia di Provinsi ${settings.codAllowedProvince}.`;
  }
  if (!hasCoordinates) return "Lokasi pengantaran diperlukan untuk pesanan COD.";
  if (Number.isFinite(Number(total)) && Number(total) > settings.codMaxOrderTotal) {
    return `COD hanya tersedia untuk total pesanan maksimal Rp${settings.codMaxOrderTotal.toLocaleString("id-ID")}, termasuk ongkir.`;
  }
  return null;
}

export function allowedCodDistrictsFrom(settings) {
  return settings.codAllowedDistricts || parseDistricts({});
}
