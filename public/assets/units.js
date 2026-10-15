// Konversi satuan jual (gram, kg, ons, ml, liter) dan hitungan keranjang.
(function () {
  const FAMILY = { kilogram: ["mass", 1000], kilo: ["mass", 1000], kg: ["mass", 1000], gram: ["mass", 1], gr: ["mass", 1], g: ["mass", 1], ons: ["mass", 100],
    liter: ["volume", 1000], l: ["volume", 1], ml: ["volume", 1] };
  FAMILY.l = ["volume", 1000];
  const NAMES = "kilogram|kilo|kg|gram|gr|ons|liter|ml|g|l";
  const fmt = (value, digits = 2) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(value);

  // "250 gram" -> {type:"mass", base:250}; "kg" -> {type:"mass", base:1000}; "botol 275 ml" -> {type:"volume", base:275}
  function parse(label) {
    const text = String(label || "").toLowerCase().replace(",", ".");
    let m = text.match(new RegExp("(\\d+(?:\\.\\d+)?)\\s*(" + NAMES + ")\\b"));
    let amount = 1, name;
    if (m) { amount = Number(m[1]); name = m[2]; }
    else { m = text.match(new RegExp("\\b(" + NAMES + ")\\b")); if (!m) return null; name = m[1]; }
    const family = FAMILY[name]; if (!family || !(amount > 0)) return null;
    return { type: family[0], base: amount * family[1] };
  }

  // Berapa isi total untuk sejumlah satuan, mis. ("250 gram", 0.5) -> "125 gram"; ("1 kg", 1.5) -> "1,5 kg"
  function describe(label, quantity) {
    const info = parse(label), q = Number(quantity);
    if (!info || !Number.isFinite(q) || q <= 0) return "";
    const total = info.base * q;
    if (info.type === "mass") return total >= 1000 ? `${fmt(total / 1000, 3)} kg` : `${fmt(total, 1)} gram`;
    return total >= 1000 ? `${fmt(total / 1000, 3)} liter` : `${fmt(total, 1)} ml`;
  }

  // Item yang dihitung per baris (satuan bisa dipecah, atau beli nominal): 0,5 maupun 1,5 tetap dihitung 1.
  // Satuan bulat (pcs, ikat, ...) dihitung sesuai jumlahnya.
  function cartCount(items) {
    return (items || []).reduce((sum, item) => sum + (item.nominal_amount || Number(item.quantity_step) < 1 ? 1 : Number(item.quantity || 0)), 0);
  }

  (typeof window !== "undefined" ? window : globalThis).SPUnits = { parse, describe, cartCount, fmt };
})();
