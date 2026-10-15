// Keranjang Kebutuhan Dapur — mengubah rencana menu menjadi daftar belanja yang dicocokkan dengan katalog.
// Perhitungan dilakukan server (/api/kitchen/needs); penambahan ke keranjang memakai keranjang website yang sama (localStorage).
(function () {
  "use strict";
  const RC = window.RecipeCore;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const num = value => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Number(value) || 0);

  const PLAN_KEY = "sp-meal-plan-v1", CHOICE_KEY = "sp-kitchen-choices-v1", SEL_KEY = "sp-kitchen-selected-v1", ADDED_KEY = "sp-kitchen-added-v1", CART_KEY = "sayur-pasundan-cart-v1";
  const store = {
    read(key, fallback) { try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* mode privat */ } }
  };
  const state = {
    plan: RC.normalizePlan(store.read(PLAN_KEY, null)), recipes: {}, needs: null, loading: true, error: "",
    choices: store.read(CHOICE_KEY, {}) || {}, selected: store.read(SEL_KEY, {}) || {}, picker: null, lastFocus: null, timer: null, seq: 0
  };
  if (typeof state.choices !== "object" || Array.isArray(state.choices)) state.choices = {};
  if (typeof state.selected !== "object" || Array.isArray(state.selected)) state.selected = {};

  async function request(url, options) {
    const response = await fetch(url, { headers: { accept: "application/json", ...(options && options.body ? { "content-type": "application/json" } : {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
    return data;
  }
  function toast(text) {
    const el = $("#toast"); if (!el) return;
    el.textContent = text; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  const mealLabel = key => (RC.MEAL_SLOTS.find(s => s.key === key) || {}).label || key;
  const readCart = () => { const cart = store.read(CART_KEY, []); return Array.isArray(cart) ? cart : []; };
  function renderCartBadge() { const badge = $("#cartBadge"); if (badge && window.SPUnits) badge.textContent = String(Math.round(SPUnits.cartCount(readCart()) * 100) / 100); }
  const savePlan = plan => { state.plan = RC.normalizePlan(plan); store.write(PLAN_KEY, state.plan); };

  // ---------- Pilihan pelanggan ----------
  const isSelected = line => (line.id in state.selected) ? Boolean(state.selected[line.id]) : !line.optional;
  const addable = line => Boolean(line.cart_item) && (line.status === "siap" || line.status === "manual");
  function setChoice(lineId, value) { if (value) state.choices[lineId] = value; else delete state.choices[lineId]; store.write(CHOICE_KEY, state.choices); }

  // ---------- Muat data ----------
  async function load() {
    const mySeq = ++state.seq;
    state.loading = true; state.error = ""; render();
    try {
      if (!state.plan.items.length) { state.needs = null; state.loading = false; render(); return; }
      const ids = [...new Set(state.plan.items.map(i => i.recipe_id))];
      const [recipes, needs] = await Promise.all([
        request(`/api/recipes?limit=40&ids=${encodeURIComponent(ids.join(","))}`),
        request("/api/kitchen/needs", { method: "POST", body: JSON.stringify({ items: state.plan.items.map(i => ({ recipe_id: i.recipe_id, servings: i.servings })), choices: state.choices }) })
      ]);
      if (mySeq !== state.seq) return; // permintaan lebih baru sudah berjalan
      state.recipes = Object.fromEntries(recipes.items.map(r => [r.id, r]));
      state.needs = needs;
      // buang resep yang sudah tidak tersedia dari rencana
      const missing = state.plan.items.filter(i => !state.recipes[i.recipe_id]);
      if (missing.length) { savePlan({ ...state.plan, items: state.plan.items.filter(i => state.recipes[i.recipe_id]) }); toast("Sebagian resep sudah tidak tersedia dan dihapus dari rencana."); return load(); }
    } catch (error) { if (mySeq !== state.seq) return; state.error = error.message || "Kebutuhan dapur belum dapat dihitung."; }
    state.loading = false; render();
  }
  const reload = () => { clearTimeout(state.timer); state.timer = setTimeout(load, 220); };

  // ---------- Tampilan ----------
  function photoHtml(recipe) {
    const url = recipe && recipe.photo && recipe.photo.url;
    return url ? `<div class="rp-photo"><img src="${esc(url)}" alt="${esc(recipe.photo.alt || "Foto masakan " + recipe.name)}" loading="lazy" data-photo-img></div>`
      : `<div class="rp-photo rp-photo-empty"><img src="/assets/images/brand/resep-placeholder.svg" alt="" loading="lazy"></div>`;
  }
  document.addEventListener("error", event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-photo-img")) return;
    img.removeAttribute("data-photo-img"); img.alt = ""; img.src = "/assets/images/brand/resep-placeholder.svg"; img.closest(".rp-photo")?.classList.add("rp-photo-empty", "rp-photo-failed");
  }, true);

  function planHtml() {
    const items = [...state.plan.items].sort((a, b) => a.day - b.day || RC.MEAL_SLOTS.findIndex(s => s.key === a.slot) - RC.MEAL_SLOTS.findIndex(s => s.key === b.slot));
    return `<section class="kd-group"><h2>Menu dalam rencana <span>${items.length}</span></h2><div class="kd-plan">${items.map(item => {
      const r = state.recipes[item.recipe_id]; if (!r) return "";
      return `<article class="kd-recipe" data-day="${item.day}" data-slot="${item.slot}">${photoHtml(r)}<div><h3>${esc(r.name)}</h3><small>Hari ${item.day} · ${esc(mealLabel(item.slot))} · standar resep ${r.servings} porsi</small>
        <div class="kd-recipe-row"><div class="rp-stepper"><button type="button" data-act="serv-" aria-label="Kurangi porsi ${esc(r.name)}">−</button><b>${item.servings}</b><button type="button" data-act="serv+" aria-label="Tambah porsi ${esc(r.name)}">+</button><span style="font-size:12px;color:var(--muted);font-weight:700">porsi</span></div>
        <button type="button" class="rp-link danger" data-act="remove-recipe">Hapus dari rencana</button></div></div></article>`;
    }).join("")}</div></section>`;
  }

  const STATUS = {
    siap: ["", "Cocok dengan produk toko"], manual: ["manual", "Jumlah beli Anda tentukan"], perlu_dipilih: ["pilih", "Perlu dipilih"],
    stok_habis: ["habis", "Stok habis"], tidak_dijual: ["tidak", "Belum tersedia"], dapur: ["dapur", "Biasanya sudah ada di dapur"]
  };
  function sourcesText(line) {
    const byRecipe = new Map();
    for (const s of line.sources) byRecipe.set(s.recipe_name, (byRecipe.get(s.recipe_name) || 0) + 1);
    return [...byRecipe.entries()].map(([name, n]) => n > 1 ? `${name} (${n}×)` : name).join(", ");
  }
  function lineHtml(line) {
    const [cls, label] = STATUS[line.status] || ["", line.status], can = addable(line), on = can && isSelected(line), m = line.match;
    const needHtml = `<p class="kd-need">Kebutuhan resep: <b>${esc(line.display)}</b>${line.optional ? ` <span class="rp-chip">opsional</span>` : ""}</p><p class="kd-from">Dipakai di: ${esc(sourcesText(line))}</p>`;
    let body = "";
    if (m) {
      const options = line.options.length ? `<select data-act="unit" aria-label="Satuan jual untuk ${esc(line.name)}">${line.options.map(o => `<option value="${o.id_satuan}" ${o.id_satuan === m.unit.id ? "selected" : ""} ${o.available ? "" : "disabled"}>${esc(o.label)} · ${rupiah(o.harga)}${o.available ? "" : " (habis)"}</option>`).join("")}</select>` : "";
      body = `<div class="kd-match">${m.product.image_url ? `<img class="kd-thumb" src="${esc(m.product.image_url)}" alt="${esc(m.product.name)}" loading="lazy">` : `<span class="kd-thumb-empty">Tanpa foto</span>`}
        <div><strong>${esc(m.product.name)}</strong><small style="color:var(--muted);font-size:11.5px">Dijual per: ${esc(m.unit.label)} · ${rupiah(m.unit.harga)}${m.available ? "" : " · stok habis"}</small>${options}</div></div>`;
      const p = line.purchase;
      if (p) {
        const stepper = p.manual ? `<div class="rp-stepper"><button type="button" data-act="qty-" aria-label="Kurangi jumlah">−</button><b>${num(p.quantity)}</b><button type="button" data-act="qty+" aria-label="Tambah jumlah">+</button></div>` : "";
        body += `<div class="kd-buy"><p class="kd-buy-info"><b>Beli: ${num(p.quantity)} × ${esc(m.unit.label)}</b><br>${esc(p.explanation)}</p>${stepper}${can ? `<div class="kd-price">${rupiah(line.subtotal)}<small>subtotal</small></div>` : ""}</div>`;
      }
    }
    const messages = line.messages.map(t => `<p class="kd-msg">${esc(t)}</p>`).join("");
    const actions = [];
    if (can) actions.push(`<button type="button" class="button button-orange" data-act="add-one">Tambah ke keranjang</button>`);
    if (line.status === "perlu_dipilih" || line.status === "tidak_dijual" || line.status === "dapur") actions.push(`<button type="button" class="button button-ghost" data-act="pick-product">Cari &amp; pilih produk</button>`);
    else actions.push(`<button type="button" class="button button-ghost" data-act="pick-product">Ganti produk</button>`);
    if (line.source === "pelanggan") actions.push(`<button type="button" class="rp-link" data-act="reset-choice">Kembali ke pilihan awal</button>`);
    return `<article class="kd-line ${can && !on ? "is-off" : ""}" data-line="${esc(line.id)}"><div class="kd-line-top">
        ${can ? `<input class="kd-check" type="checkbox" data-act="toggle" ${on ? "checked" : ""} aria-label="Ikut belanja: ${esc(line.name)}">` : `<span></span>`}
        <div><p class="kd-name">${esc(line.name)} <span class="kd-status ${cls}">${esc(label)}</span></p>${needHtml}</div></div>${body}${messages}<div class="kd-line-actions">${actions.join("")}</div></article>`;
  }

  function groupsHtml(lines) {
    const groups = [
      ["Siap dibeli", l => l.status === "siap"], ["Perlu menentukan jumlah beli", l => l.status === "manual"], ["Perlu memilih produk", l => l.status === "perlu_dipilih"],
      ["Belum bisa dibeli", l => l.status === "stok_habis" || l.status === "tidak_dijual"], ["Biasanya sudah ada di dapur", l => l.status === "dapur"]
    ];
    return groups.map(([title, fn]) => {
      const items = lines.filter(fn); if (!items.length) return "";
      const hint = title === "Perlu memilih produk" ? `<p class="rp-foot" style="margin:-4px 0 10px">Bahan ini belum dipasangkan dengan produk toko. Bahan yang belum dipilih tidak ikut masuk keranjang.</p>`
        : title === "Perlu menentukan jumlah beli" ? `<p class="rp-foot" style="margin:-4px 0 10px">Satuan takaran resep tidak bisa dipastikan setara dengan satuan jual, jadi jumlah beli ditentukan Anda.</p>` : "";
      return `<section class="kd-group"><h2>${title} <span>${items.length}</span></h2>${hint}<div class="kd-lines">${items.map(lineHtml).join("")}</div></section>`;
    }).join("");
  }

  function totals() {
    const lines = (state.needs && state.needs.lines) || [], chosen = lines.filter(l => addable(l) && isSelected(l));
    return { chosen, count: chosen.length, total: chosen.reduce((s, l) => s + l.subtotal, 0) };
  }
  function render() {
    const root = $("#kdRoot"), bar = $("#kdBar");
    renderCartBadge();
    if (state.loading && !state.needs) { root.innerHTML = `<div class="rp-skeleton"></div><div class="rp-skeleton" style="margin-top:12px"></div>`; bar.hidden = true; return; }
    if (!state.plan.items.length) {
      root.innerHTML = `<div class="kd-empty"><strong>Rencana menu masih kosong</strong>Pilih resep dulu, lalu daftar kebutuhan dapur akan muncul di sini.<br><a class="button button-orange" href="/masak-apa-hari-ini" style="margin-top:14px">Pilih resep</a></div>`; bar.hidden = true; return;
    }
    if (state.error) { root.innerHTML = `<div class="kd-empty"><strong>Daftar kebutuhan belum dapat dihitung</strong>${esc(state.error)}<br><button type="button" class="button button-orange" id="kdRetry" style="margin-top:14px">Coba lagi</button> <a class="button button-ghost" href="/masak-apa-hari-ini" style="margin-top:14px">Kembali ke rencana</a></div>`; bar.hidden = true; return; }
    const needs = state.needs, t = totals();
    const pending = needs.lines.filter(l => !addable(l) && l.status !== "dapur").length;
    root.innerHTML = planHtml() + `<div style="${state.loading ? "opacity:.6;pointer-events:none" : ""}">` + groupsHtml(needs.lines) + `</div>` +
      `<p class="rp-foot" style="margin-top:22px">Satuan resep (gram, sendok, butir) berbeda dengan satuan jual toko. Jumlah beli dibulatkan ke atas agar kebutuhan masakan tercukupi; sisanya tetap milik Anda. Harga dan stok mengikuti katalog toko saat ini dan dicek ulang saat Anda memesan.</p>`;
    bar.hidden = false;
    $("#kdBarTitle").textContent = t.count ? `${t.count} bahan · estimasi ${rupiah(t.total)}` : "Belum ada bahan terpilih";
    $("#kdBarSub").textContent = pending ? `${pending} bahan belum bisa dimasukkan (perlu dipilih / tidak tersedia)` : "Semua bahan yang cocok siap dimasukkan";
    const btn = $("#kdAddBtn"); btn.disabled = t.count === 0; btn.textContent = t.count ? `Tambahkan ${t.count} bahan` : "Tambahkan ke keranjang";
  }

  // ---------- Keranjang ----------
  function mergeIntoCart(items) {
    const cart = readCart();
    for (const item of items) {
      const current = cart.find(c => c.key === item.key);
      if (current) { current.quantity = Math.round((Number(current.quantity) + item.quantity) * 100) / 100; current.line_total = Math.round(Number(current.unit_price) * current.quantity); }
      else cart.push({ ...item });
    }
    store.write(CART_KEY, cart);
    renderCartBadge();
  }
  const signature = items => items.map(i => `${i.key}=${i.quantity}`).sort().join("|");

  function openSheet(html) {
    state.lastFocus = document.activeElement;
    $("#kdSheet").innerHTML = html; $("#kdBackdrop").hidden = false; document.body.style.overflow = "hidden";
    const first = $("#kdSheet .rp-close"); if (first) first.focus();
  }
  function closeSheet() { $("#kdBackdrop").hidden = true; document.body.style.overflow = ""; state.picker = null; if (state.lastFocus && state.lastFocus.focus) { try { state.lastFocus.focus(); } catch { /* ignore */ } } }

  function confirmAdd(lines) {
    const items = lines.map(l => l.cart_item), cart = readCart(), last = store.read(ADDED_KEY, null), sig = signature(items);
    const duplicate = last && last.sig === sig;
    const already = items.filter(i => cart.some(c => c.key === i.key));
    const total = lines.reduce((s, l) => s + l.subtotal, 0);
    const skipped = ((state.needs && state.needs.lines) || []).filter(l => !addable(l) && l.status !== "dapur").length;
    openSheet(`<div class="rp-sheet-head"><h2 id="kdSheetTitle">Tambahkan ke keranjang?</h2><button type="button" class="rp-close" data-act="close-sheet" aria-label="Tutup">×</button></div>
      <div class="rp-sheet-body"><div class="kd-summary-lines"><div><span>Jumlah produk</span><b>${items.length}</b></div><div><span>Keranjang saat ini</span><b>${cart.length} produk</b></div><div class="total"><span>Estimasi total</span><b>${rupiah(total)}</b></div></div>
        <ul class="rp-list">${lines.map(l => `<li>${esc(l.cart_item.name)} — ${num(l.cart_item.quantity)} × ${esc(l.cart_item.unit_label)} (${rupiah(l.subtotal)})</li>`).join("")}</ul>
        ${already.length ? `<div class="rp-note">${already.length} produk sudah ada di keranjang Anda. Jumlahnya akan <b>ditambahkan</b>, bukan diganti. Produk lain di keranjang tidak berubah.</div>` : `<div class="rp-note ok">Produk lain yang sudah ada di keranjang tidak akan berubah.</div>`}
        ${duplicate ? `<div class="rp-note"><b>Daftar yang sama</b> sudah Anda tambahkan sebelumnya${last.at ? " pada " + esc(new Date(last.at).toLocaleString("id-ID")) : ""}. Menambahkan lagi akan menggandakan jumlah.</div>` : ""}
        ${skipped ? `<p class="rp-foot">${skipped} bahan lain belum ikut karena belum dipilih atau tidak tersedia. Bahan tersebut tidak dianggap sudah dibeli.</p>` : ""}
        <p class="rp-foot">Harga dan stok akan dicek ulang oleh toko saat checkout.</p></div>
      <div class="rp-sheet-foot"><button type="button" class="button button-ghost" data-act="close-sheet">Batal</button><button type="button" class="button button-orange" data-act="confirm-add">${duplicate ? "Tambahkan lagi" : "Ya, tambahkan"}</button></div>`);
    state.pendingAdd = { items, sig };
  }
  function doAdd() {
    const { items, sig } = state.pendingAdd || { items: [] };
    if (!items.length) return;
    mergeIntoCart(items); store.write(ADDED_KEY, { sig, at: new Date().toISOString() });
    $("#kdSheet").innerHTML = `<div class="rp-sheet-head"><h2 id="kdSheetTitle">Berhasil ditambahkan</h2><button type="button" class="rp-close" data-act="close-sheet" aria-label="Tutup">×</button></div>
      <div class="rp-sheet-body"><div class="rp-note ok"><b>${items.length} produk</b> sudah masuk ke keranjang belanja Anda. Lanjutkan ke keranjang untuk memeriksa dan memesan.</div></div>
      <div class="rp-sheet-foot"><button type="button" class="button button-ghost" data-act="close-sheet">Tetap di sini</button><a class="button button-orange" href="/?keranjang=1">Buka keranjang</a></div>`;
    state.pendingAdd = null;
  }
  function addOne(line) {
    mergeIntoCart([line.cart_item]);
    toast(`${line.cart_item.name} ditambahkan ke keranjang.`);
  }

  // ---------- Pencarian produk (katalog yang sama dengan toko) ----------
  function openPicker(line) {
    state.picker = { lineId: line.id, name: line.name, results: null, loading: false, q: line.name };
    renderPicker(); searchProducts(line.name);
  }
  function renderPicker() {
    const p = state.picker; if (!p) return;
    const results = p.loading ? `<div class="rp-skeleton" style="height:90px"></div>` : p.error ? `<div class="rp-state">${esc(p.error)}</div>`
      : !p.results ? "" : !p.results.length ? `<div class="rp-state"><strong>Produk tidak ditemukan</strong>Coba kata kunci lain. Produk yang tidak ada di katalog tidak bisa ditambahkan.</div>`
      : `<div class="kd-picker-results">${p.results.map(prod => `<div class="kd-pick"><strong>${esc(prod.name)}</strong><div class="kd-pick-units">${prod.variants.flatMap(v => v.units.map(u => {
        const unavailable = String(prod.stock_status || "") === "out_of_stock" && prod.stock_mode !== "unlimited";
        return `<button type="button" data-pick-unit="${u.id_satuan}" ${unavailable ? "disabled" : ""}>${esc([v.merk, v.nama_varian].filter(Boolean).join(" ") || "Default")} · ${esc(u.nama_satuan)}<small>${rupiah(u.harga)}${unavailable ? " · stok habis" : ""}</small></button>`;
      })).join("")}</div></div>`).join("")}</div>`;
    const existing = $("#kdSheet input[data-picker-q]"), keep = existing ? existing.value : p.q;
    $("#kdSheet").innerHTML = `<div class="rp-sheet-head"><h2 id="kdSheetTitle">Pilih produk untuk “${esc(p.name)}”</h2><button type="button" class="rp-close" data-act="close-sheet" aria-label="Tutup">×</button></div>
      <div class="rp-sheet-body"><div class="rp-search"><input type="search" data-picker-q value="${esc(keep)}" placeholder="Cari produk di katalog…" aria-label="Cari produk"><button type="button" class="button button-orange" data-act="picker-search">Cari</button></div>
        <p class="rp-foot">Pilih produk yang benar-benar sesuai. Jika satuan jualnya tidak bisa dibandingkan dengan takaran resep, jumlah beli Anda tentukan sendiri.</p>${results}</div>`;
    if (!$("#kdBackdrop").hidden) return;
    state.lastFocus = document.activeElement; $("#kdBackdrop").hidden = false; document.body.style.overflow = "hidden";
  }
  async function searchProducts(q) {
    const p = state.picker; if (!p) return; p.q = q; p.loading = true; p.error = ""; renderPicker();
    try { const data = await request(`/api/products?q=${encodeURIComponent(q.trim().slice(0, 80))}`); p.results = (Array.isArray(data) ? data : data.items || []).slice(0, 12); }
    catch (error) { p.error = error.message || "Pencarian gagal."; }
    p.loading = false; if (state.picker === p) renderPicker();
  }

  // ---------- Event ----------
  const lineOf = el => { const card = el.closest("[data-line]"); return card && state.needs ? state.needs.lines.find(l => l.id === card.dataset.line) : null; };
  document.addEventListener("click", event => {
    const el = event.target.closest("[data-act], [data-pick-unit], #kdRetry, #kdAddBtn"); if (!el) return;
    if (el.id === "kdRetry") { load(); return; }
    if (el.id === "kdAddBtn") { const t = totals(); if (t.count) confirmAdd(t.chosen); return; }
    if (el.dataset.pickUnit) { const p = state.picker; if (p) { setChoice(p.lineId, { id_satuan: Number(el.dataset.pickUnit) }); delete state.selected[p.lineId]; closeSheet(); toast("Produk dipilih."); load(); } return; }
    const act = el.dataset.act;
    if (act === "close-sheet") { closeSheet(); return; }
    if (act === "confirm-add") { doAdd(); return; }
    if (act === "picker-search") { const input = $("#kdSheet input[data-picker-q]"); if (input && input.value.trim()) searchProducts(input.value); return; }
    const recipeCard = el.closest(".kd-recipe");
    if (recipeCard) {
      const day = Number(recipeCard.dataset.day), slot = recipeCard.dataset.slot, item = RC.planItem(state.plan, day, slot); if (!item) return;
      if (act === "remove-recipe") { savePlan(RC.clearSlot(state.plan, day, slot)); toast("Resep dihapus dari rencana."); load(); }
      else if (act === "serv-" || act === "serv+") { const n = Math.max(1, Math.min(20, item.servings + (act === "serv+" ? 1 : -1))); savePlan({ ...state.plan, items: state.plan.items.map(i => i === item ? { ...i, servings: n } : i) }); state.loading = true; render(); reload(); }
      return;
    }
    const line = lineOf(el); if (!line) return;
    if (act === "add-one") { if (addable(line)) addOne(line); }
    else if (act === "pick-product") openPicker(line);
    else if (act === "reset-choice") { setChoice(line.id, null); load(); }
    else if (act === "qty-" || act === "qty+") {
      const step = (line.purchase && line.purchase.step) || 1, next = Math.max(step, Math.round((line.purchase.quantity + (act === "qty+" ? step : -step)) / step) * step);
      setChoice(line.id, { id_satuan: line.match.unit.id, quantity: next }); load();
    }
  });
  document.addEventListener("change", event => {
    const el = event.target, line = lineOf(el); if (!line) return;
    if (el.dataset.act === "toggle") { state.selected[line.id] = el.checked; store.write(SEL_KEY, state.selected); render(); }
    else if (el.dataset.act === "unit") { setChoice(line.id, { id_satuan: Number(el.value) }); load(); }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#kdBackdrop").hidden) closeSheet();
    if (event.key === "Enter" && event.target.matches && event.target.matches("input[data-picker-q]") && event.target.value.trim()) searchProducts(event.target.value);
  });
  $("#kdBackdrop").addEventListener("click", event => { if (event.target.id === "kdBackdrop") closeSheet(); });
  window.addEventListener("storage", event => { if (event.key === CART_KEY) renderCartBadge(); });
  function syncNavHeight() { const nav = $(".mobile-nav"); document.documentElement.style.setProperty("--nav-h", (nav && getComputedStyle(nav).display !== "none" ? nav.offsetHeight : 0) + "px"); }
  window.addEventListener("resize", syncNavHeight);
  syncNavHeight(); renderCartBadge(); load();
})();
