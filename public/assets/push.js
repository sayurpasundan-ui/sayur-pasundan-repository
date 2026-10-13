// Pembantu notifikasi di browser (Web Push). Dipakai halaman pesanan, lacak pesanan, dan admin.
(function () {
  const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const toKey = text => { const raw = atob((text + "=".repeat((4 - text.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
  async function currentSub() {
    try { const reg = await navigator.serviceWorker.getRegistration("/"); return reg ? await reg.pushManager.getSubscription() : null; } catch { return null; }
  }
  async function enable(url, body) {
    if (!supported()) throw new Error("Browser ini belum mendukung notifikasi. Di iPhone, tambahkan situs ke Layar Utama terlebih dahulu.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Izin notifikasi tidak diberikan. Aktifkan lewat pengaturan situs di browser.");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const keyResponse = await fetch("/api/push/key", { cache: "no-store" });
    if (!keyResponse.ok) throw new Error("Notifikasi belum tersedia di server.");
    const { publicKey } = await keyResponse.json();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }); }
      catch (error) { throw new Error("Browser ini belum dapat mengaktifkan notifikasi (" + (error && error.message ? error.message : "gagal") + "). Coba buka lewat Chrome biasa, bukan mode penyamaran."); }
    }
    const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, subscription: sub.toJSON() }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Notifikasi gagal diaktifkan.");
    return true;
  }
  window.SPPush = { supported, enable, currentSub, permission: () => ("Notification" in window ? Notification.permission : "denied") };
})();
