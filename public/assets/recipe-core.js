// Logika inti "Masak Apa Hari Ini?" dan "Keranjang Kebutuhan Dapur".
// Dipakai bersama oleh browser (window.RecipeCore) dan server Functions (globalThis.RecipeCore).
// Tanpa DOM/jaringan agar mudah diuji. Membutuhkan units.js (SPUnits) untuk membaca satuan jual seperti "250 gram".
(function () {
  const root = typeof window !== "undefined" ? window : globalThis;

  // ---------- Waktu makan: pilihan pelanggan pada item rencana, BUKAN atribut resep ----------
  const MEAL_SLOTS = [
    { key: "sarapan", label: "Sarapan" },
    { key: "siang", label: "Makan siang" },
    { key: "malam", label: "Makan malam" }
  ];
  const PLAN_DAYS = [1, 3, 7];
  const ROTATION_GROUPS = ["Minggu 1", "Minggu 2", "Minggu 3"];
  const PROTEIN_TAGS = ["Ayam", "Ikan", "Telur", "Tahu", "Tempe", "Daging sapi", "Udang", "Bakso/Sosis", "Oncom"];

  const fmtNumber = (value, digits) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(value);

  // ---------- Takaran ----------
  function scaleAmount(amount, standardServings, chosenServings) {
    const a = Number(amount), s = Number(standardServings), c = Number(chosenServings);
    if (!(a > 0) || !(s > 0) || !(c > 0)) return 0;
    return Math.round(a * (c / s) * 10000) / 10000; // jumlah baru = jumlah standar x (porsi dipilih / porsi standar)
  }
  // Tidak membulatkan berlebihan: 2 desimal untuk angka kecil, bulat untuk >= 100.
  function formatAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return fmtNumber(n, n >= 100 ? 0 : 2);
  }
  const UNIT_ALIASES = { gr: "g", gram: "g", kilogram: "kg", kilo: "kg", liter: "l", ltr: "l", mililiter: "ml" };
  function normalizeUnit(unit) {
    const u = String(unit || "").trim().toLowerCase();
    return UNIT_ALIASES[u] || u;
  }
  // Keluarga satuan takaran resep: g/kg -> mass (dasar gram), ml/l -> volume (dasar ml), lainnya -> hitungan.
  function unitInfo(unit) {
    const u = normalizeUnit(unit);
    if (u === "g") return { family: "mass", canonical: "g", factor: 1 };
    if (u === "kg") return { family: "mass", canonical: "g", factor: 1000 };
    if (u === "ml") return { family: "volume", canonical: "ml", factor: 1 };
    if (u === "l") return { family: "volume", canonical: "ml", factor: 1000 };
    return { family: "count", canonical: u, factor: 1 };
  }
  // Tampilan ramah: 1.250 g -> "1,25 kg"; hitungan tetap apa adanya.
  function displayQuantity(amount, unit) {
    const info = unitInfo(unit), base = Number(amount) * info.factor;
    if (info.family === "mass" && base >= 1000) return `${fmtNumber(base / 1000, 3)} kg`;
    if (info.family === "volume" && base >= 1000) return `${fmtNumber(base / 1000, 3)} liter`;
    return `${formatAmount(info.family === "count" ? Number(amount) : base)} ${info.family === "count" ? unit : info.canonical}`;
  }
  const normalizeKey = name => String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  // ---------- Penggabungan bahan dari rencana ----------
  // entries: [{ recipe, servings }]  ->  baris bahan. Satuan sama (atau kompatibel g/kg, ml/l) dijumlahkan;
  // satuan tidak kompatibel (mis. butir vs g) TIDAK dijumlahkan dan menjadi baris terpisah.
  function aggregateIngredients(entries) {
    const lines = new Map();
    for (const entry of entries || []) {
      const recipe = entry.recipe, servings = Number(entry.servings) || recipe.servings;
      for (const ing of recipe.ingredients || []) {
        const info = unitInfo(ing.unit), key = ing.key || normalizeKey(ing.name);
        const amount = scaleAmount(ing.amount, recipe.servings, servings) * info.factor;
        const id = `${key}|${info.canonical}`;
        if (!lines.has(id)) lines.set(id, { id, key, name: ing.name, unit: info.canonical, family: info.family, amount: 0, optionalCount: 0, requiredCount: 0, sources: [] });
        const line = lines.get(id);
        line.amount = Math.round((line.amount + amount) * 10000) / 10000;
        if (ing.optional) line.optionalCount++; else line.requiredCount++;
        line.sources.push({ recipe_id: recipe.id, recipe_name: recipe.name, servings, amount: Math.round(amount * 10000) / 10000, unit: info.canonical, optional: Boolean(ing.optional) });
      }
    }
    return [...lines.values()].map(line => ({ ...line, optional: line.requiredCount === 0, display: displayQuantity(line.amount, line.unit) }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }

  // ---------- Konversi takaran resep -> satuan jual toko ----------
  // Mengembalikan berapa "satuan resep dasar" (g/ml/butir/...) yang terkandung dalam SATU satuan jual,
  // atau null jika tidak bisa dipastikan. Urutan: faktor eksplisit dari admin -> satuan massa/volume yang sama
  // -> kata satuan identik (mis. "1 ikat"). Selain itu TIDAK ditebak.
  function unitsPerSaleUnit(recipeUnit, saleLabel, explicitFactors) {
    const info = unitInfo(recipeUnit);
    const explicit = explicitFactors && Number(explicitFactors[info.canonical]);
    if (explicit > 0) return { value: explicit, basis: "admin" };
    const SP = root.SPUnits;
    if (info.family !== "count") {
      const parsed = SP && SP.parse(saleLabel);
      const type = info.family;
      if (parsed && parsed.type === type && parsed.base > 0) return { value: parsed.base, basis: "satuan" };
      return null;
    }
    const label = String(saleLabel || "").toLowerCase(), word = info.canonical;
    if (word && new RegExp(`(^|[^a-z])${word}($|[^a-z])`).test(label)) {
      const m = label.match(/(\d+(?:[.,]\d+)?)\s*[a-z]+/);
      const n = m ? Number(m[1].replace(",", ".")) : 1;
      return n > 0 ? { value: n, basis: "kata" } : null;
    }
    return null;
  }

  // Berapa satuan jual yang harus dibeli. Dibulatkan ke atas sesuai kelipatan minimum (measure = 0,5; lainnya = 1).
  function purchaseFor(amount, recipeUnit, sale, explicitFactors) {
    const per = unitsPerSaleUnit(recipeUnit, sale.nama_satuan, explicitFactors);
    if (!per) return null;
    const step = String(sale.sale_type).toLowerCase() === "measure" ? 0.5 : 1;
    const needUnits = amount / per.value;
    const quantity = Math.max(step, Math.ceil(needUnits / step - 1e-9) * step);
    const covered = quantity * per.value;
    return { quantity, step, per_unit: per.value, basis: per.basis, need_units: needUnits, covered, leftover: Math.max(0, covered - amount) };
  }

  // ---------- Rencana menu ----------
  function emptyPlan(days = 3) { return { version: 1, days: PLAN_DAYS.includes(Number(days)) ? Number(days) : 3, items: [] }; }
  function normalizePlan(plan) {
    const out = emptyPlan(plan && plan.days);
    const valid = new Set(MEAL_SLOTS.map(s => s.key)), seen = new Set();
    for (const item of (plan && plan.items) || []) {
      const day = Number(item.day), slot = String(item.slot);
      const id = `${day}:${slot}`;
      if (!(day >= 1 && day <= out.days) || !valid.has(slot) || seen.has(id) || !item.recipe_id) continue;
      seen.add(id);
      out.items.push({ day, slot, recipe_id: String(item.recipe_id), servings: Math.max(1, Math.min(20, Math.round(Number(item.servings)) || 0)) || 1 });
    }
    return out;
  }
  const planItem = (plan, day, slot) => plan.items.find(i => i.day === day && i.slot === slot) || null;
  function setSlot(plan, day, slot, recipe, servings) {
    const next = normalizePlan({ ...plan, items: plan.items.filter(i => !(i.day === day && i.slot === slot)) });
    if (recipe) next.items.push({ day, slot, recipe_id: recipe.id, servings: Number(servings) || recipe.servings });
    return next;
  }
  function clearSlot(plan, day, slot) { return setSlot(plan, day, slot, null); }
  function setDays(plan, days) { return normalizePlan({ ...plan, days }); } // item di luar rentang hari dibuang

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }
  // Rotasi hanya urutan rekomendasi; semua resep tetap boleh dipilih di slot mana pun.
  function rotationGroupFor(date) { return ROTATION_GROUPS[isoWeek(date || new Date()) % ROTATION_GROUPS.length]; }

  function shuffled(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const mainTag = recipe => (recipe.tags || []).find(t => PROTEIN_TAGS.includes(t)) || "";

  // Mengisi slot kosong (atau semua slot bila onlyEmpty=false). Tidak mengulang resep selama masih ada pilihan lain.
  function suggestPlan(plan, recipes, options = {}) {
    const rng = options.rng || Math.random, onlyEmpty = options.onlyEmpty !== false;
    const visible = recipes.filter(r => r.visible !== false);
    const group = options.rotation === "all" ? null : (ROTATION_GROUPS.includes(options.rotation) ? options.rotation : rotationGroupFor(options.date));
    const primary = shuffled(visible.filter(r => !group || r.rotation === group), rng);
    const secondary = shuffled(visible.filter(r => group && r.rotation !== group), rng);
    let next = normalizePlan(plan);
    if (!onlyEmpty) next = { ...next, items: [] };
    const used = new Map(next.items.map(i => [i.recipe_id, 1]));
    let previousTag = "";
    for (let day = 1; day <= next.days; day++) {
      for (const slot of MEAL_SLOTS) {
        if (planItem(next, day, slot.key)) { const r = recipes.find(x => x.id === planItem(next, day, slot.key).recipe_id); previousTag = r ? mainTag(r) : ""; continue; }
        const fresh = [...primary, ...secondary].filter(r => !used.has(r.id));
        let pool = fresh;
        if (!pool.length) { // semua sudah terpakai: pakai resep yang paling jarang dipakai
          const min = Math.min(...visible.map(r => used.get(r.id) || 0));
          pool = shuffled(visible.filter(r => (used.get(r.id) || 0) === min), rng);
        }
        if (!pool.length) continue;
        const pick = pool.find(r => !previousTag || mainTag(r) !== previousTag) || pool[0]; // hindari lauk utama sama berurutan bila bisa
        used.set(pick.id, (used.get(pick.id) || 0) + 1);
        previousTag = mainTag(pick);
        next.items.push({ day, slot: slot.key, recipe_id: pick.id, servings: pick.servings });
      }
    }
    return normalizePlan(next);
  }

  // Satu resep acak untuk SATU slot, menghindari resep yang sudah ada di rencana (dan resep slot itu sendiri).
  function suggestSlot(plan, day, slot, recipes, options = {}) {
    const rng = options.rng || Math.random, visible = recipes.filter(r => r.visible !== false);
    const group = options.rotation === "all" ? null : (ROTATION_GROUPS.includes(options.rotation) ? options.rotation : rotationGroupFor(options.date));
    const current = planItem(plan, day, slot), usedIds = new Set(plan.items.map(i => i.recipe_id));
    const prefer = visible.filter(r => (!group || r.rotation === group) && !usedIds.has(r.id));
    const others = visible.filter(r => !usedIds.has(r.id));
    const fallback = visible.filter(r => !current || r.id !== current.recipe_id);
    const pool = prefer.length ? prefer : others.length ? others : fallback;
    return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
  }

  // Ringkasan rencana -> entri untuk aggregateIngredients
  function planEntries(plan, recipesById) {
    return normalizePlan(plan).items.map(i => ({ recipe: recipesById[i.recipe_id], servings: i.servings, item: i })).filter(e => e.recipe);
  }

  root.RecipeCore = { MEAL_SLOTS, PLAN_DAYS, ROTATION_GROUPS, scaleAmount, formatAmount, normalizeUnit, unitInfo, displayQuantity, normalizeKey,
    aggregateIngredients, unitsPerSaleUnit, purchaseFor, emptyPlan, normalizePlan, planItem, setSlot, clearSlot, setDays, rotationGroupFor, suggestPlan, suggestSlot, planEntries };
})();
