const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const rp = value => new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(value) || 0);
const endpoints = { products:"/api/admin/products", variants:"/api/admin/variants", units:"/api/admin/units", photos:"/api/admin/photos", orders:"/api/admin/orders", categories:"/api/admin/categories", banners:"/api/admin/banners", promotions:"/api/admin/promotions", paymentMethods:"/api/admin/payment-methods" };
const state = { tab:"dashboard", data:{ products:[], variants:[], units:[], photos:[], orders:[], categories:[], banners:[], promotions:[], paymentMethods:[] }, editing:null, settings:{} };
async function api(url, options={}) { const response = await fetch(url,{credentials:"same-origin",...options,headers:{...(options.body instanceof FormData?{}:{"content-type":"application/json"}),...(options.headers||{})}});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||`Permintaan gagal (${response.status})`);return result; }
function toast(text) { const el=$("#toast");el.textContent=text;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3000); }
function setNotice(text,show=true) { const node=$("#adminNotice");node.textContent=text;node.hidden=!show; }
function showLogin() { $("#loginPanel").hidden=false;$("#adminPanel").hidden=true; }
function showApp() { $("#loginPanel").hidden=true;$("#adminPanel").hidden=false;initNotifyCard(); }
async function checkSession() { try { await api("/api/admin/me");showApp();await loadData(); } catch { showLogin(); } }

async function login(event) {
  event.preventDefault();

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const error = $("#loginError");
  const button = $("button[type='submit']", formElement);

  button.disabled = true;
  error.hidden = true;

  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        password: String(form.get("password") || "")
      })
    });

    formElement.reset();
    showApp();
    await loadData();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

async function logout() { try { await api("/api/admin/logout",{method:"POST",body:"{}"}); } catch {}showLogin();toast("Anda sudah keluar."); }
function keyFor(tab,row) { if(tab==="variants")return row.id_varian;if(tab==="units")return row.id_satuan;if(tab==="paymentMethods")return row.code;if(tab==="orders")return row.order_code;return row.id; }
function currentItems() { return state.data[state.tab]||[]; }
const ORDER_FILTERS=[["all","Semua"],["verify","Perlu verifikasi"],["unpaid","Belum bayar"],["processed","Diproses"],["delivering","Dikirim"]];
function orderMatchesFilter(row,filter){if(filter==="verify")return row.payment_status==="awaiting_verification";if(filter==="unpaid")return["awaiting_payment","rejected"].includes(row.payment_status)&&row.status!=="cancelled";if(filter==="processed")return row.status==="processed";if(filter==="delivering")return row.status==="delivering";return true;}
function renderOrderFilters(){
  let box=$("#orderFilters");
  if(state.tab!=="orders"){if(box)box.hidden=true;return;}
  if(!box){box=document.createElement("div");box.id="orderFilters";box.className="order-filters";$(".admin-table-wrap").before(box);
    box.addEventListener("click",event=>{const chip=event.target.closest("[data-order-filter]");if(!chip)return;state.orderFilter=chip.dataset.orderFilter;renderTable();});}
  box.hidden=false;const current=state.orderFilter||"all",orders=state.data.orders||[];
  box.innerHTML=ORDER_FILTERS.map(([key,label])=>{const count=key==="all"?orders.length:orders.filter(row=>orderMatchesFilter(row,key)).length;return `<button type="button" class="order-chip${key===current?" active":""}${key==="verify"&&count?" attention":""}" data-order-filter="${key}">${label} <b>${count}</b></button>`;}).join("");
}
function filteredItems() { const q=$("#adminSearch").value.trim().toLowerCase();let list=currentItems();if(state.tab==="orders"&&state.orderFilter&&state.orderFilter!=="all")list=list.filter(row=>orderMatchesFilter(row,state.orderFilter));return q?list.filter(row=>Object.values(row).some(value=>String(value??"").toLowerCase().includes(q))):list; }
function pill(value) { const s=String(value||"").toLowerCase();let c="";if(["out_of_stock","archived","cancelled","expired","rejected"].includes(s))c="bad";else if(["draft","low_stock","pre_order","pending","awaiting_payment","awaiting_verification","cod_unpaid"].includes(s))c="warning";return `<span class="admin-status ${c}">${esc(value||"—")}</span>`; }
function actionButtons(row, tab=state.tab) { const id=esc(keyFor(tab,row));return `<div class="action-cell"><button type="button" class="table-action" data-edit="${id}">${tab==="orders"?"Detail / status":"Edit"}</button>${tab!=="orders"?`<button type="button" class="table-action danger-action" data-archive="${id}">Arsipkan</button>`:""}</div>`; }
const headersFor = {
  products:["ID / SKU","Produk","Kategori","Stok","Status stok","Publikasi","Aksi"], categories:["ID","Kategori","Slug","Status","Urutan","Aksi"],
  variants:["ID / SKU Varian","Produk induk","Merk","Nama varian","Status","Aksi"], units:["ID / Kode","Produk / varian","Satuan","Jenis","Harga","Status","Aksi"],
  photos:["ID","Produk","Foto","Sumber","Aksi"], banners:["ID","Judul","Posisi","Aktif","Urutan","Aksi"], promotions:["ID","Promo","Jenis","Nilai","Periode","Aktif","Aksi"],
  paymentMethods:["Kode","Metode","Rekening / akun","Pemilik","Jenis","Aktif","Aksi"], orders:["Kode / waktu","Pelanggan","Alamat","Total","Status pesanan","Pembayaran","Aksi"]
};
function renderTable() {
  const head=$("#tableHead"),body=$("#tableBody"),items=filteredItems(),headers=headersFor[state.tab]||[];
  head.innerHTML=`<tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>`;
  renderOrderFilters();
  if(!items.length){body.innerHTML=`<tr><td colspan="${headers.length}" class="admin-empty">${$("#adminSearch").value.trim()?"Tidak ada data yang cocok.":"Belum ada data. Tekan Tambah data untuk memulai."}</td></tr>`;return;}
  body.innerHTML=items.map(row=>{
    if(state.tab==="products")return `<tr><td><strong>${Number(row.id)}</strong><small>${esc(row.sku)}</small></td><td><strong>${esc(row.name)}</strong><small>${esc(row.short_description||"")}</small></td><td>${esc(row.category_name||"—")}</td><td>${row.stock_mode==="unlimited"?"Unlimited":Number(row.stock||0).toLocaleString("id-ID")}</td><td>${pill(row.stock_status)}</td><td>${pill(row.status)}</td><td>${actionButtons(row)}</td></tr>`;
    if(state.tab==="categories")return `<tr><td>${row.id}</td><td><strong>${esc(row.name)}</strong><small>${esc(row.description||"")}</small></td><td>${esc(row.slug)}</td><td>${pill(row.status)}</td><td>${row.sort_order||0}</td><td>${actionButtons(row)}</td></tr>`;
    if(state.tab==="variants")return `<tr><td><strong>${row.id_varian}</strong><small>${esc(row.sku_varian)}</small></td><td>${esc(row.product_name)}<small>ID ${row.product_id}</small></td><td>${esc(row.merk||"—")}</td><td>${esc(row.nama_produk_tampil||row.nama_varian||"—")}</td><td>${pill(row.status)}</td><td>${actionButtons(row)}</td></tr>`;
    if(state.tab==="units")return `<tr><td><strong>${row.id_satuan}</strong><small>${esc(row.kode_satuan)}</small></td><td>${esc(row.product_name)}<small>${esc([row.merk,row.nama_varian].filter(Boolean).join(" · "))}</small></td><td>${esc(row.nama_satuan)}</td><td>${esc(row.sale_type)}</td><td>${rp(row.harga)}</td><td>${pill(row.status)}</td><td>${actionButtons(row)}</td></tr>`;
    if(state.tab==="photos")return `<tr><td>${row.id}</td><td><strong>${esc(row.product_name_master)}</strong><small>ID ${row.product_id}</small></td><td>${row.image_url?`<a href="${esc(row.image_url)}" target="_blank" rel="noopener">Lihat foto ↗</a>`:"Belum diunggah"}</td><td>${esc([row.merk,row.nama_varian].filter(Boolean).join(" · ")||"—")}</td><td>${actionButtons(row)}</td></tr>`;
    if(state.tab==="banners")return `<tr><td>${row.id}</td><td><strong>${esc(row.title)}</strong><small>${esc(row.alt_text||"")}</small></td><td>${esc(row.position)}</td><td>${pill(Number(row.is_active)?"Aktif":"Nonaktif")}</td><td>${row.sort_order||0}</td><td>${actionButtons(row)}</td></tr>`;
    if(state.tab==="promotions")return `<tr><td>${row.id}</td><td><strong>${esc(row.title)}</strong><small>${esc(row.promo_code||row.description||"")}</small></td><td>${esc(row.promo_type)}</td><td>${row.promo_type==="percentage"?`${Number(row.promo_value)}%`:row.promo_type==="fixed_amount"?rp(row.promo_value):"Tampilan"}</td><td><small>${esc(row.starts_at||"Mulai sekarang")}</small><small>${esc(row.ends_at||"Tanpa batas")}</small></td><td>${pill(Number(row.is_active)?"Aktif":"Nonaktif")}</td><td>${actionButtons(row)}</td></tr>`;
    if(state.tab==="paymentMethods")return `<tr><td><strong>${esc(row.code)}</strong></td><td><strong>${esc(row.name)}</strong><small>${row.logo_url?"Logo tersedia":"Belum ada logo"}</small></td><td>${esc(row.account_number||"—")}</td><td>${esc(row.account_name||"—")}</td><td>${esc(row.kind)}</td><td>${pill(Number(row.is_active)?"Aktif":"Nonaktif")}</td><td>${actionButtons(row)}</td></tr>`;
    if(state.tab==="orders")return `<tr><td><strong>${esc(row.order_code)}</strong><small>${new Date(row.created_at).toLocaleString("id-ID")}</small></td><td><strong>${esc(row.customer_name)}</strong><small>${esc(row.customer_phone)}</small></td><td>${esc(row.customer_address)}<small>${esc([row.customer_district,row.customer_city,row.customer_province].filter(Boolean).join(", "))}${row.customer_map_url?` · <a target="_blank" rel="noopener" href="${esc(row.customer_map_url)}">Google Maps ↗</a>`:""}</small></td><td><strong>${rp(row.total)}</strong><small>${esc(row.payment_method_name||row.payment_method)}</small></td><td>${pill(row.status)}</td><td>${pill(row.payment_status)}</td><td>${actionButtons(row)}</td></tr>`;
    return "";
  }).join("");
  // Label kolom untuk tampilan kartu di HP
  $$("tr",body).forEach(tr=>$$("td",tr).forEach((td,i)=>{if(headers[i]&&!td.hasAttribute("colspan"))td.dataset.label=headers[i];}));
  $$('[data-edit]',body).forEach(btn=>btn.addEventListener("click",()=>{const item=currentItems().find(row=>String(keyFor(state.tab,row))===btn.dataset.edit);if(item)openEditor(item);}));
  $$('[data-archive]',body).forEach(btn=>btn.addEventListener("click",()=>archiveRecord(btn.dataset.archive)));
}
const statusOpts=[{value:"draft",label:"Draft"},{value:"active",label:"Aktif"},{value:"archived",label:"Arsip"}];
function optionList(field) {
  if(field.name==="category_id")return [{value:"",label:"— Tanpa kategori —"},...state.data.categories.map(row=>({value:row.id,label:`${row.name} (ID ${row.id})`}))];
  if(field.name==="product_id")return state.data.products.map(row=>({value:row.id,label:`${row.name} (ID ${row.id})`}));
  if(["id_varian","source_variant_id"].includes(field.name))return [{value:"",label:"— Tanpa varian sumber —"},...state.data.variants.map(row=>({value:row.id_varian,label:`${row.product_name} — ${[row.merk,row.nama_varian].filter(Boolean).join(" ")} (ID ${row.id_varian})`}))];
  return field.options||[];
}
const schemas={
 products:[{name:"sku",label:"SKU Produk",required:true},{name:"name",label:"Nama produk",required:true},{name:"slug",label:"Slug URL",required:true},{name:"category_id",label:"Kategori",type:"select"},{name:"short_description",label:"Deskripsi singkat",type:"textarea",wide:true},{name:"description",label:"Deskripsi",type:"textarea",wide:true},{name:"tips_storage",label:"Tips penyimpanan",type:"textarea",wide:true},{name:"cooking_ideas",label:"Ide masakan",type:"textarea",wide:true},{name:"stock",label:"Stok fisik (jika mode tracked)",type:"number"},{name:"stock_mode",label:"Mode stok",type:"select",options:[{value:"unlimited",label:"Unlimited (mode yang didukung saat ini)"}]},{name:"stock_status",label:"Status stok",type:"select",options:[{value:"in_stock",label:"Tersedia"},{value:"low_stock",label:"Stok menipis"},{value:"out_of_stock",label:"Habis"},{value:"pre_order",label:"Pre-order"}]},{name:"status",label:"Status publikasi",type:"select",options:statusOpts},{name:"is_featured",label:"Produk unggulan",type:"checkbox"},{name:"sort_order",label:"Urutan tampil",type:"number"}],
 categories:[{name:"name",label:"Nama kategori",required:true},{name:"slug",label:"Slug (otomatis jika kosong)"},{name:"description",label:"Deskripsi",type:"textarea",wide:true},{name:"status",label:"Status",type:"select",options:statusOpts},{name:"sort_order",label:"Urutan tampil",type:"number"}],
 variants:[{name:"product_id",label:"Produk induk",type:"select",required:true},{name:"sku_varian",label:"SKU Varian",required:true},{name:"merk",label:"Merk"},{name:"nama_varian",label:"Nama varian"},{name:"nama_produk_tampil",label:"Nama tampilan",wide:true},{name:"status",label:"Status",type:"select",options:statusOpts},{name:"sort_order",label:"Urutan tampil",type:"number"},{name:"keterangan",label:"Keterangan",type:"textarea",wide:true}],
 units:[{name:"id_varian",label:"Varian induk",type:"select",required:true},{name:"kode_satuan",label:"Kode satuan",required:true},{name:"nama_satuan",label:"Nama satuan / ukuran",required:true},{name:"sale_type",label:"Jenis penjualan",type:"select",options:[{value:"piece",label:"piece"},{value:"pack",label:"pack"},{value:"measure",label:"measure"}]},{name:"harga",label:"Harga (Rp)",type:"number",required:true},{name:"allow_nominal_purchase",label:"Izinkan pembelian nominal",type:"checkbox"},{name:"nominal_min",label:"Nominal minimum (Rp)",type:"number"},{name:"is_default",label:"Satuan default",type:"checkbox"},{name:"status",label:"Status",type:"select",options:statusOpts},{name:"sort_order",label:"Urutan tampil",type:"number"},{name:"keterangan",label:"Keterangan",type:"textarea",wide:true}],
 photos:[{name:"product_id",label:"Produk (satu foto utama)",type:"select",required:true},{name:"source_variant_id",label:"Varian sumber (opsional)",type:"select"},{name:"product_name",label:"Nama produk untuk foto"},{name:"sale_unit_label",label:"Label satuan (opsional)"},{name:"image_url",label:"Path / URL foto",wide:true,help:"Isi path atau pilih file. File akan disimpan di R2."},{name:"file",label:"Unggah foto baru",type:"file",wide:true}],
 banners:[{name:"title",label:"Judul banner",required:true},{name:"alt_text",label:"Teks alternatif",required:true},{name:"image_url",label:"Path / URL gambar desktop",required:true,wide:true},{name:"image_file",label:"Unggah gambar desktop",type:"file",wide:true},{name:"mobile_image_url",label:"Path / URL gambar mobile",wide:true},{name:"mobile_file",label:"Unggah gambar mobile (opsional)",type:"file",wide:true},{name:"link_url",label:"Tujuan klik (URL / path)",wide:true},{name:"position",label:"Posisi",type:"select",options:[{value:"hero",label:"Hero slider"},{value:"promo",label:"Banner promo"},{value:"footer",label:"Footer"}]},{name:"sort_order",label:"Urutan tampil",type:"number"},{name:"is_active",label:"Aktif ditampilkan",type:"checkbox"},{name:"starts_at",label:"Mulai (waktu lokal)",type:"datetime-local"},{name:"ends_at",label:"Berakhir (waktu lokal)",type:"datetime-local"}],
 promotions:[{name:"title",label:"Judul promo",required:true},{name:"description",label:"Keterangan",type:"textarea",wide:true},{name:"promo_type",label:"Jenis promo",type:"select",options:[{value:"display_only",label:"Informasi promo (tampilan)"},{value:"percentage",label:"Diskon persentase (belum otomatis diterapkan)"},{value:"fixed_amount",label:"Potongan nominal (belum otomatis diterapkan)"}]},{name:"promo_value",label:"Nilai promo",type:"number"},{name:"promo_code",label:"Kode promo (opsional)"},{name:"starts_at",label:"Mulai (waktu lokal)",type:"datetime-local"},{name:"ends_at",label:"Berakhir (waktu lokal)",type:"datetime-local"},{name:"is_active",label:"Aktif ditampilkan",type:"checkbox"},{name:"sort_order",label:"Urutan tampil",type:"number"}],
 paymentMethods:[{name:"code",label:"Kode metode (unik)",required:true,readonlyOnEdit:true},{name:"name",label:"Nama metode",required:true},{name:"kind",label:"Jenis",type:"select",options:[{value:"bank_transfer",label:"Transfer bank"},{value:"e_wallet",label:"E-wallet"},{value:"cod",label:"COD"}]},{name:"account_number",label:"Nomor rekening / akun"},{name:"account_name",label:"Nama pemilik"},{name:"logo_url",label:"Path / URL logo",wide:true},{name:"logo_file",label:"Unggah logo resmi",type:"file",wide:true},{name:"instructions",label:"Instruksi pembayaran",type:"textarea",wide:true},{name:"is_active",label:"Aktif ditampilkan",type:"checkbox"},{name:"sort_order",label:"Urutan tampil",type:"number"}]
};
function fieldHtml(field,value,isEdit=false) {
  const id=`field-${field.name}`,cls=field.wide?"wide":"",readonly=isEdit&&field.readonlyOnEdit?"readonly":"";
  if(field.type==="checkbox")return `<label class="check-field ${cls}"><input id="${id}" name="${field.name}" type="checkbox" ${value===true||Number(value)===1||value==="1"?"checked":""}> ${field.label}</label>`;
  if(field.type==="select")return `<label class="${cls}" for="${id}">${field.label}<select id="${id}" name="${field.name}" ${field.required?"required":""}>${optionList(field).map(o=>`<option value="${esc(o.value)}" ${String(o.value??"")===String(value??"")?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>`;
  if(field.type==="file")return `<label class="${cls}" for="${id}">${field.label}<input id="${id}" name="${field.name}" type="file" accept="image/jpeg,image/png,image/webp,image/avif"><small>JPG, PNG, WebP, AVIF; maksimal 6 MB. Bucket R2 harus terhubung.</small></label>`;
  if(field.type==="textarea")return `<label class="${cls}" for="${id}">${field.label}<textarea id="${id}" name="${field.name}" rows="3" ${field.required?"required":""}>${esc(value??"")}</textarea></label>`;
  let val=value??"";if(field.type==="datetime-local"&&val){const parsed=new Date(val);if(Number.isFinite(parsed.getTime()))val=new Date(parsed.getTime()-parsed.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  const type=field.type||"text";return `<label class="${cls}" for="${id}">${field.label}<input id="${id}" name="${field.name}" type="${type}" value="${esc(val)}" ${field.required?"required":""} ${type==="number"?'step="any"':''} ${readonly}></label>${field.help?`<small class="${cls} field-help">${esc(field.help)}</small>`:""}`;
}
function openEditor(item=null) {
  if(state.tab==="orders"){openOrderEditor(item);return;}
  const fields=schemas[state.tab]||[];state.editing=item?{...item}:null;
  const labels={products:"produk",categories:"kategori",variants:"varian",units:"satuan",photos:"foto",banners:"banner",promotions:"promo",paymentMethods:"metode pembayaran"};
  $("#dialogEyebrow").textContent=item?"EDIT DATA":"DATA BARU";$("#dialogTitle").textContent=`${item?"Ubah":"Tambah"} ${labels[state.tab]||"data"}`;
  $("#formFields").innerHTML=fields.map(field=>fieldHtml(field,item?.[field.name],Boolean(item))).join("");$("#formError").hidden=true;$("#recordDialog").showModal();
}
function waNumber(phone){const d=String(phone||"").replace(/\D/g,"");if(d.startsWith("62"))return d;if(d.startsWith("0"))return "62"+d.slice(1);if(d.startsWith("8"))return "62"+d;return d;}
function waCustomerText(order){
  const code=order.order_code,link=`${location.origin}/lacak-pesanan`,total=rp(order.payment_amount||order.total);let body;
  if(order.status==="cancelled"||order.payment_status==="expired")body=`pesanan ${code} dibatalkan.`;
  else if(order.payment_status==="awaiting_payment")body=`pesanan ${code} sudah kami terima dan menunggu pembayaran sebesar ${total}. Setelah transfer, mohon unggah bukti pembayaran di ${link}.`;
  else if(order.payment_status==="awaiting_verification")body=`bukti pembayaran pesanan ${code} sudah kami terima dan sedang kami verifikasi.`;
  else if(order.payment_status==="rejected")body=`bukti pembayaran pesanan ${code} perlu diperiksa kembali. Mohon unggah ulang di ${link}.`;
  else if(order.status==="delivering")body=`pesanan ${code} sedang dalam pengiriman.${order.payment_method==="cod"?` Mohon siapkan pembayaran ${rp(order.total)}.`:""}`;
  else if(order.status==="completed")body=`pesanan ${code} sudah selesai. Terima kasih telah berbelanja di Sayur Pasundan!`;
  else if(order.status==="processed")body=`pesanan ${code} sedang kami siapkan${order.payment_status==="paid"?" (pembayaran sudah kami terima)":""}.`;
  else body=`pesanan ${code} sudah kami terima.`;
  return `Halo ${order.customer_name}, ${body}\n\nCek status pesanan: ${link}`;
}
function waButton(order){const number=waNumber(order.customer_phone);if(number.length<9)return "";return `<p><a class="table-action" href="https://wa.me/${number}?text=${encodeURIComponent(waCustomerText(order))}" target="_blank" rel="noopener">Kirim update via WhatsApp ke pelanggan</a></p>`;}
async function initNotifyCard(){
  const card=$("#notifyCard");if(!card)return;
  let status;try{status=await api("/api/admin/notify");}catch{card.hidden=true;return;}
  const canPush=Boolean(window.SPPush&&SPPush.supported()),sub=canPush?await SPPush.currentSub():null,here=canPush&&Boolean(sub)&&SPPush.permission()==="granted";
  const channel=(label,on,hint)=>`<li class="${on?"on":"off"}"><span>${label}</span><b>${on?"Aktif":hint||"Belum diatur"}</b></li>`;
  $("#notifyBody").innerHTML=`<ul class="notify-channels">${channel("Notifikasi di HP ini",here,canPush?"Belum aktif":"Tidak didukung")}${channel("Telegram",status.telegram)}${channel("Email",status.email)}</ul><p class="muted tiny">Perangkat admin terdaftar: ${Number(status.push?.adminDevices||0)}. Telegram dan email diatur lewat secret di Cloudflare (lihat docs/NOTIFIKASI.md).</p><div class="notify-actions">${canPush&&!here?`<button class="button button-orange" id="enableAdminPush" type="button">Aktifkan notifikasi di HP ini</button>`:""}<button class="button button-outline" id="testNotify" type="button">Kirim notifikasi uji</button></div><p class="admin-error" id="notifyError" hidden></p>`;
  card.hidden=false;
  const showError=text=>{const box=$("#notifyError");box.textContent=text;box.hidden=!text;};
  $("#enableAdminPush")?.addEventListener("click",async event=>{event.currentTarget.disabled=true;showError("");try{await SPPush.enable("/api/push/subscribe",{role:"admin"});toast("Notifikasi aktif di HP ini.");await initNotifyCard();}catch(error){showError(error.message);event.currentTarget.disabled=false;}});
  $("#testNotify")?.addEventListener("click",async event=>{event.currentTarget.disabled=true;showError("");try{const out=await api("/api/admin/notify",{method:"POST",body:"{}"});const r=out.result||{};const part=(name,v)=>v?.skipped?`${name}: belum diatur`:v?.ok===true?`${name}: terkirim`:v?.sent!==undefined?`${name}: ${v.sent} terkirim, ${v.failed} gagal`:`${name}: gagal`;toast([part("HP",r.push),part("Telegram",r.telegram),part("Email",r.email)].join(" · "));}catch(error){showError(error.message);}finally{event.currentTarget.disabled=false;}});
}
function openOrderEditor(order) {
  state.editing={...order};$("#dialogEyebrow").textContent="PESANAN & PEMBAYARAN";$("#dialogTitle").textContent=`${order.order_code} · ${order.customer_name}`;
  const items=(order.items||[]).map(item=>`<li>${esc(item.product_name)} ${item.variant_label?`(${esc(item.variant_label)})`:""} — ${esc(item.quantity)} × ${esc(item.unit_label)} = ${rp(item.line_total)}</li>`).join("");
  const map=order.customer_map_url?`<p><a href="${esc(order.customer_map_url)}" target="_blank" rel="noopener">Buka titik Google Maps pelanggan ↗</a></p>`:"<p class=\"muted\">Pelanggan tidak menyertakan tautan peta.</p>";
  const proof=order.latest_proof_id?`<p><a class="table-action" href="/api/admin/payment-proofs/${Number(order.latest_proof_id)}" target="_blank" rel="noopener">Buka bukti pembayaran (${esc(order.latest_proof_status||"tersedia")})</a></p>`:`<p class="muted">Belum ada bukti pembayaran.</p>`;
  const actions=[];if(order.payment_status==="awaiting_verification"&&order.latest_proof_id&&order.latest_proof_status==="pending")actions.push({value:"verify_payment",label:"Verifikasi pembayaran"},{value:"reject_payment",label:"Tolak bukti pembayaran"});if(order.payment_method==="cod"&&order.status==="delivering"&&order.payment_status==="cod_unpaid")actions.push({value:"cod_paid",label:"Tandai pembayaran COD diterima"});
  $("#formFields").innerHTML=`<div class="wide order-admin-details"><strong>Subtotal: ${rp(order.subtotal)}</strong><p>Ongkir: ${rp(order.shipping_fee)} · Total: <b>${rp(order.total)}</b></p><p>Metode: ${esc(order.payment_method_name||order.payment_method)} · Status pembayaran: <b>${esc(order.payment_status)}</b></p>${order.payment_due_at?`<p>Batas bayar: ${esc(new Date(order.payment_due_at).toLocaleString("id-ID"))}</p>`:""}<p>Kontak: ${esc(order.customer_phone)}</p><p>Alamat: ${esc(order.customer_address)}, ${esc([order.customer_district,order.customer_city,order.customer_province].filter(Boolean).join(", "))}</p>${map}<p>Catatan: ${esc(order.notes||"—")}</p><strong>Rincian barang</strong><ul>${items||"<li>Rincian tidak tersedia</li>"}</ul>${proof}${waButton(order)}</div><label for="field-status">Status pesanan<select id="field-status" name="status"><option value="pending" ${order.status==="pending"?"selected":""}>pending — menunggu pembayaran</option><option value="processed" ${order.status==="processed"?"selected":""}>processed — diproses</option><option value="delivering" ${order.status==="delivering"?"selected":""}>delivering — dikirim</option><option value="completed" ${order.status==="completed"?"selected":""}>completed — selesai</option><option value="cancelled" ${order.status==="cancelled"?"selected":""}>cancelled — batal</option></select></label><label for="field-payment_action">Tindakan pembayaran<select id="field-payment_action" name="payment_action"><option value="none">Tidak ada tindakan pembayaran</option>${actions.map(action=>`<option value="${action.value}">${action.label}</option>`).join("")}</select></label><label for="field-review_note" class="wide">Catatan penolakan bukti<textarea id="field-review_note" name="review_note" rows="2" maxlength="300" placeholder="Contoh: nominal transfer berbeda"></textarea></label>`;
  $("#formError").hidden=true;$("#recordDialog").showModal();
}
// Gambar dikecilkan otomatis di perangkat agar muat di penyimpanan D1 (maks 1,2 MB) dan cepat dimuat pelanggan.
async function prepareImage(file,scope){
  const target=900000,maxSide=String(scope).startsWith("banners")?1920:1200;
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))return file;
  try{
    const bitmap=await createImageBitmap(file);
    if(file.size<=target&&Math.max(bitmap.width,bitmap.height)<=maxSide)return file;
    let scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
    const base=String(file.name||"gambar").replace(/\.[^.]+$/,"")||"gambar";
    for(let i=0;i<6;i++){
      const cv=document.createElement("canvas");cv.width=Math.max(1,Math.round(bitmap.width*scale));cv.height=Math.max(1,Math.round(bitmap.height*scale));
      cv.getContext("2d").drawImage(bitmap,0,0,cv.width,cv.height);
      const quality=Math.max(0.5,0.85-i*0.07);
      let blob=await new Promise(r=>cv.toBlob(r,"image/webp",quality));
      if(!blob||blob.type!=="image/webp")blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",quality));
      if(blob&&blob.size<=target)return new File([blob],base+(blob.type==="image/webp"?".webp":".jpg"),{type:blob.type});
      scale*=0.8;
    }
  }catch{/* pakai file asli bila browser tidak mendukung */}
  return file;
}
async function uploadResourceImage(file,scope="general") { if(!(file instanceof File)||!file.size)return null;const prepared=await prepareImage(file,scope);const form=new FormData();form.set("file",prepared,prepared.name);form.set("product_id",scope);return await api("/api/admin/upload",{method:"POST",body:form}); }
async function saveRecord(event) {
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),err=$("#formError");err.hidden=true;
  try {
    if(state.tab==="orders") { await api(`${endpoints.orders}/${encodeURIComponent(state.editing.order_code)}`,{method:"PATCH",body:JSON.stringify({status:data.get("status"),payment_action:data.get("payment_action"),review_note:data.get("review_note")})}); }
    else {
      const payload={};for(const [key,value] of data.entries())if(!key.endsWith("_file")&&key!=="file")payload[key]=value;
      for(const checkbox of $$('input[type="checkbox"]',form))payload[checkbox.name]=checkbox.checked?1:0;
      for(const field of schemas[state.tab]||[])if(field.type==="number"&&payload[field.name]!==undefined&&payload[field.name]!=="")payload[field.name]=Number(payload[field.name]);
      for(const field of ["starts_at","ends_at"])if(payload[field]){const parsed=new Date(payload[field]);if(!Number.isFinite(parsed.getTime()))throw new Error(`Format waktu ${field} tidak valid.`);payload[field]=parsed.toISOString();}
      const uploadMap=state.tab==="photos"?[["file","image_url"]]:state.tab==="banners"?[["image_file","image_url"],["mobile_file","mobile_image_url"]]:state.tab==="paymentMethods"?[["logo_file","logo_url"]]:[];
      for(const [fileField,targetField] of uploadMap){const file=data.get(fileField);if(file instanceof File&&file.size){const result=await uploadResourceImage(file,`${state.tab}-${payload.code||payload.product_id||payload.title||"asset"}`);payload[targetField]=result.image_url;}}
      if(state.tab==="photos"&&!payload.image_url)return err.textContent="Pilih file foto atau isi URL/path foto.",err.hidden=false,undefined;
      if(state.tab==="banners"&&!payload.image_url)return err.textContent="Pilih gambar desktop atau masukkan URL/path gambar.",err.hidden=false,undefined;
      if(state.tab==="paymentMethods"&&!payload.code&&!state.editing)return err.textContent="Kode metode wajib diisi.",err.hidden=false,undefined;
      const id=state.editing?keyFor(state.tab,state.editing):null;let url=id!=null?`${endpoints[state.tab]}/${encodeURIComponent(id)}`:endpoints[state.tab];const method=id!=null?"PUT":"POST";
      if(state.tab==="settings")throw new Error("Pengaturan memiliki formulir khusus.");
      await api(url,{method,body:JSON.stringify(payload)});
    }
    $("#recordDialog").close();toast("Perubahan berhasil disimpan.");await loadData();
  } catch(error) { err.textContent=error.message;err.hidden=false; }
}
async function archiveRecord(id) {
  const row=currentItems().find(item=>String(keyFor(state.tab,item))===String(id));if(!row)return;
  const label=state.tab==="paymentMethods"?row.name:row.title||row.name||row.order_code||id;
  if(!confirm(`Arsipkan/nonaktifkan “${label}”? Data pesanan lama akan dipertahankan.`))return;
  try{const url=state.tab==="paymentMethods"?`${endpoints[state.tab]}/${encodeURIComponent(id)}`:`${endpoints[state.tab]}/${encodeURIComponent(id)}`;await api(url,{method:"DELETE"});toast("Data berhasil diarsipkan atau dinonaktifkan.");await loadData();}catch(error){toast(error.message);}
}
function setTab(tab) {
  state.tab=tab;$$('[data-tab]').forEach(button=>button.classList.toggle("selected",button.dataset.tab===tab));
  const isDashboard=tab==="dashboard",isSettings=tab==="settings";$("#dashboardOverview").hidden=!isDashboard;$("#storeSettingsPanel").hidden=!isSettings;$("#resourcePanel").hidden=isDashboard||isSettings;
  $("#addRecord").hidden=isDashboard||isSettings||tab==="orders";$("#importCsv").hidden=tab!=="products";$("#adminSearch").value="";
  const help=$("#resourceHelp");const texts={products:"Impor CSV di sini hanya untuk data produk utama. Untuk impor workbook lengkap termasuk varian, satuan dan relasi, gunakan skrip import:excel sesuai panduan repository.",promotions:"Jenis persentase dan potongan nominal disimpan sebagai data promo. Penerapan diskon otomatis di total checkout belum aktif; jangan menjanjikan potongan sebelum aturan promo diaktifkan."};help.textContent=texts[tab]||"";help.hidden=!texts[tab];
  if(!isDashboard&&!isSettings)renderTable();if(isDashboard)loadDashboard();if(isSettings)loadSettings();
}
async function loadDashboard() {
  try{const result=await api("/api/admin/dashboard"),m=result.metrics||{};const metrics=[["Pesanan hari ini",Number(m.newOrders||0).toLocaleString("id-ID")],["Menunggu verifikasi",Number(m.awaitingVerification||0).toLocaleString("id-ID")],["Penjualan hari ini",rp(m.salesToday)],["Penjualan bulan ini",rp(m.salesMonth)]];$("#metricGrid").innerHTML=metrics.map(([label,value])=>`<article class="metric-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join("");
    $("#recentOrders").innerHTML=(result.recentOrders||[]).length?(result.recentOrders||[]).map(order=>`<button type="button" class="recent-order" data-open-order="${esc(order.order_code)}"><span><strong>${esc(order.order_code)}</strong><small>${esc(order.customer_name)} · ${new Date(order.created_at).toLocaleString("id-ID")}</small></span><span><strong>${rp(order.total)}</strong><small>${esc(order.status)} · ${esc(order.payment_status)}</small></span></button>`).join(""):'<p class="muted">Belum ada pesanan.</p>';
    $$('[data-open-order]').forEach(btn=>btn.addEventListener("click",()=>{const order=state.data.orders.find(item=>item.order_code===btn.dataset.openOrder);if(order){setTab("orders");openOrderEditor(order);}}));
  }catch(error){$("#recentOrders").innerHTML=`<p class="admin-error">${esc(error.message)}</p>`;}
  try{const [s,health]=await Promise.all([api("/api/admin/settings"),api("/api/admin/readiness")]),r=health.readiness||{},readiness=[["Nama toko",Boolean(s.store_name)], ["Nomor WhatsApp",Boolean(s.whatsapp_phone)], ["Daftar kecamatan COD",Boolean(s.cod_allowed_districts)], ["Rekening pembayaran",state.data.paymentMethods.some(method=>Number(method.is_active)&&method.account_number)], ["Database D1",Boolean(r.database)], ["Migrasi Tahap 3",Boolean(r.migrations)], ["Bucket gambar produk",Boolean(r.productImages)], ["Bucket bukti transfer privat",Boolean(r.paymentProofs)]];$("#storeReadiness").innerHTML=readiness.map(([name,ok])=>`<div class="readiness-item"><span class="readiness-mark ${ok?"ready":"pending"}">${ok?"✓":"!"}</span><span>${esc(name)}</span><strong>${ok?"Siap":"Periksa"}</strong></div>`).join("");}catch{$("#storeReadiness").innerHTML='<p class="muted">Pengaturan belum bisa diperiksa. Pastikan binding D1/R2 dan migrasi telah disiapkan.</p>';}
}
async function loadSettings() {
  const error=$("#settingsError");error.hidden=true;
  try{const values=await api("/api/admin/settings");state.settings=values;const form=$("#settingsForm");for(const input of form.elements){if(!input.name)continue;if(input.type==="checkbox")input.checked=String(values[input.name]??"0")==="1";else if(values[input.name]!=null)input.value=values[input.name];}}
  catch(err){error.textContent=err.message;error.hidden=false;}
}
async function saveSettings(event) {
  event.preventDefault();const form=event.currentTarget,payload={};for(const input of form.elements){if(!input.name)continue;payload[input.name]=input.type==="checkbox"?(input.checked?"1":"0"):input.value.trim();}
  const error=$("#settingsError");error.hidden=true;const button=$('button[type="submit"]',form);button.disabled=true;
  try{await api("/api/admin/settings",{method:"PUT",body:JSON.stringify(payload)});toast("Pengaturan toko berhasil disimpan.");await Promise.all([loadSettings(),loadData()]);}catch(err){error.textContent=err.message;error.hidden=false;}finally{button.disabled=false;}
}
async function loadData() {
  setNotice("Memuat data dari D1…");const specs=[ ["products",endpoints.products],["variants",endpoints.variants],["units",endpoints.units],["photos",endpoints.photos],["orders",endpoints.orders],["categories",endpoints.categories],["banners",endpoints.banners],["promotions",endpoints.promotions],["paymentMethods",endpoints.paymentMethods] ];
  const results=await Promise.allSettled(specs.map(([,url])=>api(url)));const issues=[];
  results.forEach((result,index)=>{const [key]=specs[index];if(result.status==="fulfilled")state.data[key]=result.value;else{state.data[key]=[];issues.push(`${key}: ${result.reason.message}`);}});
  if(issues.length)setNotice(`Sebagian data belum dapat dimuat: ${issues.join(" · ")}`);else setNotice("Semua data berhasil dimuat dari database D1.",false);
  if(state.tab!=="dashboard"&&state.tab!=="settings")renderTable();if(state.tab==="dashboard")await loadDashboard();
}
async function parseCSV(text) {
  const rows=[];let row=[],field="",quoted=false;
  for(let i=0;i<text.length;i++){const char=text[i];if(quoted){if(char==='"'&&text[i+1]==='"'){field+='"';i++;}else if(char==='"')quoted=false;else field+=char;}else if(char==='"')quoted=true;else if(char===","){row.push(field);field="";}else if(char==="\n"){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}else field+=char;}
  if(field.length||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}if(!rows.length)return [];
  const headers=rows.shift().map((h,i)=>String(h||"").replace(/^\uFEFF/,"").trim().toLowerCase().replace(/[\s-]+/g,"_"));
  return rows.filter(cells=>cells.some(v=>String(v||"").trim())).map(cells=>Object.fromEntries(headers.map((h,i)=>[h,String(cells[i]??"").trim()])));
}
async function importCSV(file) {
  if(!file)return;if(file.size>5*1024*1024){toast("CSV maksimal 5 MB.");return;}try{const rows=await parseCSV(await file.text());if(!rows.length){toast("CSV tidak berisi data.");return;}if(!confirm(`Impor ${rows.length} baris produk utama? Kolom wajib: sku, name, slug. Varian dan satuan tetap dikelola terpisah.`))return;const result=await api("/api/admin/products/import",{method:"POST",body:JSON.stringify({rows})});toast(`Impor selesai. Baru: ${result.inserted}, diperbarui: ${result.updated}.`);await loadData();}catch(error){toast(error.message||"CSV gagal diimpor.");}}
function bindEvents() {
  $("#loginForm").addEventListener("submit",login);$("#logoutButton").addEventListener("click",logout);$("#refreshData").addEventListener("click",loadData);$("#refreshDashboard").addEventListener("click",loadDashboard);$("#adminSearch").addEventListener("input",renderTable);$("#addRecord").addEventListener("click",()=>openEditor());$("#recordForm").addEventListener("submit",saveRecord);$("#dialogClose").addEventListener("click",()=>$("#recordDialog").close());$("#dialogCancel").addEventListener("click",()=>$("#recordDialog").close());
  $("#settingsForm").addEventListener("submit",saveSettings);$("#reloadSettings").addEventListener("click",loadSettings);$("#importCsv").addEventListener("click",()=>$("#csvFile").click());$("#csvFile").addEventListener("change",event=>{importCSV(event.target.files?.[0]);event.target.value="";});
  $$('[data-tab]').forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.tab)));$$('[data-go-tab]').forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.goTab)));
}
bindEvents();checkSession();
