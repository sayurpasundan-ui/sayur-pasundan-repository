// "Masak Apa Hari Ini?" — pilih resep, susun rencana 1/3/7 hari, tentukan sendiri waktu makan tiap resep.
// Rencana disimpan di perangkat pelanggan (localStorage). Resep dibaca dari /api/recipes.
(function () {
  "use strict";
  const RC = window.RecipeCore;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const PLAN_KEY = "sp-meal-plan-v1", HOUSE_KEY = "sp-meal-servings-v1", ROT_KEY = "sp-meal-rotation-v1", CART_KEY = "sayur-pasundan-cart-v1";
  const PLACEHOLDER = "/assets/images/brand/resep-placeholder.svg";
  const PAGE = 12;
  const store = {
    read(key, fallback) { try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* mode privat: rencana hanya bertahan selama halaman terbuka */ } }
  };
  const state = {
    all: [], byId: {}, facets: [], loaded: false, error: false,
    plan: RC.normalizePlan(store.read(PLAN_KEY, null)), day: 1, q: "", tags: new Set(), shown: PAGE,
    household: Number(store.read(HOUSE_KEY, 0)) || 0, rotation: String(store.read(ROT_KEY, "auto")),
    target: null, detail: null, pick: null, detailCache: {}, lastFocus: null
  };

  async function getJson(url) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
    return data;
  }
  function toast(text) {
    const el = $("#toast"); if (!el) return;
    el.textContent = text; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  const mealLabel = key => (RC.MEAL_SLOTS.find(s => s.key === key) || {}).label || key;
  const defaultServings = recipe => state.household || recipe.servings;
  const clampServings = n => Math.max(1, Math.min(20, Math.round(Number(n)) || 1));

  function savePlan(plan) {
    state.plan = RC.normalizePlan(plan);
    if (state.day > state.plan.days) state.day = state.plan.days;
    store.write(PLAN_KEY, state.plan);
    renderPlan();
  }

  // ---------- Foto: tersedia / belum tersedia / gagal dimuat ----------
  function toneOf(recipe) { const t = (recipe.tags || [])[0] || ""; return t.toLowerCase().replace(/[^a-z]+/g, "-"); }
  function photoHtml(recipe, extra = "") {
    const photo = recipe.photo || {};
    if (photo.url) return `<div class="rp-photo ${extra}" data-tone="${esc(toneOf(recipe))}"><img src="${esc(photo.url)}" alt="${esc(photo.alt || "Foto masakan " + recipe.name)}" loading="lazy" decoding="async" data-photo-img></div>`;
    return `<div class="rp-photo rp-photo-empty ${extra}" data-tone="${esc(toneOf(recipe))}"><img src="${PLACEHOLDER}" alt="" loading="lazy" decoding="async"><span class="rp-photo-note">Foto belum tersedia</span></div>`;
  }
  // Foto gagal dimuat -> ganti dengan gambar pengganti tanpa merusak tata letak
  document.addEventListener("error", event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-photo-img")) return;
    img.removeAttribute("data-photo-img"); img.alt = ""; img.src = PLACEHOLDER;
    const box = img.closest(".rp-photo");
    if (box) { box.classList.add("rp-photo-empty", "rp-photo-failed"); if (!$(".rp-photo-note", box)) box.insertAdjacentHTML("beforeend", `<span class="rp-photo-note">Foto belum tersedia</span>`); }
  }, true);

  const difficultyChip = recipe => `<span class="rp-chip ${recipe.difficulty === "Mudah" ? "mudah" : "sedang"}">${esc(recipe.difficulty)}</span>`;
  const metaChips = (recipe, servings) => `<div class="rp-meta"><span class="rp-chip">${recipe.total_minutes} menit</span>${difficultyChip(recipe)}<span class="rp-chip">${servings || recipe.servings} porsi</span></div>`;

  // ---------- Keranjang (hanya lencana jumlah; keranjang tetap milik website) ----------
  function renderCartBadge() {
    let count = 0;
    try { const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); count = window.SPUnits ? SPUnits.cartCount(Array.isArray(cart) ? cart : []) : 0; } catch { /* abaikan */ }
    const badge = $("#cartBadge"); if (badge) badge.textContent = String(Math.round(count * 100) / 100);
  }

  // ---------- Kontrol ----------
  function renderControls() {
    $$("#periodSeg button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.days) === state.plan.days)));
    const house = $("#householdServings");
    house.innerHTML = `<option value="0">Sesuai porsi resep</option>` + Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1} orang</option>`).join("");
    house.value = String(state.household);
    const rot = $("#rotationSelect"), now = RC.rotationGroupFor(new Date());
    rot.innerHTML = `<option value="auto">Rekomendasi minggu ini (${now})</option>` + RC.ROTATION_GROUPS.map(g => `<option value="${g}">${g}</option>`).join("") + `<option value="all">Semua resep</option>`;
    rot.value = state.rotation;
  }

  // ---------- Rencana ----------
  function renderPlan() {
    const plan = state.plan;
    $("#dayTabs").innerHTML = Array.from({ length: plan.days }, (_, i) => {
      const day = i + 1, filled = plan.items.filter(item => item.day === day).length;
      return `<button type="button" class="rp-day" role="tab" aria-selected="${day === state.day}" data-day="${day}">Hari ${day}<small>${filled}/3 terisi</small></button>`;
    }).join("");
    $("#daySlots").innerHTML = RC.MEAL_SLOTS.map(slot => slotHtml(state.day, slot)).join("");
    const banner = $("#targetBanner");
    if (state.target) { banner.hidden = false; banner.innerHTML = `<span>Memilih untuk <b>Hari ${state.target.day} · ${esc(mealLabel(state.target.slot))}</b>. Ketuk “Pilih Menu” pada resep di bawah.</span><button type="button" class="rp-link" data-act="cancel-target">Batal</button>`; }
    else banner.hidden = true;
    const total = plan.days * 3, filledAll = plan.items.length, bar = $("#planBar");
    bar.hidden = filledAll === 0;
    $("#barTitle").textContent = `${filledAll} menu dalam rencana`;
    $("#barSub").textContent = `${plan.days} hari · ${filledAll} dari ${total} waktu makan terisi`;
    renderControls();
  }
  function slotHtml(day, slot) {
    const item = RC.planItem(state.plan, day, slot.key), head = (extra = "") => `<div class="rp-slot-head"><strong>${esc(slot.label)}</strong>${extra}</div>`;
    const attrs = `data-day="${day}" data-slot="${slot.key}"`;
    if (!item) return `<article class="rp-slot" ${attrs}>${head()}<div class="rp-slot-empty"><span>Belum ada menu</span><button type="button" class="button button-orange" data-act="choose">Pilih resep</button><button type="button" class="rp-link" data-act="shuffle">Acak slot ini</button></div></article>`;
    const recipe = state.byId[item.recipe_id];
    if (!recipe) return `<article class="rp-slot" ${attrs}>${head(`<button type="button" class="rp-link danger" data-act="clear">Kosongkan</button>`)}<div class="rp-slot-empty"><span>Resep ini sudah tidak tersedia. Kosongkan lalu pilih resep lain.</span></div></article>`;
    return `<article class="rp-slot" ${attrs}>${head(`<button type="button" class="rp-link danger" data-act="clear">Kosongkan</button>`)}
      <div class="rp-slot-recipe">${photoHtml(recipe, "thumb")}<div>
        <h3>${esc(recipe.name)}</h3>${metaChips(recipe, item.servings)}
        <div class="rp-portion" style="margin-top:8px"><span>Porsi</span><div class="rp-stepper"><button type="button" data-act="serv-" aria-label="Kurangi porsi">−</button><b>${item.servings}</b><button type="button" data-act="serv+" aria-label="Tambah porsi">+</button></div></div>
        <div class="rp-slot-actions"><button type="button" class="rp-link" data-act="view">Lihat resep</button><button type="button" class="rp-link" data-act="choose">Ganti</button><button type="button" class="rp-link" data-act="shuffle">Acak</button></div>
      </div></div></article>`;
  }

  function assign(day, slot, recipe, servings) {
    savePlan(RC.setSlot(state.plan, day, slot, recipe, servings || defaultServings(recipe)));
  }
  function runSuggest(onlyEmpty) {
    if (!state.loaded || !state.all.length) { toast("Resep belum dimuat. Coba lagi sebentar."); return; }
    const before = RC.normalizePlan(state.plan);
    if (onlyEmpty && before.items.length >= before.days * 3) { toast("Semua waktu makan sudah terisi. Gunakan “Acak ulang semua” bila ingin mengganti."); return; }
    let next = RC.suggestPlan(before, state.all, { rotation: state.rotation, onlyEmpty });
    const kept = new Set(before.items.map(i => `${i.day}:${i.slot}`));
    if (state.household) next = { ...next, items: next.items.map(i => (onlyEmpty && kept.has(`${i.day}:${i.slot}`)) ? i : { ...i, servings: state.household }) };
    const counts = next.items.reduce((m, i) => (m[i.recipe_id] = (m[i.recipe_id] || 0) + 1, m), {});
    const repeated = Object.values(counts).some(n => n > 1);
    savePlan(next);
    toast(repeated ? "Menu diacak. Resep terbatas, sebagian terpaksa berulang." : "Menu berhasil diacak tanpa pengulangan.");
  }

  // ---------- Daftar resep ----------
  function filteredRecipes() {
    const q = state.q.trim().toLowerCase();
    return state.all.filter(r => (!q || r.name.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)) || r.description.toLowerCase().includes(q))
      && [...state.tags].every(t => r.tags.includes(t)));
  }
  function renderChips() {
    const facets = state.facets.slice(0, 14);
    $("#tagChips").innerHTML = `<button type="button" class="rp-filter" data-tag="" aria-pressed="${state.tags.size === 0}">Semua</button>` +
      facets.map(f => `<button type="button" class="rp-filter" data-tag="${esc(f.tag)}" aria-pressed="${state.tags.has(f.tag)}">${esc(f.tag)} <small>${f.count}</small></button>`).join("");
  }
  function renderGrid() {
    const grid = $("#recipeGrid"), more = $("#loadMore"), count = $("#browseCount");
    if (state.error) {
      grid.innerHTML = `<div class="rp-state" style="grid-column:1/-1"><strong>Resep belum dapat dimuat</strong>Periksa koneksi internet Anda, lalu coba lagi.<br><button type="button" class="button button-orange" id="retryLoad" style="margin-top:12px">Coba lagi</button></div>`;
      more.hidden = true; count.textContent = "Gagal memuat resep."; return;
    }
    if (!state.loaded) { grid.innerHTML = Array.from({ length: 8 }, () => `<div class="rp-skeleton"></div>`).join(""); more.hidden = true; count.textContent = "Memuat resep…"; return; }
    const list = filteredRecipes();
    count.textContent = list.length === state.all.length ? `${list.length} resep` : `${list.length} dari ${state.all.length} resep`;
    if (!list.length) { grid.innerHTML = `<div class="rp-state" style="grid-column:1/-1"><strong>Resep tidak ditemukan</strong>Coba kata kunci lain atau hapus filter.<br><button type="button" class="button button-ghost" id="resetFilters" style="margin-top:12px">Hapus pencarian</button></div>`; more.hidden = true; return; }
    const visible = list.slice(0, state.shown);
    grid.innerHTML = visible.map(r => `<article class="rp-card" data-id="${esc(r.id)}">${photoHtml(r)}<div class="rp-card-body"><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p>${metaChips(r)}
      <div class="rp-card-buttons"><button type="button" class="button button-ghost" data-act="view">Lihat Resep</button><button type="button" class="button button-orange" data-act="pick">Pilih Menu</button></div></div></article>`).join("");
    more.hidden = list.length <= state.shown;
    more.textContent = `Tampilkan lebih banyak (${list.length - state.shown} lagi)`;
  }

  // ---------- Lembar dialog ----------
  function openSheet(backdrop) { state.lastFocus = document.activeElement; backdrop.hidden = false; document.body.style.overflow = "hidden"; const first = $("button, [href]", backdrop); if (first) first.focus(); }
  function closeSheets() {
    ["#detailBackdrop", "#pickBackdrop"].forEach(id => { $(id).hidden = true; });
    document.body.style.overflow = ""; state.pick = null;
    if (state.lastFocus && state.lastFocus.focus) { try { state.lastFocus.focus(); } catch { /* elemen sudah tidak ada */ } }
  }
  document.addEventListener("keydown", event => { if (event.key === "Escape" && (!$("#detailBackdrop").hidden || !$("#pickBackdrop").hidden)) { if (!$("#pickBackdrop").hidden) { $("#pickBackdrop").hidden = true; state.pick = null; } else closeSheets(); } });

  function ingredientRows(recipe, servings) {
    return recipe.ingredients.map(i => {
      const amount = RC.scaleAmount(i.amount, recipe.servings, servings);
      return `<li><span>${esc(i.name)}${i.optional ? `<span class="opt">opsional</span>` : ""}${i.note && !i.optional ? `<small> · ${esc(i.note)}</small>` : ""}</span><b>${esc(RC.displayQuantity(amount, i.unit))}</b></li>`;
    }).join("");
  }
  function detailHtml(recipe, servings) {
    const list = items => `<ul class="rp-list">${items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;
    const notes = [recipe.cooking_note, ...(recipe.serving_tips || [])].filter(Boolean);
    return `<div class="rp-sheet-head"><h2 id="detailHeading">Resep</h2><button type="button" class="rp-close" data-act="close" aria-label="Tutup">×</button></div>
      <div class="rp-sheet-body rp-detail">
        ${photoHtml(recipe, "rp-detail-photo")}
        <div><h3 class="rp-title">${esc(recipe.name)}</h3><p class="rp-desc">${esc(recipe.description)}</p>
          <div class="rp-meta" style="margin-top:10px"><span class="rp-chip">Persiapan ${recipe.prep_minutes} mnt</span><span class="rp-chip">Memasak ${recipe.cook_minutes} mnt</span><span class="rp-chip">Total ${recipe.total_minutes} mnt</span>${difficultyChip(recipe)}</div>
          <div class="rp-meta" style="margin-top:8px">${recipe.tags.map(t => `<span class="rp-chip">${esc(t)}</span>`).join("")}</div></div>
        <div class="rp-portion-box"><span>Masak untuk<small>Porsi standar resep: ${recipe.servings} orang</small></span><div class="rp-stepper"><button type="button" data-act="detail-serv-" aria-label="Kurangi porsi">−</button><b id="detailServings">${servings}</b><button type="button" data-act="detail-serv+" aria-label="Tambah porsi">+</button></div></div>
        <section class="rp-block"><h3>Bahan-bahan <small id="ingScale" style="font-weight:600;color:var(--muted)">(untuk ${servings} orang)</small></h3><ul class="rp-ingredients" id="ingredientList">${ingredientRows(recipe, servings)}</ul></section>
        ${(recipe.tools || []).length ? `<section class="rp-block"><h3>Alat yang diperlukan</h3>${list(recipe.tools)}</section>` : ""}
        <section class="rp-block"><h3>Langkah memasak</h3><ol class="rp-steps">${recipe.steps.map(s => `<li>${esc(s.replace(/^\d+\.\s*/, ""))}</li>`).join("")}</ol></section>
        ${(recipe.doneness || []).length ? `<section class="rp-block"><h3>Tanda masakan sudah matang</h3><div class="rp-note ok">${recipe.doneness.map(esc).join("<br>")}</div></section>` : ""}
        ${notes.length ? `<section class="rp-block"><h3>Tips</h3><div class="rp-note">${notes.map(esc).join("<br>")}</div></section>` : ""}
        <p class="rp-foot">Takaran adalah panduan awal resep rumahan; cicipi dan sesuaikan selera. Resep bukan nasihat gizi atau diet khusus. Periksa alergi dan pastikan bahan hewani matang sempurna.</p>
      </div>
      <div class="rp-sheet-foot"><button type="button" class="button button-ghost" data-act="close">Tutup</button><button type="button" class="button button-orange" data-act="detail-pick">Pilih Menu</button></div>`;
  }
  async function openDetail(id, servings) {
    const sheet = $("#detailSheet"), backdrop = $("#detailBackdrop");
    sheet.innerHTML = `<div class="rp-sheet-head"><h2 id="detailHeading">Memuat resep…</h2><button type="button" class="rp-close" data-act="close" aria-label="Tutup">×</button></div><div class="rp-sheet-body"><div class="rp-skeleton"></div></div>`;
    openSheet(backdrop);
    try {
      const recipe = state.detailCache[id] || (state.detailCache[id] = await getJson(`/api/recipes/${encodeURIComponent(id)}`));
      state.detail = { recipe, servings: clampServings(servings || defaultServings(recipe)) };
      sheet.innerHTML = detailHtml(recipe, state.detail.servings);
      const first = $(".rp-close", sheet); if (first) first.focus();
    } catch (error) {
      sheet.innerHTML = `<div class="rp-sheet-head"><h2 id="detailHeading">Resep</h2><button type="button" class="rp-close" data-act="close" aria-label="Tutup">×</button></div><div class="rp-sheet-body"><div class="rp-state"><strong>Resep belum dapat dibuka</strong>${esc(error.message || "Coba lagi.")}</div></div>`;
    }
  }
  function updateDetailServings(delta) {
    if (!state.detail) return;
    state.detail.servings = clampServings(state.detail.servings + delta);
    $("#detailServings").textContent = state.detail.servings;
    $("#ingScale").textContent = `(untuk ${state.detail.servings} orang)`;
    $("#ingredientList").innerHTML = ingredientRows(state.detail.recipe, state.detail.servings);
  }

  // Pilih Menu: pelanggan memilih hari DAN waktu makan sendiri (resep tidak terkunci)
  function firstEmptySlot() {
    for (let day = 1; day <= state.plan.days; day++) for (const slot of RC.MEAL_SLOTS) if (!RC.planItem(state.plan, day, slot.key)) return { day, slot: slot.key };
    return { day: state.day, slot: "sarapan" };
  }
  function openPick(recipe, servings) {
    if (state.target) { // sedang mengisi slot tertentu: langsung simpan
      const { day, slot } = state.target; state.target = null;
      assign(day, slot, recipe, servings); state.day = day; renderPlan(); toast(`${recipe.name} → Hari ${day} · ${mealLabel(slot)}`); closeSheets(); return;
    }
    const preset = firstEmptySlot();
    state.pick = { recipe, day: preset.day, slot: preset.slot, servings: clampServings(servings || defaultServings(recipe)) };
    renderPick(); openSheet($("#pickBackdrop"));
  }
  function renderPick() {
    const p = state.pick; if (!p) return;
    const dayButtons = Array.from({ length: state.plan.days }, (_, i) => `<button type="button" data-pick-day="${i + 1}" aria-pressed="${p.day === i + 1}">Hari ${i + 1}</button>`).join("");
    const slotButtons = RC.MEAL_SLOTS.map(s => {
      const current = RC.planItem(state.plan, p.day, s.key), name = current && state.byId[current.recipe_id] ? state.byId[current.recipe_id].name : "";
      return `<button type="button" data-pick-slot="${s.key}" aria-pressed="${p.slot === s.key}">${esc(s.label)}<small>${name ? "Terisi: " + esc(name) : "Masih kosong"}</small></button>`;
    }).join("");
    $("#pickSheet").innerHTML = `<div class="rp-sheet-head"><h2 id="pickHeading">Pilih Menu</h2><button type="button" class="rp-close" data-act="close-pick" aria-label="Tutup">×</button></div>
      <div class="rp-sheet-body"><div class="kd-recipe" style="grid-template-columns:84px 1fr">${photoHtml(p.recipe)}<div><h3>${esc(p.recipe.name)}</h3><small>${p.recipe.total_minutes} menit · ${esc(p.recipe.difficulty)}</small></div></div>
        <div><span class="rp-label">Untuk hari ke-</span><div class="rp-choice">${dayButtons}</div></div>
        <div><span class="rp-label">Untuk waktu makan</span><div class="rp-choice">${slotButtons}</div></div>
        <div class="rp-portion-box"><span>Masak untuk<small>Porsi standar: ${p.recipe.servings} orang</small></span><div class="rp-stepper"><button type="button" data-act="pick-serv-" aria-label="Kurangi porsi">−</button><b>${p.servings}</b><button type="button" data-act="pick-serv+" aria-label="Tambah porsi">+</button></div></div>
        <p class="rp-foot">Resep ini bisa dipakai untuk sarapan, makan siang, maupun makan malam. Jika waktu makan yang dipilih sudah terisi, resep lama akan diganti.</p></div>
      <div class="rp-sheet-foot"><button type="button" class="button button-ghost" data-act="close-pick">Batal</button><button type="button" class="button button-orange" data-act="pick-save">Simpan ke rencana</button></div>`;
  }

  // ---------- Event ----------
  function slotContext(el) { const slot = el.closest("[data-slot]"); return slot ? { day: Number(slot.dataset.day), slot: slot.dataset.slot } : null; }
  function recipeIdOf(el) { const card = el.closest("[data-id]"); return card ? card.dataset.id : null; }

  document.addEventListener("click", event => {
    const el = event.target.closest("button, a, [data-act]"); if (!el) return;
    const act = el.dataset.act;
    if (el.matches("#periodSeg button")) { savePlan(RC.setDays(state.plan, Number(el.dataset.days))); return; }
    if (el.matches("#dayTabs [data-day]")) { state.day = Number(el.dataset.day); renderPlan(); return; }
    if (el.matches("#tagChips [data-tag]")) { const tag = el.dataset.tag; if (!tag) state.tags.clear(); else if (state.tags.has(tag)) state.tags.delete(tag); else state.tags.add(tag); state.shown = PAGE; renderChips(); renderGrid(); return; }
    if (el.id === "loadMore") { state.shown += PAGE; renderGrid(); return; }
    if (el.id === "retryLoad") { loadRecipes(); return; }
    if (el.id === "resetFilters") { state.q = ""; state.tags.clear(); $("#recipeSearch").value = ""; state.shown = PAGE; renderChips(); renderGrid(); return; }
    if (el.id === "suggestEmpty") { runSuggest(true); return; }
    if (el.id === "suggestAll") { runSuggest(false); return; }
    if (el.id === "clearPlan") { if (!state.plan.items.length) { toast("Rencana masih kosong."); return; } if (confirm("Kosongkan seluruh rencana menu?")) { state.target = null; savePlan({ ...state.plan, items: [] }); toast("Rencana dikosongkan."); } return; }
    if (!act) {
      if (el.matches("[data-pick-day]")) { state.pick.day = Number(el.dataset.pickDay); renderPick(); }
      else if (el.matches("[data-pick-slot]")) { state.pick.slot = el.dataset.pickSlot; renderPick(); }
      return;
    }
    switch (act) {
      case "cancel-target": state.target = null; renderPlan(); break;
      case "close": closeSheets(); break;
      case "close-pick": $("#pickBackdrop").hidden = true; state.pick = null; if ($("#detailBackdrop").hidden) document.body.style.overflow = ""; break;
      case "choose": { const ctx = slotContext(el); state.target = ctx; state.shown = PAGE; renderPlan(); $("#browseTitle").scrollIntoView({ behavior: "smooth", block: "start" }); break; }
      case "clear": { const ctx = slotContext(el); savePlan(RC.clearSlot(state.plan, ctx.day, ctx.slot)); toast("Slot dikosongkan."); break; }
      case "shuffle": {
        const ctx = slotContext(el); if (!state.loaded) { toast("Resep belum dimuat."); break; }
        const pick = RC.suggestSlot(state.plan, ctx.day, ctx.slot, state.all, { rotation: state.rotation });
        if (pick) { assign(ctx.day, ctx.slot, pick); toast(`${pick.name} dipilih untuk ${mealLabel(ctx.slot).toLowerCase()}.`); } else toast("Tidak ada resep untuk diacak.");
        break;
      }
      case "serv-": case "serv+": {
        const ctx = slotContext(el), item = RC.planItem(state.plan, ctx.day, ctx.slot), recipe = state.byId[item.recipe_id];
        savePlan({ ...state.plan, items: state.plan.items.map(i => i === item ? { ...i, servings: clampServings(i.servings + (act === "serv+" ? 1 : -1)) } : i) });
        if (recipe) toast(`${recipe.name}: ${RC.planItem(state.plan, ctx.day, ctx.slot).servings} porsi`);
        break;
      }
      case "view": {
        const ctx = slotContext(el), id = ctx ? RC.planItem(state.plan, ctx.day, ctx.slot).recipe_id : recipeIdOf(el);
        openDetail(id, ctx ? RC.planItem(state.plan, ctx.day, ctx.slot).servings : 0); break;
      }
      case "pick": { const recipe = state.byId[recipeIdOf(el)]; if (recipe) openPick(recipe); break; }
      case "detail-serv-": updateDetailServings(-1); break;
      case "detail-serv+": updateDetailServings(1); break;
      case "detail-pick": if (state.detail) { const { recipe, servings } = state.detail; $("#detailBackdrop").hidden = true; document.body.style.overflow = ""; openPick(state.byId[recipe.id] || recipe, servings); } break;
      case "pick-serv-": state.pick.servings = clampServings(state.pick.servings - 1); renderPick(); break;
      case "pick-serv+": state.pick.servings = clampServings(state.pick.servings + 1); renderPick(); break;
      case "pick-save": {
        const p = state.pick; assign(p.day, p.slot, p.recipe, p.servings); state.day = p.day; renderPlan();
        toast(`${p.recipe.name} → Hari ${p.day} · ${mealLabel(p.slot)}`); $("#pickBackdrop").hidden = true; state.pick = null; document.body.style.overflow = ""; break;
      }
    }
  });
  $$(".rp-backdrop").forEach(backdrop => backdrop.addEventListener("click", event => { if (event.target === backdrop) { if (backdrop.id === "pickBackdrop") { backdrop.hidden = true; state.pick = null; } else closeSheets(); } }));
  $("#recipeSearch").addEventListener("input", event => { state.q = event.target.value; state.shown = PAGE; renderGrid(); });
  $("#householdServings").addEventListener("change", event => {
    state.household = Number(event.target.value) || 0; store.write(HOUSE_KEY, state.household);
    if (state.plan.items.length) {
      savePlan({ ...state.plan, items: state.plan.items.map(i => ({ ...i, servings: state.household || (state.byId[i.recipe_id] ? state.byId[i.recipe_id].servings : i.servings) })) });
      toast(state.household ? `Porsi semua menu: ${state.household} orang.` : "Porsi dikembalikan sesuai resep.");
    }
  });
  $("#rotationSelect").addEventListener("change", event => { state.rotation = event.target.value; store.write(ROT_KEY, state.rotation); });
  window.addEventListener("storage", event => { if (event.key === CART_KEY) renderCartBadge(); });

  // ---------- Muat data ----------
  async function loadRecipes() {
    state.error = false; state.loaded = false; renderGrid();
    try {
      const first = await getJson("/api/recipes?limit=60&offset=0");
      let items = first.items;
      for (let offset = 60; offset < first.total; offset += 60) items = items.concat((await getJson(`/api/recipes?limit=60&offset=${offset}`)).items);
      state.all = items; state.byId = Object.fromEntries(items.map(r => [r.id, r])); state.facets = first.tags || []; state.loaded = true;
    } catch (error) { state.error = true; }
    renderChips(); renderGrid(); renderPlan();
    const wanted = new URLSearchParams(location.search).get("resep");
    if (state.loaded && wanted && state.byId[wanted.toUpperCase()]) openDetail(wanted.toUpperCase());
  }

  function syncNavHeight() { const nav = $(".mobile-nav"); document.documentElement.style.setProperty("--nav-h", (nav && getComputedStyle(nav).display !== "none" ? nav.offsetHeight : 0) + "px"); }
  window.addEventListener("resize", syncNavHeight);
  syncNavHeight(); renderCartBadge(); renderControls(); renderPlan(); renderChips();
  loadRecipes();
})();
