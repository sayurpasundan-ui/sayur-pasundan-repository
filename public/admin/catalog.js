// Editor "Varian & Harga": per produk, ubah merk/varian, tambah satuan dan harga.
// Memakai API yang sudah ada (/api/admin/variants dan /api/admin/units); helper api(), toast(), esc(), rp() berasal dari admin.js.
(function () {
  const SALE_TYPES = [["piece", "Per buah / ikat (piece)"], ["pack", "Paket / kemasan (pack)"], ["measure", "Timbang, bisa dipecah (measure)"]];
  const cat = { products: [], variants: [], units: [], productId: null, loaded: false, newRows: {} };
  const $c = selector => document.querySelector(selector);
  const rand = () => Math.random().toString(36).slice(2, 7);
  const label = v => [v.merk, v.nama_varian].filter(Boolean).join(" — ") || v.nama_produk_tampil || "Default";

  async function load() {
    const [products, variants, units] = await Promise.all([api("/api/admin/products"), api("/api/admin/variants"), api("/api/admin/units")]);
    cat.products = (products || []).filter(p => String(p.status || "").toLowerCase() !== "archived");
    cat.variants = (variants || []).filter(v => String(v.status || "").toLowerCase() !== "archived");
    cat.units = (units || []).filter(u => String(u.status || "").toLowerCase() !== "archived");
    cat.loaded = true;
    if (typeof state !== "undefined") { state.data.variants = variants || []; state.data.units = units || []; }
  }

  function renderPicker() {
    const q = ($c("#catalogSearch").value || "").trim().toLowerCase();
    const list = cat.products.filter(p => !q || String(p.name || "").toLowerCase().includes(q) || String(p.sku || "").toLowerCase().includes(q));
    const select = $c("#catalogProduct");
    select.innerHTML = list.map(p => `<option value="${Number(p.id)}">${esc(p.name)}${p.category_name ? " · " + esc(p.category_name) : ""}</option>`).join("") || `<option value="">Produk tidak ditemukan</option>`;
    if (list.some(p => Number(p.id) === Number(cat.productId))) select.value = String(cat.productId);
    else cat.productId = list.length ? Number(list[0].id) : null;
    if (list.length && !select.value) select.value = String(cat.productId);
    cat.productId = select.value ? Number(select.value) : null;
  }

  function unitRow(unit, variantId, index) {
    const isNew = !unit.id_satuan, key = isNew ? unit._key : `u${unit.id_satuan}`;
    const nominal = Number(unit.allow_nominal_purchase) === 1;
    return `<div class="cat-unit" data-unit-key="${esc(key)}" data-unit-id="${isNew ? "" : Number(unit.id_satuan)}" data-variant-id="${variantId}">
      <label class="cat-field cat-wide">Satuan / ukuran<input data-f="nama_satuan" value="${esc(unit.nama_satuan || "")}" placeholder="mis. 250 gram, 1 kg, 1 ikat" maxlength="180"></label>
      <label class="cat-field">Harga (Rp)<input data-f="harga" type="number" min="0" step="1" inputmode="numeric" value="${unit.harga ?? ""}" placeholder="0"></label>
      <label class="cat-field">Jenis<select data-f="sale_type">${SALE_TYPES.map(([v, l]) => `<option value="${v}" ${String(unit.sale_type || "piece") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="cat-check"><input data-f="allow_nominal_purchase" type="checkbox" ${nominal ? "checked" : ""}> Bisa beli dengan nominal uang</label>
      <label class="cat-field" data-nominal-field ${nominal ? "" : "hidden"}>Nominal minimum (Rp)<input data-f="nominal_min" type="number" min="0" step="1" inputmode="numeric" value="${unit.nominal_min ?? ""}"></label>
      <label class="cat-check"><input type="radio" name="default-${variantId}" data-f="is_default" ${Number(unit.is_default) === 1 ? "checked" : ""}> Satuan utama</label>
      <button type="button" class="cat-link danger" data-act="remove-unit">${isNew ? "Batal" : "Arsipkan satuan"}</button>
    </div>`;
  }

  function variantCard(v, product) {
    const units = cat.units.filter(u => Number(u.id_varian) === Number(v.id_varian));
    const extra = cat.newRows[v.id_varian] || [];
    return `<article class="cat-variant" data-variant-id="${Number(v.id_varian)}">
      <header><div><span class="cat-badge">Tampil di toko</span><strong class="cat-preview" data-preview>${esc(label(v))}</strong></div>
        <button type="button" class="cat-link danger" data-act="archive-variant">Arsipkan varian</button></header>
      <div class="cat-grid">
        <label class="cat-field">Merk<input data-v="merk" value="${esc(v.merk || "")}" placeholder="mis. Fuji, Bendera" maxlength="100"></label>
        <label class="cat-field">Nama varian<input data-v="nama_varian" value="${esc(v.nama_varian || "")}" placeholder="mis. Merah, Hijau" maxlength="200"></label>
        <label class="cat-field">Status<select data-v="status"><option value="active" ${String(v.status).toLowerCase() === "active" ? "selected" : ""}>Aktif (tampil)</option><option value="inactive" ${String(v.status).toLowerCase() === "inactive" ? "selected" : ""}>Nonaktif (disembunyikan)</option></select></label>
      </div>
      <h4>Satuan &amp; harga</h4>
      <div class="cat-units">${units.map((u, i) => unitRow(u, v.id_varian, i)).join("")}${extra.map((u, i) => unitRow(u, v.id_varian, i)).join("")}${units.length + extra.length ? "" : `<p class="muted tiny">Belum ada satuan. Tambahkan satuan agar varian ini bisa dibeli.</p>`}</div>
      <div class="cat-actions"><button type="button" class="button button-outline" data-act="add-unit">+ Tambah satuan</button><button type="button" class="button button-orange" data-act="save-variant">Simpan varian ini</button></div>
      <p class="admin-error" data-error hidden></p>
    </article>`;
  }

  function renderBody() {
    const body = $c("#catalogBody"), product = cat.products.find(p => Number(p.id) === Number(cat.productId));
    if (!product) { body.innerHTML = `<p class="muted">Pilih produk terlebih dahulu.</p>`; return; }
    const variants = cat.variants.filter(v => Number(v.product_id) === Number(product.id));
    body.innerHTML = `<div class="cat-head"><div><h3>${esc(product.name)}</h3><p class="muted tiny">${variants.length} varian · perubahan langsung tampil di toko setelah disimpan</p></div><button type="button" class="button button-orange" data-act="add-variant">+ Tambah varian</button></div>`
      + (variants.map(v => variantCard(v, product)).join("") || `<p class="muted">Produk ini belum punya varian. Ketuk "Tambah varian".</p>`);
  }

  function refreshView() { renderPicker(); renderBody(); }
  async function reload() { await load(); refreshView(); }

  function readUnit(el) {
    const f = name => el.querySelector(`[data-f="${name}"]`);
    return { id: el.dataset.unitId ? Number(el.dataset.unitId) : null, key: el.dataset.unitKey,
      nama_satuan: f("nama_satuan").value.trim(), harga: Number(f("harga").value), sale_type: f("sale_type").value,
      allow_nominal_purchase: f("allow_nominal_purchase").checked ? 1 : 0, nominal_min: f("nominal_min").value === "" ? null : Number(f("nominal_min").value),
      is_default: f("is_default").checked ? 1 : 0 };
  }

  async function saveVariant(card) {
    const errorBox = card.querySelector("[data-error]"), id = Number(card.dataset.variantId);
    const showError = text => { errorBox.textContent = text; errorBox.hidden = !text; };
    showError("");
    const variant = cat.variants.find(v => Number(v.id_varian) === id), product = cat.products.find(p => Number(p.id) === Number(variant.product_id));
    const rows = [...card.querySelectorAll(".cat-unit")].map(readUnit);
    for (const r of rows) {
      if (!r.nama_satuan) return showError("Nama satuan wajib diisi (mis. 250 gram).");
      if (!Number.isFinite(r.harga) || r.harga < 0) return showError(`Harga untuk "${r.nama_satuan}" tidak valid.`);
      if (r.allow_nominal_purchase && r.nominal_min !== null && !(r.nominal_min >= 0)) return showError(`Nominal minimum "${r.nama_satuan}" tidak valid.`);
    }
    if (rows.length && !rows.some(r => r.is_default)) rows[0].is_default = 1;
    const button = card.querySelector('[data-act="save-variant"]'); button.disabled = true; button.textContent = "Menyimpan…";
    try {
      const get = name => card.querySelector(`[data-v="${name}"]`).value;
      await api(`/api/admin/variants/${id}`, { method: "PUT", body: JSON.stringify({ ...variant, merk: get("merk").trim(), nama_varian: get("nama_varian").trim(), status: get("status") }) });
      for (const r of rows) {
        const existing = r.id ? cat.units.find(u => Number(u.id_satuan) === r.id) : null;
        const payload = { ...(existing || {}), id_varian: id, nama_satuan: r.nama_satuan, harga: r.harga, sale_type: r.sale_type, allow_nominal_purchase: r.allow_nominal_purchase,
          nominal_min: r.allow_nominal_purchase ? (r.nominal_min ?? r.harga) : null, is_default: r.is_default, status: existing?.status || "active" };
        if (existing) await api(`/api/admin/units/${r.id}`, { method: "PUT", body: JSON.stringify(payload) });
        else await api("/api/admin/units", { method: "POST", body: JSON.stringify({ ...payload, kode_satuan: `${String(variant.sku_varian || "V" + id).slice(0, 40)}-U${rand()}` }) });
      }
      toast("Varian, satuan, dan harga tersimpan.");
      await reload();
    } catch (error) { showError(error.message || "Gagal menyimpan."); button.disabled = false; button.textContent = "Simpan varian ini"; }
  }

  async function onClick(event) {
    const btn = event.target.closest("[data-act]"); if (!btn) return;
    const act = btn.dataset.act, card = btn.closest(".cat-variant");
    try {
      if (act === "add-variant") {
        const product = cat.products.find(p => Number(p.id) === Number(cat.productId)); if (!product) return;
        btn.disabled = true;
        await api("/api/admin/variants", { method: "POST", body: JSON.stringify({ product_id: product.id, sku_varian: `${String(product.sku || "P" + product.id).slice(0, 60)}-V${rand()}`, merk: "", nama_varian: "", status: "active", sort_order: cat.variants.filter(v => Number(v.product_id) === Number(product.id)).length }) });
        toast("Varian baru dibuat. Isi merk/nama dan tambahkan satuan."); await reload(); return;
      }
      if (!card) return;
      const id = Number(card.dataset.variantId);
      if (act === "add-unit") {
        // Tambahkan baris baru tanpa menyegarkan kartu, agar isian lain yang belum disimpan tidak hilang.
        const holder = card.querySelector(".cat-units"); holder.querySelector(":scope > p")?.remove();
        holder.insertAdjacentHTML("beforeend", unitRow({ _key: `n${rand()}`, sale_type: "piece", is_default: 0 }, id));
        const added = holder.lastElementChild; added.querySelector('[data-f="nama_satuan"]').focus(); return;
      }
      if (act === "remove-unit") {
        const row = btn.closest(".cat-unit"), unitId = Number(row.dataset.unitId);
        if (!unitId) { row.remove(); return; }
        if (!confirm("Arsipkan satuan ini? Satuan tidak akan tampil lagi di toko (riwayat pesanan tetap aman).")) return;
        await api(`/api/admin/units/${unitId}`, { method: "DELETE" }); toast("Satuan diarsipkan."); await reload(); return;
      }
      if (act === "archive-variant") {
        if (!confirm("Arsipkan varian ini beserta satuannya? Varian tidak akan tampil lagi di toko.")) return;
        await api(`/api/admin/variants/${id}`, { method: "DELETE" }); toast("Varian diarsipkan."); await reload(); return;
      }
      if (act === "save-variant") await saveVariant(card);
    } catch (error) { toast(error.message || "Terjadi kesalahan."); btn.disabled = false; }
  }

  function onInput(event) {
    const card = event.target.closest(".cat-variant"); if (!card) return;
    if (event.target.matches('[data-v="merk"],[data-v="nama_varian"]')) {
      const m = card.querySelector('[data-v="merk"]').value.trim(), n = card.querySelector('[data-v="nama_varian"]').value.trim();
      card.querySelector("[data-preview]").textContent = [m, n].filter(Boolean).join(" — ") || "Default";
    }
    if (event.target.matches('[data-f="allow_nominal_purchase"]')) {
      const row = event.target.closest(".cat-unit"), field = row.querySelector("[data-nominal-field]"), on = event.target.checked;
      field.hidden = !on;
      if (on && !field.querySelector("input").value) field.querySelector("input").value = row.querySelector('[data-f="harga"]').value || "";
    }
  }

  window.loadCatalog = async function () {
    const panel = $c("#catalogPanel"); if (!panel) return;
    if (!panel.dataset.bound) {
      panel.dataset.bound = "1";
      panel.addEventListener("click", onClick); panel.addEventListener("input", onInput); panel.addEventListener("change", onInput);
      $c("#catalogSearch").addEventListener("input", () => { renderPicker(); renderBody(); });
      $c("#catalogProduct").addEventListener("change", event => { cat.productId = Number(event.target.value) || null; cat.newRows = {}; renderBody(); });
    }
    $c("#catalogBody").innerHTML = `<p class="muted">Memuat…</p>`;
    try { await load(); refreshView(); } catch (error) { $c("#catalogBody").innerHTML = `<p class="admin-error">${esc(error.message)}</p>`; }
  };
})();
