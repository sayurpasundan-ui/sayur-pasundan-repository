const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
let activeOrder = null, tickTimer = null;
const state = { code: "", phone: "", whatsappUrl: "" };

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options, headers: { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Permintaan gagal (${response.status})`);
  return data;
}
function message(text, error = false, target = "#orderMessage") { const node = $(target); if (!node) return; node.textContent = text; node.classList.toggle("is-error", error); node.hidden = !text; }
function statusSteps(order) {
  const transfer = order.payment_method !== "cod";
  const steps = transfer ? ["Menunggu Pembayaran", "Menunggu Verifikasi", "Diproses", "Dikirim", "Selesai"] : ["Diproses", "Dikirim", "Pembayaran COD", "Selesai"];
  let active = 0;
  if (order.payment_status === "awaiting_verification") active = 1;
  else if (order.payment_status === "rejected") active = 0;
  else if (order.payment_status === "paid" || order.payment_status === "cod_unpaid") active = transfer ? 2 : 0;
  if (order.status === "delivering") active = transfer ? 3 : (order.payment_status === "cod_paid" ? 2 : 1);
  if (order.status === "completed") active = steps.length - 1;
  if (order.status === "cancelled" || order.payment_status === "expired") return `<p class="order-alert is-error">${esc(order.display_status)}. Untuk bantuan, hubungi toko.</p>`;
  return `<ol class="order-step-list">${steps.map((step, index) => `<li class="${index < active ? "is-done" : index === active ? "is-current" : ""}"><span>${index < active ? "✓" : index + 1}</span><small>${esc(step)}</small></li>`).join("")}</ol>`;
}
function renderItems(order) {
  const target = $("#orderItems");
  target.innerHTML = `<h3>Rincian barang</h3>` + order.items.map(item => `<div class="order-item-row"><span><strong>${esc(item.product_name)}</strong><small>${esc(item.variant_label || "")} ${item.variant_label ? "·" : ""} ${esc(item.quantity)} × ${esc(item.unit_label)}</small></span><strong>${rupiah(item.line_total)}</strong></div>`).join("");
}
function renderMoney(order) {
  const rows = [
    ["Subtotal barang", order.subtotal],
    ["Ongkos kirim", Number(order.shipping_fee) ? order.shipping_fee : 0],
    ["Total pesanan", order.total, true]
  ];
  if (order.payment_method !== "cod" && order.payment_status !== "legacy") rows.push(["Kode unik transfer", order.payment_unique_code, false, true], ["Total yang harus ditransfer", order.payment_amount, true]);
  $("#orderMoneyLines").innerHTML = rows.map(([label, value, total, code]) => `<div class="${total ? "is-total" : ""}"><span>${esc(label)}</span><strong>${code ? String(value || 0).padStart(3, "0") : rupiah(value)}</strong></div>`).join("");
}
function copyButton(value, label) { return `<button type="button" class="button button-outline copy-account" data-copy="${esc(value)}">${esc(label || "Salin")}</button>`; }
function renderPayment(order) {
  const card = $("#paymentInstructionCard"), account = $("#paymentAccountDetails"), upload = $("#paymentUploadBlock"), deadline = $("#paymentDeadline");
  const method = order.method || {}, transfer = order.payment_method !== "cod" && order.payment_status !== "legacy";
  card.hidden = false;
  $("#paymentTitle").textContent = method.name ? `Pembayaran ${method.name}` : "Informasi pembayaran";
  let details = "";
  if (order.payment_method === "cod") {
    details += `<div class="payment-account-row"><strong>Bayar di tempat (COD)</strong><p>Total dibayar saat barang tiba: <b>${rupiah(order.total)}</b></p></div>`;
    details += `<p class="muted tiny">Siapkan pembayaran saat kurir menyerahkan pesanan. Admin akan menandai pembayaran COD sudah diterima.</p>`;
  } else if (transfer) {
    details += `<div class="payment-account-row">${method.logo_url ? `<img class="payment-method-logo" src="${esc(method.logo_url)}" alt="Logo ${esc(method.name || "metode pembayaran")}">` : ""}<strong>${esc(method.name || "Transfer manual")}</strong>`;
    if (method.account_number) details += `<div class="account-number"><span>${esc(method.account_number)}</span>${copyButton(method.account_number)}</div>`;
    if (method.account_name) details += `<p>Nama pemilik rekening: <strong>${esc(method.account_name)}</strong></p>`;
    else details += `<p class="muted tiny">Nama pemilik akun belum dilengkapi oleh toko.</p>`;
    if (method.instructions) details += `<p class="muted tiny">${esc(method.instructions)}</p>`;
    details += `<p>Total yang harus ditransfer: <strong>${rupiah(order.payment_amount)}</strong></p></div>`;
    deadline.hidden = !order.payment_due_at;
    if (order.payment_due_at) $("#paymentDeadlineDate").textContent = `Batas: ${new Date(order.payment_due_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`;
    upload.hidden = !["awaiting_payment", "rejected"].includes(order.payment_status);
    if (order.payment_status === "awaiting_verification") details += `<p class="order-alert">Bukti pembayaran sudah diterima. Pesanan menunggu verifikasi admin.</p>`;
    if (order.payment_status === "rejected") details += `<p class="order-alert is-error">Bukti pembayaran ditolak. ${esc(order.latest_proof?.review_note || "Silakan unggah bukti yang benar sebelum batas waktu.")}</p>`;
    if (order.payment_status === "paid") details += `<p class="order-alert">Pembayaran telah diverifikasi.</p>`;
    if (order.payment_status === "expired") details += `<p class="order-alert is-error">Batas waktu pembayaran berakhir. Pesanan dibatalkan otomatis.</p>`;
  } else { details = `<p class="muted">Informasi pembayaran untuk pesanan lama tidak tersedia dalam alur Tahap 2.</p>`; deadline.hidden = true; upload.hidden = true; }
  account.innerHTML = details;
  account.querySelectorAll("[data-copy]").forEach(button => button.addEventListener("click", async () => { try { await navigator.clipboard.writeText(button.dataset.copy); button.textContent = "Tersalin ✓"; } catch { button.textContent = button.dataset.copy; } }));
  if (!transfer) { deadline.hidden = true; upload.hidden = true; }
  if (order.latest_proof?.status === "verified") message("Bukti pembayaran telah diverifikasi.", false, "#proofMessage");
  else message("", false, "#proofMessage");
  if (tickTimer) clearInterval(tickTimer);
  if (order.payment_due_at && transfer && ["awaiting_payment", "rejected"].includes(order.payment_status)) {
    const tick = () => { const left = Date.parse(order.payment_due_at) - Date.now(); if (left <= 0) { $("#paymentCountdown").textContent = "Waktu pembayaran berakhir"; return; }
      const h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000), s = Math.floor(left % 60000 / 1000);
      $("#paymentCountdown").textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };
    tick(); tickTimer = setInterval(tick, 1000);
  }
}
const PUSH_ORDERS_KEY = "sp-push-orders-v1";
function pushOrders() { try { const v = JSON.parse(localStorage.getItem(PUSH_ORDERS_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
function rememberPushOrder(code) { try { localStorage.setItem(PUSH_ORDERS_KEY, JSON.stringify([...new Set([...pushOrders(), code])].slice(-30))); } catch {} }
function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function renderHistory(order) {
  const box = $("#orderHistory"); if (!box) return;
  const items = Array.isArray(order.history) ? order.history : [];
  if (!items.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<h3>Riwayat status</h3><ol class="history-list">${items.slice().reverse().map((entry, index) =>
    `<li class="${index === 0 ? "is-latest" : ""}"><span class="history-dot" aria-hidden="true"></span><div><strong>${esc(entry.label)}</strong><small>${esc(formatTime(entry.at))}</small>${entry.note ? `<p>Catatan toko: ${esc(entry.note)}</p>` : ""}</div></li>`).join("")}</ol>`;
}
async function renderPushBox(order) {
  const box = $("#pushBox"); if (!box) return;
  const finished = order.status === "completed" || order.status === "cancelled" || order.payment_status === "expired";
  if (finished || !window.SPPush || !SPPush.supported()) { box.hidden = true; return; }
  box.hidden = false;
  const active = SPPush.permission() === "granted" && pushOrders().includes(order.order_code) && Boolean(await SPPush.currentSub());
  if (active) { box.innerHTML = `<p class="push-on">Notifikasi aktif di HP ini. Anda akan diberi tahu saat status pesanan berubah.</p>`; return; }
  if (SPPush.permission() === "denied") { box.innerHTML = `<p class="muted">Notifikasi diblokir di browser ini. Aktifkan lewat pengaturan situs bila ingin menerima kabar status pesanan.</p>`; return; }
  box.innerHTML = `<button type="button" class="button button-outline" id="enablePush">Aktifkan notifikasi status pesanan</button><p class="muted tiny" id="pushMessage" hidden></p>`;
  $("#enablePush").addEventListener("click", async event => {
    const button = event.currentTarget, note = $("#pushMessage"); button.disabled = true; note.hidden = true;
    try {
      await SPPush.enable("/api/push/subscribe", { role: "customer", order_code: order.order_code, customer_phone: state.phone });
      rememberPushOrder(order.order_code); renderPushBox(order);
    } catch (error) { note.textContent = error.message || "Notifikasi belum dapat diaktifkan."; note.hidden = false; button.disabled = false; }
  });
}
function renderOrder(order) {
  activeOrder = order; $("#orderResult").hidden = false;
  $("#orderCodeTitle").textContent = order.order_code;
  $("#orderStatusPill").textContent = order.display_status;
  $("#orderStatusPill").classList.toggle("is-cancelled", order.status === "cancelled" || order.payment_status === "expired");
  $("#orderCreatedAt").textContent = `Dibuat ${new Date(order.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`;
  $("#orderProgress").innerHTML = statusSteps(order);
  renderHistory(order); renderPushBox(order);
  renderItems(order); renderMoney(order);
  $("#orderAddress").textContent = `Alamat pengantaran: ${order.customer_address}, ${order.customer_district}, ${order.customer_city}${order.customer_province ? `, ${order.customer_province}` : ""}${order.distance_km != null ? ` · jarak estimasi ${Number(order.distance_km).toFixed(2).replace(".",",")} km` : ""}`;
  const mapLink = $("#orderMapLink");
  if (mapLink) {
    let safeMapUrl = "";
    try { const parsed = new URL(String(order.customer_map_url || "")); const host = parsed.hostname.toLowerCase(); if (["https:","http:"].includes(parsed.protocol) && (["google.com","www.google.com","maps.google.com","maps.app.goo.gl","goo.gl","earth.google.com"].includes(host) || host.endsWith(".google.com"))) safeMapUrl = parsed.href; } catch {}
    mapLink.hidden = !safeMapUrl;
    if (safeMapUrl) mapLink.href = safeMapUrl; else mapLink.removeAttribute("href");
  }
  $("#orderWhatsapp").href = state.whatsappUrl || order.whatsapp_url || "https://wa.me/6281221031765";
  renderPayment(order);
  const proofForm = $("#proofForm");
  if (proofForm) proofForm.onsubmit = uploadProof;
}
async function track(code = state.code, phone = state.phone) {
  if (!code || !phone) return;
  message("Memuat status pesanan…");
  try {
    const data = await api("/api/orders/track", { method: "POST", body: JSON.stringify({ order_code: code, customer_phone: phone }) });
    state.code = data.order.order_code; state.phone = phone;
    renderOrder(data.order); message("");
  } catch (error) { $("#orderResult").hidden = true; message(error.message || "Pesanan tidak dapat ditemukan.", true); }
}
const PROOF_MAX_BYTES = 1200000;
// Foto bukti transfer dikecilkan otomatis di perangkat (JPEG, sisi terpanjang 1600 px) agar cepat terunggah.
async function shrinkImage(file, targetBytes = 900000) {
  if (!/^image\/(jpeg|png)$/.test(file.type)) return file;
  if (file.type === "image/jpeg" && file.size <= targetBytes) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const baseName = String(file.name || "bukti").replace(/\.[^.]+$/, "") || "bukti";
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", Math.max(0.5, 0.82 - attempt * 0.07)));
      if (blob && blob.size <= targetBytes) return new File([blob], baseName + ".jpg", { type: "image/jpeg" });
      scale *= 0.8;
    }
  } catch { /* gunakan file asli bila browser tidak mendukung */ }
  return file;
}
async function uploadProof(event) {
  event.preventDefault(); if (!activeOrder || !state.code || !state.phone) return;
  const form = new FormData(event.currentTarget); form.set("customer_phone", state.phone);
  const button = $("button[type='submit']", event.currentTarget); button.disabled = true; button.textContent = "Memproses foto…";
  try {
    const original = form.get("file");
    if (original && original.size) {
      const prepared = await shrinkImage(original);
      if (prepared.size > PROOF_MAX_BYTES) throw new Error("Ukuran file terlalu besar (maksimal 1,2 MB). Gunakan foto/tangkapan layar atau PDF yang lebih kecil.");
      form.set("file", prepared, prepared.name);
    }
    button.textContent = "Mengunggah…";
    await api(`/api/orders/${encodeURIComponent(state.code)}/proof`, { method: "POST", body: form });
    message("Bukti berhasil diunggah. Pesanan menunggu verifikasi admin.", false, "#proofMessage");
    await track(state.code, state.phone);
  } catch (error) { message(error.message || "Bukti gagal diunggah.", true, "#proofMessage"); }
  finally { button.disabled = false; button.textContent = "Kirim bukti pembayaran"; }
}

const LOCAL_ORDER_HISTORY_KEY = "sp-order-history-v1";
function renderLocalOrderHistory() {
  const target = $("#localOrderHistoryList");
  if (!target) return;
  let history = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_ORDER_HISTORY_KEY) || "[]");
    history = Array.isArray(parsed) ? parsed : [];
  } catch {}
  if (!history.length) {
    target.innerHTML = '<p class="muted">Belum ada riwayat pesanan lokal di browser ini.</p>';
    return;
  }
  target.innerHTML = history.map((item, index) => `
    <div class="order-item-row">
      <span>
        <strong>${esc(item.order_code || "Pesanan")}</strong>
        <small>${esc(item.created_at ? new Date(item.created_at).toLocaleString("id-ID") : "Tanggal tidak tersedia")}</small>
        <small>${esc(item.items?.length || 0)} jenis barang · ${rupiah(item.total_estimate || 0)}</small>
      </span>
      <button class="button button-outline" type="button" data-local-order-index="${index}">Lacak</button>
    </div>`).join("");
  target.querySelectorAll("[data-local-order-index]").forEach(button => {
    button.addEventListener("click", async () => {
      const item = history[Number(button.dataset.localOrderIndex)];
      if (!item?.order_code || !item?.customer_phone) {
        message("Data pelacakan pesanan ini tidak lengkap. Masukkan kode dan nomor WhatsApp secara manual.", true);
        $("#trackForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const form = $("#trackForm");
      form.elements.order_code.value = item.order_code;
      form.elements.customer_phone.value = item.customer_phone;
      state.code = item.order_code;
      state.phone = item.customer_phone;
      state.whatsappUrl = item.whatsapp_url || "";
      await track(state.code, state.phone);
      $("#orderResult")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
renderLocalOrderHistory();
$("#trackForm")?.addEventListener("submit", async event => {
  event.preventDefault(); const fd = new FormData(event.currentTarget);
  state.code = String(fd.get("order_code") || "").trim().toUpperCase(); state.phone = String(fd.get("customer_phone") || "").trim(); state.whatsappUrl = "";
  await track();
});
$("#refreshOrder")?.addEventListener("click", () => track());
const last = (() => { try { return JSON.parse(sessionStorage.getItem("sp-last-order") || "null"); } catch { return null; } })();
if (last?.order_code && last?.customer_phone) {
  state.code = last.order_code; state.phone = last.customer_phone; state.whatsappUrl = last.whatsapp_url || "";
  const form = $("#trackForm"); if (form) { form.elements.order_code.value = state.code; form.elements.customer_phone.value = state.phone; }
  sessionStorage.removeItem("sp-last-order"); track();
} else {
  // Cadangan: buka dari ?kode=... memakai riwayat pesanan di perangkat ini
  const wanted = (new URLSearchParams(location.search).get("kode") || "").trim().toUpperCase();
  if (wanted) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(LOCAL_ORDER_HISTORY_KEY) || "[]"); } catch {}
    const found = Array.isArray(history) ? history.find(item => String(item.order_code || "").toUpperCase() === wanted) : null;
    const form = $("#trackForm");
    if (form) form.elements.order_code.value = wanted;
    if (found?.customer_phone) {
      state.code = wanted; state.phone = found.customer_phone; state.whatsappUrl = found.whatsapp_url || "";
      if (form) form.elements.customer_phone.value = state.phone;
      track();
    }
  }
}
