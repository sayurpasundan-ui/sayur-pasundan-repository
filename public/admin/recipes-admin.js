// Admin: pengelolaan resep (foto, tampil/sembunyi, alat, tanda matang, tips) dan pemetaan bahan resep ke katalog produk.
// Memakai helper dari admin.js: api(), toast(), esc(), rp(), uploadResourceImage().
(function () {
  const $r = selector => document.querySelector(selector);
  const rec = { items: [], filter: "all", q: "", loaded: false, editing: null };
  const map = { items: [], summary: null, filter: "todo", q: "", open: null, loaded: false, picker: null };

  // ======================= RESEP =======================
  async function loadRecipes() {
    $r("#recipesList").innerHTML = `<p class="muted">Memuat resep…</p>`;
    try { rec.items = await api("/api/admin/recipes"); rec.loaded = true; renderRecipes(); }
    catch (error) { $r("#recipesList").innerHTML = `<p class="admin-error">${esc(error.message)}</p>`; }
  }
  function recipeFilter(r) {
    const q = rec.q.trim().toLowerCase();
    if (q && !(r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)))) return false;
    if (rec.filter === "nophoto") return r.photo.status !== "tersedia";
    if (rec.filter === "photo") return r.photo.status === "tersedia";
    if (rec.filter === "hidden") return !r.visible;
    return true;
  }
  function renderRecipes() {
    const list = rec.items.filter(recipeFilter), noPhoto = rec.items.filter(r => r.photo.status !== "tersedia").length;
    $r("#recipesSummary").textContent = `${rec.items.length} resep · ${rec.items.filter(r => r.visible).length} tampil · ${noPhoto} belum punya foto`;
    $r("#recipesList").innerHTML = list.slice(0, 60).map(r => `<article class="rec-item" data-recipe="${esc(r.id)}">
        <div class="rec-thumb">${r.photo.url ? `<img src="${esc(r.photo.url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'Foto gagal dimuat'}))">` : `<span>Belum ada foto</span>`}</div>
        <div class="rec-main"><strong>${esc(r.name)}</strong><small>${esc(r.id)} · ${esc(r.rotation)} · ${r.servings} porsi · ${esc(r.difficulty)}</small>
          <div class="rec-badges"><span class="rec-badge ${r.visible ? "ok" : "off"}">${r.visible ? "Tampil" : "Disembunyikan"}</span><span class="rec-badge ${r.photo.status === "tersedia" ? "ok" : "warn"}">${r.photo.status === "tersedia" ? "Foto ada" : "Foto belum ada"}</span>${r.has_override ? `<span class="rec-badge">Diubah admin</span>` : ""}</div></div>
        <button type="button" class="button button-outline" data-rec-edit="${esc(r.id)}">Edit</button></article>`).join("") || `<p class="muted">Tidak ada resep yang cocok.</p>`;
    if (list.length > 60) $r("#recipesList").insertAdjacentHTML("beforeend", `<p class="muted tiny">Menampilkan 60 dari ${list.length} resep. Gunakan pencarian untuk mempersempit.</p>`);
  }
  function editorHtml(r) {
    return `<form id="recipeForm" class="rec-form" novalidate>
      <div class="rec-form-head"><div><p class="eyebrow">EDIT RESEP</p><h3>${esc(r.name)}</h3><small>${esc(r.id)} · bahan dan langkah mengikuti data Excel dan tidak diubah di sini</small></div><button type="button" class="rp-x" data-rec-close aria-label="Tutup">×</button></div>
      <label class="cat-field">Status tampil di toko<select name="visible"><option value="">Ikuti data Excel (${r.visible_default ? "Tampil" : "Sembunyikan"})</option><option value="1" ${r.has_override && r.visible && r.visible !== r.visible_default ? "selected" : ""}>Tampil</option><option value="0" ${r.has_override && !r.visible && r.visible !== r.visible_default ? "selected" : ""}>Sembunyikan</option></select></label>
      <div class="rec-photo-box"><div class="rec-photo-preview" id="recPhotoPreview">${r.photo.url ? `<img src="${esc(r.photo.url)}" alt="">` : `<span>Belum ada foto</span>`}</div>
        <div class="rec-photo-fields">
          <label class="cat-field">Unggah foto masakan (JPG/PNG/WebP; dikecilkan otomatis)<input type="file" accept="image/jpeg,image/png,image/webp" id="recPhotoFile"></label>
          <label class="cat-field">atau alamat foto (https atau /assets/…)<input name="photo_url" value="${esc(r.photo.url || "")}" placeholder="kosongkan jika belum ada foto" maxlength="600"></label>
          <label class="cat-field">Teks alternatif foto (menjelaskan isi foto)<input name="photo_alt" value="${esc(r.photo.url ? r.photo.alt || "" : "")}" placeholder="mis. Nasi goreng sayur dengan telur mata sapi" maxlength="240"></label>
          <p class="muted tiny">Gunakan hanya foto masakan yang sesuai resep dan Anda berhak memakainya. Jangan memakai foto dari internet tanpa izin.</p></div></div>
      <label class="cat-field">Alat yang diperlukan (satu per baris)<textarea name="tools" rows="3" maxlength="1500" placeholder="mis. Wajan&#10;Spatula">${esc(r.tools)}</textarea></label>
      <label class="cat-field">Tanda masakan sudah matang (satu per baris)<textarea name="doneness" rows="3" maxlength="1500" placeholder="mis. Nasi tampak kering dan harum">${esc(r.doneness)}</textarea></label>
      <label class="cat-field">Tips penyajian (satu per baris)<textarea name="serving_tips" rows="3" maxlength="1500" placeholder="mis. Sajikan hangat dengan kerupuk">${esc(r.serving_tips)}</textarea></label>
      <p class="admin-error" id="recipeFormError" hidden></p>
      <div class="cat-actions"><button type="submit" class="button button-orange">Simpan</button><button type="button" class="button button-outline" data-rec-reset ${r.has_override ? "" : "disabled"}>Kembalikan ke data Excel</button><a class="button button-outline" href="/masak-apa-hari-ini?resep=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">Lihat di toko</a></div></form>`;
  }
  function openRecipeEditor(id) {
    const r = rec.items.find(x => x.id === id); if (!r) return;
    rec.editing = r; rec.newPhoto = null;
    const host = $r("#recipeEditor"); host.innerHTML = editorHtml(r); host.hidden = false; host.scrollIntoView({ block: "start" });
  }
  async function saveRecipe(form) {
    const r = rec.editing, err = $r("#recipeFormError"), data = new FormData(form), btn = form.querySelector('[type="submit"]');
    err.hidden = true; btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      let photoUrl = String(data.get("photo_url") || "").trim();
      const file = $r("#recPhotoFile").files[0];
      if (file) { const up = await uploadResourceImage(file, `recipe-${r.id}`); photoUrl = up.image_url; }
      const vis = String(data.get("visible"));
      await api(`/api/admin/recipes/${encodeURIComponent(r.id)}`, { method: "PUT", body: JSON.stringify({
        visible: vis === "" ? null : vis === "1", photo_url: photoUrl, photo_alt: String(data.get("photo_alt") || "").trim(),
        tools: String(data.get("tools") || ""), doneness: String(data.get("doneness") || ""), serving_tips: String(data.get("serving_tips") || "") }) });
      if (photoUrl && !String(data.get("photo_alt") || "").trim()) toast("Tersimpan. Sebaiknya isi teks alternatif foto.");
      else toast("Resep tersimpan.");
      $r("#recipeEditor").hidden = true; rec.editing = null; await loadRecipes();
    } catch (error) { err.textContent = error.message || "Gagal menyimpan."; err.hidden = false; btn.disabled = false; btn.textContent = "Simpan"; }
  }

  // ======================= PEMETAAN BAHAN =======================
  async function loadMapping() {
    $r("#mappingList").innerHTML = `<p class="muted">Memuat bahan…</p>`;
    try { const data = await api("/api/admin/recipe-mapping"); map.items = data.items; map.summary = data.summary; map.loaded = true; renderMapping(); }
    catch (error) { $r("#mappingList").innerHTML = `<p class="admin-error">${esc(error.message)}</p>`; }
  }
  const mapStatus = i => !i.mapping ? "todo" : i.mapping.status === "verified" ? (i.mapping.inactive ? "todo" : "verified") : i.mapping.status;
  function mappingFilter(i) {
    const q = map.q.trim().toLowerCase(); if (q && !i.name.toLowerCase().includes(q)) return false;
    if (map.filter === "all") return true;
    return mapStatus(i) === map.filter;
  }
  function renderMapping() {
    const s = map.summary, total = map.items.length;
    $r("#mappingSummary").innerHTML = `<b>${s.verified}</b> dari ${total} bahan sudah dipetakan · ${s.pantry} “sudah ada di dapur” · ${s.unavailable} “tidak dijual” · <b>${total - s.verified - s.pantry - s.unavailable}</b> belum diproses`;
    const list = map.items.filter(mappingFilter);
    $r("#mappingList").innerHTML = list.slice(0, 40).map(mapItemHtml).join("") || `<p class="muted">Tidak ada bahan pada filter ini.</p>`;
    if (list.length > 40) $r("#mappingList").insertAdjacentHTML("beforeend", `<p class="muted tiny">Menampilkan 40 dari ${list.length} bahan. Gunakan pencarian atau filter.</p>`);
  }
  const unitChips = i => i.units.map(u => `<span class="rec-badge">${esc(u.unit)}</span>`).join("");
  function statusBadge(i) {
    const st = mapStatus(i), m = i.mapping;
    if (st === "verified") return `<span class="rec-badge ok">Terverifikasi → ${esc(m.target.product_name)} (${esc(m.target.nama_satuan)})</span>`;
    if (st === "pantry") return `<span class="rec-badge">Sudah ada di dapur</span>`;
    if (st === "unavailable") return `<span class="rec-badge off">Tidak dijual</span>`;
    return `<span class="rec-badge warn">${m && m.inactive ? "Produk pasangan nonaktif" : "Belum dipetakan"}</span>`;
  }
  function mapItemHtml(i) {
    const open = map.open === i.key;
    return `<article class="map-item" data-map="${esc(i.key)}"><button type="button" class="map-head" data-map-toggle aria-expanded="${open}">
        <div><strong>${esc(i.name)}</strong><small>dipakai di ${i.recipe_count} resep · satuan resep: ${unitChips(i)}</small></div>${statusBadge(i)}</button>${open ? mapEditorHtml(i) : ""}</article>`;
  }
  function mapEditorHtml(i) {
    const m = i.mapping || {}, st = m.status || "verified", conv = i.convertibility || [];
    const suggestions = (i.suggestions || []).map(s => `<div class="map-suggest"><strong>${esc(s.name)} <span class="rec-badge ${s.kind === "tepat" ? "ok" : "warn"}">${s.kind === "tepat" ? "nama sama" : "nama mirip"}</span></strong>${s.units.map(u => `<button type="button" class="map-unit" data-map-use="${u.id_satuan}" data-label="${esc(s.name + " · " + u.label)}" data-unit-name="${esc(u.nama_satuan)}">${esc(u.label)}<small>${rp(u.harga)}${u.available ? "" : " · habis"}</small></button>`).join("")}</div>`).join("");
    const selected = m.target ? `${m.target.product_name} · ${m.target.label} (${rp(m.target.harga)})` : "";
    return `<div class="map-editor"><label class="cat-field">Status bahan<select data-map-status><option value="verified" ${st === "verified" ? "selected" : ""}>Cocok dengan produk toko</option><option value="pantry" ${st === "pantry" ? "selected" : ""}>Sudah ada di dapur (tidak dijual / tidak dihitung)</option><option value="unavailable" ${st === "unavailable" ? "selected" : ""}>Tidak dijual di toko</option></select></label>
      <div data-map-product ${st === "verified" ? "" : "hidden"}>
        <p class="rec-note">Produk terpilih: <strong id="mapSelected">${selected ? esc(selected) : "belum dipilih"}</strong><input type="hidden" id="mapUnitId" value="${m.id_satuan || ""}"></p>
        ${suggestions ? `<p class="muted tiny">Saran nama yang sama/mirip (belum diterapkan; periksa dulu sebelum memakai):</p>${suggestions}` : `<p class="muted tiny">Tidak ada saran otomatis. Cari produk secara manual.</p>`}
        <div class="rp-search-admin"><input type="search" id="mapSearch" placeholder="Cari produk di katalog…" autocomplete="off"><button type="button" class="button button-outline" data-map-search>Cari</button></div>
        <div id="mapResults"></div>
        <div class="map-conv"><strong>Konversi satuan resep → satuan jual</strong>
          ${conv.length ? conv.map(c => `<div class="map-conv-row"><span class="rec-badge ${c.mode === "manual" ? "warn" : "ok"}">${esc(c.unit)}: ${c.mode === "otomatis" ? "otomatis" : c.mode === "faktor" ? "faktor admin" : "ditentukan pelanggan"}</span>
            <label class="cat-field">1 satuan jual berisi … ${esc(c.unit)} <input type="number" min="0" step="any" data-factor="${esc(c.unit)}" value="${m.factors && m.factors[c.unit] ? m.factors[c.unit] : ""}" placeholder="${c.per_unit ? "otomatis: " + c.per_unit : "kosongkan = pelanggan menentukan jumlah"}"></label></div>`).join("")
            : i.units.map(u => `<div class="map-conv-row"><span class="rec-badge">${esc(u.unit)}</span><label class="cat-field">1 satuan jual berisi … ${esc(u.unit)} <input type="number" min="0" step="any" data-factor="${esc(u.unit)}" value="${m.factors && m.factors[u.unit] ? m.factors[u.unit] : ""}" placeholder="kosongkan = otomatis jika memungkinkan"></label></div>`).join("")}
          <p class="muted tiny">Gram↔gram/kg dan ml↔ml/liter dihitung otomatis. Satuan lain (butir, siung, sdm…) hanya dihitung jika Anda mengisi faktornya atau kata satuannya sama; jika tidak, pelanggan menentukan sendiri jumlahnya. Faktor hanya perkiraan, isi bila Anda yakin.</p></div></div>
      <label class="cat-field">Catatan (opsional)<input data-map-note value="${esc(m.note || "")}" maxlength="300"></label>
      <p class="admin-error" data-map-error hidden></p>
      <div class="cat-actions"><button type="button" class="button button-orange" data-map-save>Simpan pemetaan</button>${i.mapping ? `<button type="button" class="button button-outline" data-map-delete>Hapus pemetaan</button>` : ""}</div></div>`;
  }
  async function searchProducts(query) {
    const box = $r("#mapResults"); box.innerHTML = `<p class="muted tiny">Mencari…</p>`;
    try {
      const data = await api(`/api/products?q=${encodeURIComponent(query.trim())}`), list = Array.isArray(data) ? data : data.items || [];
      box.innerHTML = list.slice(0, 8).map(p => `<div class="map-suggest"><strong>${esc(p.name)}</strong>${p.variants.flatMap(v => v.units.map(u => `<button type="button" class="map-unit" data-map-use="${u.id_satuan}" data-label="${esc(p.name + " · " + ([v.merk, v.nama_varian].filter(Boolean).join(" ") || "Default") + " " + u.nama_satuan)}" data-unit-name="${esc(u.nama_satuan)}">${esc([v.merk, v.nama_varian].filter(Boolean).join(" ") || "Default")} · ${esc(u.nama_satuan)}<small>${rp(u.harga)}</small></button>`)).join("")}</div>`).join("") || `<p class="muted tiny">Produk tidak ditemukan.</p>`;
    } catch (error) { box.innerHTML = `<p class="admin-error">${esc(error.message)}</p>`; }
  }
  async function saveMapping(card) {
    const key = card.dataset.map, err = card.querySelector("[data-map-error]"), status = card.querySelector("[data-map-status]").value;
    const factors = {}; card.querySelectorAll("[data-factor]").forEach(el => { const v = Number(el.value); if (el.value !== "" && v > 0) factors[el.dataset.factor] = v; });
    const unitId = Number(card.querySelector("#mapUnitId")?.value || 0);
    err.hidden = true;
    if (status === "verified" && !unitId) { err.textContent = "Pilih produk dan satuan jualnya terlebih dahulu."; err.hidden = false; return; }
    try {
      await api("/api/admin/recipe-mapping", { method: "PUT", body: JSON.stringify({ ingredient_key: key, status, id_satuan: unitId || null, factors, note: card.querySelector("[data-map-note]").value }) });
      toast("Pemetaan tersimpan."); map.open = null; await loadMapping();
    } catch (error) { err.textContent = error.message || "Gagal menyimpan."; err.hidden = false; }
  }

  // ======================= Event =======================
  document.addEventListener("click", async event => {
    const t = event.target;
    if (t.closest("#recipesPanel")) {
      const edit = t.closest("[data-rec-edit]"); if (edit) { openRecipeEditor(edit.dataset.recEdit); return; }
      if (t.closest("[data-rec-close]")) { $r("#recipeEditor").hidden = true; return; }
      if (t.closest("[data-rec-reset]")) { if (confirm("Kembalikan resep ini ke data asli Excel? Foto, alat, tanda matang, dan tips yang Anda isi akan dihapus.")) { try { await api(`/api/admin/recipes/${encodeURIComponent(rec.editing.id)}`, { method: "DELETE" }); toast("Dikembalikan ke data asli."); $r("#recipeEditor").hidden = true; await loadRecipes(); } catch (error) { toast(error.message); } } return; }
      const chip = t.closest("[data-rec-filter]"); if (chip) { rec.filter = chip.dataset.recFilter; $r("#recipesPanel").querySelectorAll("[data-rec-filter]").forEach(b => b.classList.toggle("active", b === chip)); renderRecipes(); }
    }
    if (t.closest("#mappingPanel")) {
      const chip = t.closest("[data-map-filter]"); if (chip) { map.filter = chip.dataset.mapFilter; $r("#mappingPanel").querySelectorAll("[data-map-filter]").forEach(b => b.classList.toggle("active", b === chip)); map.open = null; renderMapping(); return; }
      const card = t.closest("[data-map]"); if (!card) return;
      if (t.closest("[data-map-toggle]")) { map.open = map.open === card.dataset.map ? null : card.dataset.map; renderMapping(); const open = $r(`[data-map="${map.open}"]`); if (open) open.scrollIntoView({ block: "nearest" }); return; }
      const use = t.closest("[data-map-use]");
      if (use) { card.querySelector("#mapUnitId").value = use.dataset.mapUse; card.querySelector("#mapSelected").textContent = use.dataset.label; card.querySelectorAll(".map-unit").forEach(b => b.classList.toggle("active", b === use)); return; }
      if (t.closest("[data-map-search]")) { const q = card.querySelector("#mapSearch").value; if (q.trim()) searchProducts(q); return; }
      if (t.closest("[data-map-save]")) { saveMapping(card); return; }
      if (t.closest("[data-map-delete]")) { if (confirm("Hapus pemetaan bahan ini?")) { try { await api("/api/admin/recipe-mapping", { method: "DELETE", body: JSON.stringify({ ingredient_key: card.dataset.map }) }); toast("Pemetaan dihapus."); map.open = null; await loadMapping(); } catch (error) { toast(error.message); } } }
    }
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-map-status]")) { const card = event.target.closest("[data-map]"); card.querySelector("[data-map-product]").hidden = event.target.value !== "verified"; }
    if (event.target.id === "recPhotoFile") {
      const file = event.target.files[0], box = $r("#recPhotoPreview");
      if (file) { const url = URL.createObjectURL(file); box.innerHTML = `<img src="${url}" alt="Pratinjau foto baru">`; }
    }
  });
  document.addEventListener("submit", event => { if (event.target.id === "recipeForm") { event.preventDefault(); saveRecipe(event.target); } });
  document.addEventListener("input", event => {
    if (event.target.id === "recipeSearch") { rec.q = event.target.value; renderRecipes(); }
    if (event.target.id === "mappingSearch") { map.q = event.target.value; renderMapping(); }
  });
  document.addEventListener("keydown", event => { if (event.key === "Enter" && event.target.id === "mapSearch") { event.preventDefault(); if (event.target.value.trim()) searchProducts(event.target.value); } });

  window.loadRecipesAdmin = () => { if (!rec.loaded) loadRecipes(); else renderRecipes(); };
  window.loadMappingAdmin = () => loadMapping();
})();
