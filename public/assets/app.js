const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CART_KEY = "sayur-pasundan-cart-v1";
const store = {
  settings: {storeName:"SAYUR PASUNDAN", tagline:"Rencanakan Masakan Anda", whatsappPhone:"6281221031765", codMaxOrderTotal:200000, freeShippingMinimum:50000, nearShippingFee:5000, farShippingFee:10000, nearRadiusKm:3, warehouseLat:-7.059522, warehouseLng:107.764035}, paymentMethods: [],
  categories: [], products: [], selectedCategory: "", query: "", minPrice: "", maxPrice: "", featuredOnly: false, sort: "recommended", page: 1, pageSize: 24, cart: []
};
try { store.cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); if (!Array.isArray(store.cart)) store.cart = []; } catch { store.cart = []; }
function persistCart(){ localStorage.setItem(CART_KEY, JSON.stringify(store.cart)); renderCart(); }
function toast(message){ const el=$("#toast"); if(!el)return; el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2600); }
async function getJson(url, options={}){
  const response=await fetch(url,{credentials:"same-origin",...options,headers:{...(options.body instanceof FormData?{}:{"content-type":"application/json"}),...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error = new Error(data.error || `Permintaan gagal (${response.status})`);
    Object.assign(error, data);
    error.status = response.status;
    throw error;
  }
  return data;
}
function imageUrl(value){const src=String(value||"").trim();if(!src)return "";if(src.startsWith("https://")||(src.startsWith("/")&&!src.startsWith("//")))return src;return "";}
function normalText(value){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
function variantsOf(product){return Array.isArray(product?.variants)?product.variants:[];}
function unitsOf(variant){return Array.isArray(variant?.units)?variant.units:[];}
function chosenVariant(card,product){const id=Number($("[data-role='variant']",card)?.value);return variantsOf(product).find(v=>Number(v.id_varian)===id)||variantsOf(product)[0];}
function chosenUnit(card,variant){const id=Number($("[data-role='unit']",card)?.value);return unitsOf(variant).find(u=>Number(u.id_satuan)===id)||unitsOf(variant)[0];}
function minPrice(product){const prices=variantsOf(product).flatMap(v=>unitsOf(v).map(u=>Number(u.harga))).filter(n=>Number.isFinite(n)&&n>=0);return prices.length?Math.min(...prices):Infinity;}
function maxPrice(product){const prices=variantsOf(product).flatMap(v=>unitsOf(v).map(u=>Number(u.harga))).filter(n=>Number.isFinite(n)&&n>=0);return prices.length?Math.max(...prices):Infinity;}
function soldCount(product){return Number(product?.units_sold||0);}
function isUnavailable(product){return String(product?.status||"").toLowerCase()!=="active" || (String(product?.stock_mode||"unlimited").toLowerCase()!=="unlimited" && String(product?.stock_status||"").toLowerCase()==="out_of_stock");}
function stockText(product){if(String(product?.stock_mode||"unlimited").toLowerCase()==="unlimited")return ["Tersedia",""];const s=String(product?.stock_status||"").toLowerCase();if(s==="out_of_stock")return ["Stok habis","none"];if(s==="low_stock")return ["Stok menipis","low"];if(s==="pre_order")return ["Pre-order","low"];return ["Tersedia",""];}
function visibleProducts(){
  let results=store.products.filter(p=>{
    if(store.selectedCategory && String(p.category_id)!==String(store.selectedCategory))return false;
    if(store.featuredOnly && Number(p.is_featured)!==1)return false;
    const low=store.minPrice===""?null:Number(store.minPrice), high=store.maxPrice===""?null:Number(store.maxPrice), min=minPrice(p), max=maxPrice(p);
    if(low!==null && Number.isFinite(low) && max<low)return false;
    if(high!==null && Number.isFinite(high) && min>high)return false;
    if(store.query){const q=normalText(store.query);const hay=normalText([p.name,p.short_description,p.category_name,...variantsOf(p).flatMap(v=>[v.merk,v.nama_varian,v.nama_produk_tampil])].join(" "));if(!hay.includes(q))return false;}
    return true;
  });
  const dateValue=p=>Date.parse(p.created_at||p.updated_at||"")||0;
  if(store.sort==="latest")results.sort((a,b)=>dateValue(b)-dateValue(a)||Number(b.id)-Number(a.id));
  else if(store.sort==="best")results.sort((a,b)=>soldCount(b)-soldCount(a)||Number(b.is_featured)-Number(a.is_featured)||a.name.localeCompare(b.name,"id"));
  else if(store.sort==="price-asc")results.sort((a,b)=>minPrice(a)-minPrice(b)||a.name.localeCompare(b.name,"id"));
  else if(store.sort==="price-desc")results.sort((a,b)=>maxPrice(b)-maxPrice(a)||a.name.localeCompare(b.name,"id"));
  else results.sort((a,b)=>Number(b.is_featured)-Number(a.is_featured)||Number(a.sort_order||0)-Number(b.sort_order||0)||a.name.localeCompare(b.name,"id"));
  return results;
}
function renderCategories(){
  const holder=$("#categoryChips");if(!holder)return;
  const all=`<button type="button" class="chip ${store.selectedCategory===""?"active":""}" data-category="">Semua</button>`;
  holder.innerHTML=all+store.categories.map(c=>`<button type="button" class="chip ${String(store.selectedCategory)===String(c.id)?"active":""}" data-category="${Number(c.id)}">${escapeHtml(c.name)}</button>`).join("");
  $$('[data-category]',holder).forEach(button=>button.addEventListener("click",()=>{store.selectedCategory=button.dataset.category||"";store.page=1;syncUrlFilters();renderCategories();renderProducts();}));
  syncQuickCategoryState();
}
const quickCategoryAliases={sayur:["sayur","vegetable"],buah:["buah","fruit"],bumbu:["bumbu","rempah","spice"],lauk:["lauk","pauk","protein","ikan","daging"],dapur:["perlengkapan dapur","peralatan dapur","alat dapur"],groceries:["groceries","bahan pokok","sembako","kebutuhan dapur"]};
function categoryForQuickKey(key){const aliases=quickCategoryAliases[key]||[key];return store.categories.find(category=>aliases.some(alias=>normalText(category.name).includes(normalText(alias))))||null;}
function syncQuickCategoryState(){const selected=store.categories.find(category=>String(category.id)===String(store.selectedCategory));const selectedName=normalText(selected?.name||"");$$('[data-category-key]').forEach(tile=>{const aliases=quickCategoryAliases[tile.dataset.categoryKey]||[];tile.classList.toggle("active",Boolean(selected&&aliases.some(alias=>selectedName.includes(normalText(alias)))));});}
function setupQuickCategories(){ $$('[data-category-key]').forEach(tile=>tile.addEventListener("click",()=>{const category=categoryForQuickKey(tile.dataset.categoryKey);if(category){store.selectedCategory=String(category.id);store.query="";$("#searchInput").value="";}else{store.selectedCategory="";store.query=(quickCategoryAliases[tile.dataset.categoryKey]||[tile.dataset.categoryKey])[0];$("#searchInput").value=store.query;}store.page=1;syncUrlFilters();renderCategories();renderProducts();$("#katalog").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});})); }
function setupHeroCarousel(){
 const slider=$("#heroSlider");if(!slider)return;const slides=$$(".hero-slide",slider),dots=$$("[data-hero-dot]",slider);if(!slides.length)return;let active=0,timer=null;const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 function show(next){active=(next+slides.length)%slides.length;slides.forEach((slide,i)=>{const yes=i===active;slide.classList.toggle("is-active",yes);slide.setAttribute("aria-hidden",String(!yes));if("inert" in slide)slide.inert=!yes;});dots.forEach((dot,i)=>{const yes=i===active;dot.classList.toggle("is-active",yes);dot.setAttribute("aria-current",String(yes));});}
 function stop(){if(timer){clearInterval(timer);timer=null;}}function start(){stop();if(!reduced&&!document.hidden)timer=setInterval(()=>show(active+1),6500);}
 $("#heroPrev")?.addEventListener("click",()=>{show(active-1);start();});$("#heroNext")?.addEventListener("click",()=>{show(active+1);start();});dots.forEach((dot,i)=>dot.addEventListener("click",()=>{show(i);start();}));
 let startX=null;slider.addEventListener("touchstart",e=>{startX=e.changedTouches[0]?.clientX??null;stop();},{passive:true});slider.addEventListener("touchend",e=>{if(startX!==null){const delta=e.changedTouches[0].clientX-startX;if(Math.abs(delta)>40)show(active+(delta<0?1:-1));}startX=null;start();},{passive:true});
 slider.addEventListener("mouseenter",stop);slider.addEventListener("mouseleave",start);slider.addEventListener("focusin",stop);slider.addEventListener("focusout",()=>{if(!slider.contains(document.activeElement))start();});document.addEventListener("visibilitychange",()=>document.hidden?stop():start());show(0);start();
}
let promoCountdownTimer=null;
function safeBannerLink(value){const target=String(value||"").trim();if(!target)return "";if(target.startsWith("/")&&!target.startsWith("//"))return target;try{const u=new URL(target);return u.protocol==="https:"?u.href:"";}catch{return "";}}
async function loadDynamicBanners(){
 try{
  const records=await getJson("/api/banners?position=hero");
  const banners=(Array.isArray(records)?records:[]).filter(row=>imageUrl(row.image_url));
  if(!banners.length)return false;
  const slides=$("#heroSlider .hero-slides"),dots=$("#heroSlider .hero-dots");if(!slides||!dots)return false;
  slides.innerHTML=banners.map((row,index)=>{const desktop=imageUrl(row.image_url),mobile=imageUrl(row.mobile_image_url),alt=escapeHtml(row.alt_text||row.title||"Banner Sayur Pasundan"),link=safeBannerLink(row.link_url),picture=`<picture>${mobile?`<source media="(max-width: 680px)" srcset="${escapeHtml(mobile)}">`:""}<img src="${escapeHtml(desktop)}" alt="${alt}" ${index===0?'fetchpriority="high"':'loading="lazy"'}></picture>`;const content=link?`<a href="${escapeHtml(link)}" ${/^https:\/\//.test(link)?'target="_blank" rel="noopener noreferrer"':""}>${picture}</a>`:picture;return `<div class="hero-slide ${index===0?"is-active":""}" data-slide="${index}" aria-hidden="${index!==0}" ${index===0?"":"inert"}>${content}</div>`;}).join("");
  dots.innerHTML=banners.map((row,index)=>`<button class="hero-dot ${index===0?"is-active":""}" type="button" data-hero-dot="${index}" aria-label="Banner ${index+1}: ${escapeHtml(row.title||"Sayur Pasundan")}" aria-current="${index===0}"></button>`).join("");
  const caption=$("#heroSlider .hero-slider-caption");if(caption)caption.textContent="Informasi dan penawaran Sayur Pasundan";
  const arrowsVisible=banners.length>1;for(const id of ["heroPrev","heroNext"])if($("#"+id))$("#"+id).hidden=!arrowsVisible;if(dots)dots.hidden=!arrowsVisible;
  return true;
 }catch{return false;}
}
function formatPromoDate(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}):"";}
function updatePromoCountdowns(){document.querySelectorAll("[data-promo-countdown]").forEach(el=>{const end=Date.parse(el.dataset.promoCountdown);if(!Number.isFinite(end)){el.textContent="Periksa periode promo";return;}const left=end-Date.now();if(left<=0){el.textContent="Periode promo berakhir";return;}const seconds=Math.floor(left/1000),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;el.textContent=`Berakhir dalam ${days?`${days} hari `:""}${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;});}
async function loadPublicPromotions(){
 const section=$("#activePromotions"),holder=$("#activePromotionList");if(!section||!holder)return;
 try{
  const records=await getJson("/api/promotions");const promos=(Array.isArray(records)?records:[]);
  section.hidden=!promos.length;if(!promos.length){holder.innerHTML="";if(promoCountdownTimer){clearInterval(promoCountdownTimer);promoCountdownTimer=null;}return;}
  holder.innerHTML=promos.map(row=>{let label="Penawaran toko";if(row.promo_type==="percentage")label=`Informasi diskon ${Number(row.promo_value)||0}%`;else if(row.promo_type==="fixed_amount")label=`Informasi potongan ${rupiah(row.promo_value)}`;const start=formatPromoDate(row.starts_at),end=formatPromoDate(row.ends_at);const period=end?`<span data-promo-countdown="${escapeHtml(row.ends_at)}">Berakhir ${escapeHtml(end)}</span>`:start?`<span>Mulai ${escapeHtml(start)}</span>`:"<span>Periksa syarat promo dengan toko</span>";const code=row.promo_code?`<code>Kode: ${escapeHtml(row.promo_code)}</code>`:"";const note=row.promo_type==="display_only"?"Hubungi toko untuk memastikan syarat penawaran.":"Informasi promo ditampilkan saja; diskon belum diterapkan otomatis pada checkout.";return `<article class="active-promo-card"><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(label)}</span><p>${escapeHtml(row.description||note)}</p>${row.promo_type!=="display_only"?`<p class="tiny">${escapeHtml(note)}</p>`:""}${code}${period}</article>`;}).join("");
  updatePromoCountdowns();if(promoCountdownTimer)clearInterval(promoCountdownTimer);if(promos.some(p=>p.ends_at))promoCountdownTimer=setInterval(updatePromoCountdowns,1000);
 }catch{section.hidden=true;holder.innerHTML="";}
}

function productCard(p){
 const variants=variantsOf(p);if(!variants.length)return "";const initialVariant=variants.find(v=>unitsOf(v).some(u=>Number(u.is_default)===1))||variants[0];const units=unitsOf(initialVariant);if(!units.length)return "";const initialUnit=units.find(u=>Number(u.is_default)===1)||units[0];const stock=stockText(p);const step=initialUnit.sale_type==="measure"?0.5:1;const slug=encodeURIComponent(p.slug||String(p.id));
 const productImage=imageUrl(p.image_url);
 return `<article class="product-card" data-product="${Number(p.id)}"><a class="product-image-link" href="/produk/${slug}?id=${Number(p.id)}" aria-label="Lihat detail ${escapeHtml(p.name)}"><div class="product-image-wrap"><div class="product-image-placeholder" aria-hidden="true"></div><img class="product-image" data-role="image" ${productImage?`src="${escapeHtml(productImage)}"`:""} alt="${productImage?escapeHtml(p.name):""}" ${productImage?"":"hidden"} loading="lazy"><span class="product-tag" data-role="stock"><span class="stock-pill ${stock[1]}">${stock[0]}</span></span></div></a><div class="product-content"><div class="product-category">${escapeHtml(p.category_name||"Produk pilihan")}</div><h3><a href="/produk/${slug}?id=${Number(p.id)}">${escapeHtml(p.name)}</a></h3><p class="product-description">${escapeHtml(p.short_description||"Bahan pilihan untuk kebutuhan dapur Anda.")}</p><label class="field-label">Merk / varian<select class="select-field" data-role="variant">${variants.map(v=>`<option value="${Number(v.id_varian)}" ${Number(v.id_varian)===Number(initialVariant.id_varian)?"selected":""}>${escapeHtml([v.merk,v.nama_varian].filter(Boolean).join(" Ã¢â‚¬â€ ")||v.nama_produk_tampil||"Default")}</option>`).join("")}</select></label><label class="field-label">Satuan jual<select class="select-field" data-role="unit">${units.map(u=>`<option value="${Number(u.id_satuan)}" ${Number(u.id_satuan)===Number(initialUnit.id_satuan)?"selected":""}>${escapeHtml(u.nama_satuan)}</option>`).join("")}</select></label><div class="price-row"><strong class="price-main" data-role="price">${rupiah(initialUnit.harga)}</strong><span class="price-unit" data-role="priceLabel">per ${escapeHtml(initialUnit.nama_satuan)}</span></div><input class="nominal-field" data-role="nominal" type="number" min="${Number(initialUnit.nominal_min||0)}" step="1" inputmode="numeric" placeholder="Nominal Rp" aria-label="Nominal pembelian" ${Number(initialUnit.allow_nominal_purchase)===1?"":"hidden"}><div class="quantity-row"><input class="quantity-field" data-role="quantity" type="number" min="${step}" step="${step}" value="${step}" aria-label="Jumlah ${escapeHtml(p.name)}"><button type="button" class="add-button" data-role="add" ${isUnavailable(p)?"disabled":""}>+ Keranjang</button></div><a class="product-detail-link" href="/produk/${slug}?id=${Number(p.id)}">Detail produk <span aria-hidden="true">Ã¢â€ â€™</span></a><p class="tiny muted" data-role="minimum" ${Number(initialUnit.allow_nominal_purchase)===1&&initialUnit.nominal_min?"":"hidden"}>Minimum ${rupiah(initialUnit.nominal_min)}</p></div></article>`;
}
function setPlaceholder(card){const holder=$(".product-image-placeholder",card),img=$("[data-role='image']",card);if(holder)holder.hidden=false;if(img){img.hidden=true;img.removeAttribute("src");img.alt="";}}
function updateCard(card,p,resetQuantity=false){
 const variant=chosenVariant(card,p);if(!variant)return;const oldUnitId=Number($("[data-role='unit']",card)?.value);const units=unitsOf(variant);const unitSelect=$("[data-role='unit']",card);if(!units.length){unitSelect.innerHTML="";$("[data-role='add']",card).disabled=true;return;}
 if(!units.some(u=>Number(u.id_satuan)===oldUnitId)||resetQuantity){const u=units.find(u=>Number(u.is_default)===1)||units[0];unitSelect.innerHTML=units.map(x=>`<option value="${Number(x.id_satuan)}" ${Number(x.id_satuan)===Number(u.id_satuan)?"selected":""}>${escapeHtml(x.nama_satuan)}</option>`).join("");}
 const unit=chosenUnit(card,variant);if(!unit)return;$("[data-role='price']",card).textContent=rupiah(unit.harga);$("[data-role='priceLabel']",card).textContent=`per ${unit.nama_satuan}`;
 const nominal=$("[data-role='nominal']",card);nominal.hidden=Number(unit.allow_nominal_purchase)!==1;nominal.min=Number(unit.nominal_min||0);nominal.value="";const minimum=$("[data-role='minimum']",card);minimum.hidden=!(Number(unit.allow_nominal_purchase)===1&&Number(unit.nominal_min)>0);minimum.textContent=`Minimum ${rupiah(unit.nominal_min)}`;
 const image=$("[data-role='image']",card);image.dataset.failed="";image.onerror=()=>setPlaceholder(card);const src=imageUrl(p.image_url);const placeholder=$(".product-image-placeholder",card);if(src){image.hidden=false;image.src=src;image.alt=p.name||"Foto produk";if(placeholder)placeholder.hidden=true;}else{image.hidden=true;image.alt="";image.removeAttribute("src");if(placeholder)placeholder.hidden=false;}
 const unavailable=isUnavailable(p);const add=$("[data-role='add']",card);add.disabled=unavailable;add.textContent=unavailable?"Tidak tersedia":"+ Keranjang";const stock=stockText(p);$("[data-role='stock']",card).innerHTML=`<span class="stock-pill ${stock[1]}">${stock[0]}</span>`;
 const step=unit.sale_type==="measure"?0.5:1;const qty=$("[data-role='quantity']",card);qty.min=String(step);qty.step=String(step);if(resetQuantity)qty.value=String(step);else if(!Number(qty.value)||Number(qty.value)<step)qty.value=String(step);
}
function hydrateProductGrid(target,products){if(!target)return;target.innerHTML=products.map(productCard).join("");$$(".product-card",target).forEach(card=>{const p=store.products.find(v=>Number(v.id)===Number(card.dataset.product));if(!p)return;$("[data-role='variant']",card)?.addEventListener("change",()=>updateCard(card,p,true));$("[data-role='unit']",card)?.addEventListener("change",()=>updateCard(card,p,false));$("[data-role='add']",card)?.addEventListener("click",()=>addCardToCart(card,p));const image=$("[data-role='image']",card);image?.addEventListener("error",()=>setPlaceholder(card),{once:true});updateCard(card,p,false);});}
function renderShowcases(){
 const featured=$("#featuredGrid"),fresh=$("#newProductGrid"),best=$("#bestSellerGrid"),featuredSec=$("#featuredSection"),freshSec=$("#newProductSection"),bestSec=$("#bestSellerSection");
 const valid=store.products.filter(p=>variantsOf(p).some(v=>unitsOf(v).length));const selected=valid.filter(p=>Number(p.is_featured)===1).slice(0,8);if(featuredSec){featuredSec.hidden=!selected.length;if(selected.length)hydrateProductGrid(featured,selected);}
 const newest=[...valid].sort((a,b)=>(Date.parse(b.created_at||"")||0)-(Date.parse(a.created_at||"")||0)||Number(b.id)-Number(a.id)).slice(0,8);if(freshSec){freshSec.hidden=!newest.length;if(newest.length)hydrateProductGrid(fresh,newest);}
 const bests=[...valid].filter(p=>soldCount(p)>0).sort((a,b)=>soldCount(b)-soldCount(a)).slice(0,8);if(bestSec){bestSec.hidden=!bests.length;if(bests.length)hydrateProductGrid(best,bests);}
}
function renderPagination(total){const holder=$("#productPagination");if(!holder)return;const pages=Math.max(1,Math.ceil(total/store.pageSize));store.page=Math.min(Math.max(1,store.page),pages);if(total<=store.pageSize){holder.innerHTML="";return;}holder.innerHTML=`<button type="button" class="page-button" data-page="${store.page-1}" ${store.page<=1?"disabled":""} aria-label="Halaman sebelumnya">Ã¢â‚¬Â¹</button><span>Halaman ${store.page} dari ${pages}</span><button type="button" class="page-button" data-page="${store.page+1}" ${store.page>=pages?"disabled":""} aria-label="Halaman berikutnya">Ã¢â‚¬Âº</button>`;$$('[data-page]',holder).forEach(btn=>btn.addEventListener("click",()=>{store.page=Number(btn.dataset.page);renderProducts();$("#katalog").scrollIntoView({behavior:"smooth",block:"start"});}));}
function renderProducts(){const target=$("#productGrid");if(!target)return;const all=visibleProducts();$("#resultCount").textContent=`${all.length.toLocaleString("id-ID")} produk`;if(!store.products.length){target.innerHTML='<div class="empty-state"><strong>Katalog sedang disiapkan</strong>Data produk akan tampil setelah database D1 tersambung dan workbook Rev15 lolos audit.</div>';renderPagination(0);return;}if(!all.length){target.innerHTML='<div class="empty-state"><strong>Produk tidak ditemukan</strong>Coba kata kunci, kategori, atau rentang harga yang berbeda.</div>';renderPagination(0);return;}const pages=Math.max(1,Math.ceil(all.length/store.pageSize));store.page=Math.min(store.page,pages);const shown=all.slice((store.page-1)*store.pageSize,store.page*store.pageSize);hydrateProductGrid(target,shown);renderPagination(all.length);}
function addCardToCart(card,p){const variant=chosenVariant(card,p),unit=chosenUnit(card,variant);if(!variant||!unit)return;const nominalText=$("[data-role='nominal']",card).value.trim();let nominalAmount=null,quantity=Number($("[data-role='quantity']",card).value||0);if(nominalText){nominalAmount=Number(nominalText);if(Number(unit.allow_nominal_purchase)!==1){toast("Pembelian berdasarkan nominal tidak diizinkan untuk satuan ini.");return;}if(!Number.isFinite(nominalAmount)||nominalAmount<=0||(unit.nominal_min!=null&&nominalAmount<Number(unit.nominal_min))){toast(`Nominal minimum ${rupiah(unit.nominal_min||0)}.`);return;}quantity=nominalAmount/Number(unit.harga||1);}const step=unit.sale_type==="measure"?0.5:1;if(!Number.isFinite(quantity)||quantity<step||quantity>9999||Math.abs(quantity/step-Math.round(quantity/step))>0.0001){toast(`Jumlah harus kelipatan ${step.toLocaleString("id-ID")} untuk satuan ini.`);return;}if(isUnavailable(p)){toast("Produk ini tidak tersedia saat ini.");return;}const key=`${p.id}:${variant.id_varian}:${unit.id_satuan}:${nominalAmount||"qty"}`;const lineTotal=nominalAmount??Math.round(Number(unit.harga)*quantity);const existing=store.cart.find(item=>item.key===key);if(existing){if(nominalAmount)existing.quantity=quantity;else{existing.quantity=Math.round((existing.quantity+quantity)*100)/100;existing.line_total=Math.round(Number(unit.harga)*existing.quantity);}}else store.cart.push({key,id_satuan:Number(unit.id_satuan),product_id:Number(p.id),id_varian:Number(variant.id_varian),name:p.name,variant_label:[variant.merk,variant.nama_varian].filter(Boolean).join(" "),unit_label:unit.nama_satuan,unit_price:Number(unit.harga),quantity,quantity_step:step,nominal_amount:nominalAmount,line_total:lineTotal});persistCart();toast(`${p.name} ditambahkan ke keranjang.`);}
function moneyCart(){return Math.round(store.cart.reduce((sum,item)=>sum+Number(item.line_total||0),0));}
function normalizePlace(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");}
function clientDistanceKm(lat,lng){const rad=n=>n*Math.PI/180,homeLat=Number(store.settings.warehouseLat??-7.059522),homeLng=Number(store.settings.warehouseLng??107.764035),dLat=rad(Number(lat)-homeLat),dLng=rad(Number(lng)-homeLng),a=Math.sin(dLat/2)**2+Math.cos(rad(homeLat))*Math.cos(rad(Number(lat)))*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));}
function extractMapsCoordinates(value){const raw=String(value||"").trim();if(!raw)return null;let decoded=raw;try{decoded=decodeURIComponent(raw.replace(/\+/g,"%20"));}catch{}const patterns=[/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,/[?&](?:q|query|ll|center)=(-?\d{1,2}(?:\.\d+)?)[,%2C ]+(-?\d{1,3}(?:\.\d+)?)/i];for(const p of patterns){const m=decoded.match(p);if(m){const lat=Number(m[1]),lng=Number(m[2]);if(Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180)return {lat,lng};}}return null;}
function googleUrlIsAllowed(value){try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)&&(["google.com","www.google.com","maps.google.com","maps.app.goo.gl","goo.gl","earth.google.com"].includes(u.hostname.toLowerCase())||u.hostname.toLowerCase().endsWith(".google.com"));}catch{return false;}}
function updateMapLink(){const link=$("#openGoogleMaps"),mapInput=$("#customerMapUrl");if(!link)return;const provided=mapInput?.value.trim()||"";if(provided&&googleUrlIsAllowed(provided)){link.href=provided;link.textContent="Buka tautan lokasi Ã¢â€ â€”";return;}const form=$("#checkoutForm"),address=String(form?.elements.customer_address?.value||"").trim(),district=String(form?.elements.customer_district?.value||"").trim(),city=String(form?.elements.customer_city?.value||"").trim(),province=String(form?.elements.customer_province?.value||"").trim();const query=[address,district,city,province].filter(Boolean).join(", ");link.href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query||"Kabupaten Bandung, Jawa Barat")}`;link.textContent="Buka Google Maps Ã¢â€ â€”";}
function setCustomerCoordinates(lat,lng,source){$("#customerLat").value=String(lat);$("#customerLng").value=String(lng);const status=$("#locationStatus");if(status)status.textContent=`Titik lokasi berhasil diambil ${source}. Pastikan pin sesuai alamat penerima.`;updateCheckoutQuote();}
function chosenPayment(){const input=$("input[name='payment_method']:checked");return store.paymentMethods.find(m=>m.code===input?.value)||null;}
function estimatedShipping(){const subtotal=moneyCart(),lat=$("#customerLat")?.value,lng=$("#customerLng")?.value,minimum=Number(store.settings.freeShippingMinimum??50000),radius=Number(store.settings.nearRadiusKm??3);if(subtotal>=minimum)return {fee:0,distance:lat&&lng?clientDistanceKm(lat,lng):null};if(!lat||!lng)return {fee:null,distance:null};const distance=clientDistanceKm(lat,lng);return {fee:distance<=radius?Number(store.settings.nearShippingFee??5000):Number(store.settings.farShippingFee??10000),distance};}
function updateCheckoutQuote(){const subtotal=moneyCart(),estimate=estimatedShipping();if($("#checkoutSubtotal"))$("#checkoutSubtotal").textContent=rupiah(subtotal);if($("#checkoutShipping"))$("#checkoutShipping").textContent=estimate.fee===null?"Perlu lokasi":estimate.fee?rupiah(estimate.fee):"Gratis";if($("#checkoutTotal"))$("#checkoutTotal").textContent=estimate.fee===null?rupiah(subtotal)+" + ongkir":rupiah(subtotal+estimate.fee);const box=$("#shippingQuote");if(box){const minimum=Number(store.settings.freeShippingMinimum??50000),radius=Number(store.settings.nearRadiusKm??3);if(subtotal>=minimum)box.textContent=`Subtotal mencapai ${rupiah(minimum)}, ongkir gratis. Lokasi tetap dapat ditandai untuk membantu pengantaran.`;else if(estimate.fee===null)box.textContent=`Ambil lokasi perangkat atau gunakan tautan Google Maps untuk menghitung ongkir ${rupiah(store.settings.nearShippingFee??5000)} (hingga ${radius} km) atau ${rupiah(store.settings.farShippingFee??10000)} (lebih dari ${radius} km).`;else box.textContent=`Estimasi jarak ${estimate.distance.toFixed(2).replace(".",",")} km Ã‚Â· ongkir ${rupiah(estimate.fee)}. Jarak dihitung ulang server.`;}
 renderPaymentOptionsForDistrict();}
function codEligibility(method){
 const codMax=Number(store.settings.codMaxOrderTotal||200000);
 const subtotal=moneyCart();
 if(method.available===false)return {ok:false,note:method.unavailable_reason||"COD dinonaktifkan oleh toko."};
 const form=$("#checkoutForm");
 const district=normalizePlace(form?.elements.customer_district?.value);
 const city=normalizePlace(form?.elements.customer_city?.value);
 const province=normalizePlace(form?.elements.customer_province?.value);
 const districts=(store.settings.codAllowedDistricts||[]).map(normalizePlace);
 if(!districts.includes(district))return {ok:false,note:"COD hanya tersedia di kecamatan Paseh, Majalaya, Solokan Jeruk, dan Ciparay."};
 if(city!==normalizePlace(store.settings.codAllowedCity||"Kabupaten Bandung"))return {ok:false,note:`COD hanya tersedia di ${store.settings.codAllowedCity||"Kabupaten Bandung"}.`};
 if(province!==normalizePlace(store.settings.codAllowedProvince||"Jawa Barat"))return {ok:false,note:`COD hanya tersedia di Provinsi ${store.settings.codAllowedProvince||"Jawa Barat"}.`};
 const hasCoordinates=Boolean($("#customerLat")?.value&&$("#customerLng")?.value);
 if(!hasCoordinates)return {ok:false,note:"Tandai lokasi pengantaran untuk menggunakan COD."};
 const estimate=estimatedShipping();
 const total=subtotal+(estimate.fee??0);
 if(total>codMax)return {ok:false,note:`COD hanya tersedia untuk total pesanan maksimal ${rupiah(codMax)}, termasuk ongkir.`};
 return {ok:true,note:`COD tersedia untuk total maksimal ${rupiah(codMax)}, termasuk ongkir.`};
}
function renderPaymentOptionsForDistrict(){
 const holder=$("#paymentMethodOptions");if(!holder||!store.paymentMethods.length)return;
 holder.querySelectorAll(".payment-method-card").forEach(card=>{const input=card.querySelector('input[name="payment_method"]');const method=store.paymentMethods.find(m=>m.code===input?.value);if(!method||method.kind!=="cod")return;const eligibility=codEligibility(method);input.disabled=!eligibility.ok;card.classList.toggle("is-disabled",!eligibility.ok);const note=card.querySelector("small");if(note)note.textContent=eligibility.note;if(!eligibility.ok&&input.checked){input.checked=false;const fallback=holder.querySelector('input[name="payment_method"]:not(:disabled)');if(fallback)fallback.checked=true;}});
}
function renderPaymentOptions(){
 const holder=$("#paymentMethodOptions");if(!holder)return;const previouslySelected=holder.querySelector('input[name="payment_method"]:checked')?.value||"";
 if(!store.paymentMethods.length){holder.innerHTML='<p class="muted">Metode pembayaran belum tersedia. Hubungi toko atau jalankan migrasi Tahap 2.</p>';return;}
 const methods=store.paymentMethods.map(m=>{const eligibility=m.kind==="cod"?codEligibility(m):{ok:m.available!==false,note:m.kind==="e_wallet"?"Pembayaran manual melalui e-wallet.":"Transfer manual Ã‚Â· verifikasi admin."};const disabled=!eligibility.ok;const logo=m.logo_url&&(/^https:\/\//.test(m.logo_url)||m.logo_url.startsWith("/"))?`<img class="payment-method-logo" src="${escapeHtml(m.logo_url)}" alt="Logo ${escapeHtml(m.name)}">`:"";return `<label class="payment-method-card ${disabled?"is-disabled":""}"><input type="radio" name="payment_method" value="${escapeHtml(m.code)}" ${disabled?"disabled":""}><span class="payment-method-body">${logo}<strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(eligibility.note)}</small></span></label>`;}).join("");
 holder.innerHTML=methods;const enabled=holder.querySelector('input[name="payment_method"]:not(:disabled)');const preferred=previouslySelected?holder.querySelector(`input[name="payment_method"][value="${CSS.escape(previouslySelected)}"]:not(:disabled)`):null;if(preferred)preferred.checked=true;else if(enabled)enabled.checked=true;holder.querySelectorAll('input[name="payment_method"]').forEach(input=>input.addEventListener("change",updateCheckoutQuote));updateCheckoutQuote();
}
function setupCheckoutMapFields(){
 const mapInput=$("#customerMapUrl"),form=$("#checkoutForm"),status=$("#locationStatus");
 const refreshLink=()=>{updateMapLink();renderPaymentOptionsForDistrict();};
 mapInput?.addEventListener("input",refreshLink);
 for(const name of ["customer_address","customer_city","customer_district","customer_province"])form?.elements[name]?.addEventListener("input",()=>{updateMapLink();renderPaymentOptionsForDistrict();});
 $("#useMapLink")?.addEventListener("click",()=>{
  const value=String(mapInput?.value||"").trim();
  if(!value){if(status)status.textContent="Tempel tautan lokasi Google Maps terlebih dahulu.";return;}
  if(!googleUrlIsAllowed(value)){if(status)status.textContent="Tautan tidak dikenali sebagai Google Maps. Tempel tautan yang dibagikan dari aplikasi Google Maps.";return;}
  const coordinates=extractMapsCoordinates(value);updateMapLink();
  if(coordinates)setCustomerCoordinates(coordinates.lat,coordinates.lng,"dari tautan Google Maps");
  else if(status)status.textContent="Tautan Google Maps tersimpan, tetapi koordinat tidak terbaca otomatis. Gunakan tautan yang memuat pin atau tombol Ambil lokasi perangkat.";
 });
 updateMapLink();
}
function renderFooterPaymentMethods(){const holder=$("#footerPaymentMethods");if(!holder)return;if(!store.paymentMethods.length){holder.innerHTML='<span class="payment-footer-label">Transfer manual Ã‚Â· COD sesuai area</span>';return;}holder.innerHTML=store.paymentMethods.filter(m=>m.available!==false||m.kind!=="cod").map(m=>m.logo_url&&(/^https:\/\//.test(m.logo_url)||m.logo_url.startsWith("/"))?`<img class="footer-payment-logo" src="${escapeHtml(m.logo_url)}" alt="Logo ${escapeHtml(m.name)}" title="${escapeHtml(m.name)}">`:`<span class="payment-footer-label" title="${escapeHtml(m.name)}">${escapeHtml(m.code.toUpperCase())}</span>`).join("");}
async function loadPaymentMethods(){const holder=$("#paymentMethodOptions");if(holder)holder.innerHTML='<p class="muted">Memuat metode pembayaranÃ¢â‚¬Â¦</p>';try{store.paymentMethods=await getJson("/api/payment-methods");renderFooterPaymentMethods();if(holder)renderPaymentOptions();}catch(error){if(holder)holder.innerHTML=`<p class="form-error">${escapeHtml(error.message||"Metode pembayaran belum tersedia.")}</p>`;renderFooterPaymentMethods();}}
function renderCart(){const count=store.cart.reduce((sum,item)=>sum+(item.nominal_amount?1:Number(item.quantity||0)),0);$("#cartCount").textContent=String(Math.round(count*100)/100);$("#mobileCartCount").textContent=String(Math.round(count*100)/100);$("#cartTotal").textContent=rupiah(moneyCart());$("#checkoutTotal").textContent=rupiah(moneyCart());$("#checkoutOpen").disabled=!store.cart.length;updateCheckoutQuote();const target=$("#cartItems");if(!store.cart.length){target.innerHTML='<p class="empty-cart">Keranjang masih kosong. Pilih produk yang Anda butuhkan.</p>';return;}target.innerHTML=store.cart.map((item,index)=>`<div class="cart-line"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.variant_label)} Ã‚Â· ${escapeHtml(item.unit_label)}</small><small>${item.nominal_amount?`Nominal ${rupiah(item.nominal_amount)}`:`${Number(item.quantity).toLocaleString("id-ID")} Ãƒâ€” ${rupiah(item.unit_price)}`}</small></div><div><div class="cart-line-total">${rupiah(item.line_total)}</div><div class="cart-line-actions">${item.nominal_amount?"":`<button type="button" data-cart-minus="${index}" aria-label="Kurangi">Ã¢Ë†â€™</button><span>${Number(item.quantity).toLocaleString("id-ID")}</span><button type="button" data-cart-plus="${index}" aria-label="Tambah">+</button>`}<button type="button" data-cart-remove="${index}" aria-label="Hapus item">Ãƒâ€”</button></div></div></div>`).join("");$$('[data-cart-minus]').forEach(btn=>btn.addEventListener("click",()=>changeCartQty(Number(btn.dataset.cartMinus),-1)));$$('[data-cart-plus]').forEach(btn=>btn.addEventListener("click",()=>changeCartQty(Number(btn.dataset.cartPlus),1)));$$('[data-cart-remove]').forEach(btn=>btn.addEventListener("click",()=>{store.cart.splice(Number(btn.dataset.cartRemove),1);persistCart();}));}
function changeCartQty(index,direction){const item=store.cart[index];if(!item)return;const step=Number(item.quantity_step||1),next=Math.round((Number(item.quantity)+direction*step)*100)/100;if(next<step)store.cart.splice(index,1);else{item.quantity=next;item.line_total=Math.round(item.unit_price*item.quantity);}persistCart();}
function openCart(){$("#cartDrawer").hidden=false;$("#cartBackdrop").hidden=false;document.body.classList.add("drawer-open");}
function closeCart(){$("#cartDrawer").hidden=true;$("#cartBackdrop").hidden=true;document.body.classList.remove("drawer-open");}
async function submitOrder(event){event.preventDefault();if(!store.cart.length)return;const form=new FormData(event.currentTarget);const selected=chosenPayment();if(!selected){toast("Pilih metode pembayaran yang tersedia.");return;}const customer={customer_name:String(form.get("customer_name")||"").trim(),customer_phone:String(form.get("customer_phone")||"").trim(),customer_address:String(form.get("customer_address")||"").trim(),customer_city:String(form.get("customer_city")||"").trim(),customer_district:String(form.get("customer_district")||"").trim(),customer_province:String(form.get("customer_province")||"").trim(),customer_map_url:String(form.get("customer_map_url")||"").trim(),customer_lat:String(form.get("customer_lat")||""),customer_lng:String(form.get("customer_lng")||""),notes:String(form.get("notes")||"").trim(),payment_method:selected.code};const estimate=estimatedShipping();if(moneyCart()<Number(store.settings.freeShippingMinimum??50000)&&estimate.fee===null){toast("Ambil lokasi pengantaran untuk menghitung ongkir.");return;}const btn=$("button[type='submit']",event.currentTarget);btn.disabled=true;btn.textContent="Menyimpan pesananÃ¢â‚¬Â¦";try{const payload={...customer,items:store.cart.map(item=>({id_satuan:item.id_satuan,quantity:item.quantity,nominal_amount:item.nominal_amount}))};const result=await getJson("/api/orders",{method:"POST",body:JSON.stringify(payload)});sessionStorage.setItem("sp-last-order",JSON.stringify({order_code:result.order_code,customer_phone:result.customer_phone,whatsapp_url:result.whatsapp_url}));
try {
  const historyKey = "sp-order-history-v1";
  const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
  const entry = {
    order_code: result.order_code,
    customer_phone: result.customer_phone || customer.customer_phone,
    whatsapp_url: result.whatsapp_url || "",
    created_at: new Date().toISOString(),
    total_estimate: moneyCart(),
    payment_method: selected.code,
    items: store.cart.map(item => ({
      name: item.name,
      variant_label: item.variant_label,
      unit_label: item.unit_label,
      quantity: item.quantity,
      nominal_amount: item.nominal_amount,
      line_total: item.line_total
    }))
  };
  const filtered = Array.isArray(history) ? history.filter(item => item.order_code !== entry.order_code) : [];
  filtered.unshift(entry);
  localStorage.setItem(historyKey, JSON.stringify(filtered.slice(0, 30)));
} catch (historyError) {
  console.warn("Riwayat lokal tidak dapat disimpan.", historyError);
}
store.cart=[];persistCart();$("#checkoutBackdrop").hidden=true;closeCart();$("#checkoutForm").reset();$("#customerLat").value="";$("#customerLng").value="";location.href="/pesanan.html";}catch(error){toast(error.message||"Pesanan gagal dibuat.");}finally{btn.disabled=false;btn.textContent="Buat pesanan Ã¢â€ â€™";}}

function syncUrlFilters(){
  const url=new URL(location.href);
  const category=store.categories.find(c=>String(c.id)===String(store.selectedCategory));
  const pairs={q:store.query,kategori:category?.slug||"",min:store.minPrice,max:store.maxPrice,unggulan:store.featuredOnly?"1":"",urut:store.sort!=="recommended"?store.sort:""};
  for(const alias of ["category","sort","featured"])url.searchParams.delete(alias);
  for(const [key,value] of Object.entries(pairs)){if(String(value||"").trim())url.searchParams.set(key,String(value));else url.searchParams.delete(key);}
  history.replaceState({},"",url.pathname+url.search+url.hash);
}
function applyUrlFilters(){
  const params=new URLSearchParams(location.search);
  const categoryToken=params.get("kategori")||params.get("category")||"";
  const category=store.categories.find(c=>String(c.id)===categoryToken||normalText(c.slug)===normalText(categoryToken)||normalText(c.name)===normalText(categoryToken));
  store.selectedCategory=category?String(category.id):"";
  store.query=(params.get("q")||"").trim().slice(0,80);
  store.minPrice=(params.get("min")||"").trim();store.maxPrice=(params.get("max")||"").trim();
  store.featuredOnly=params.get("unggulan")==="1"||params.get("featured")==="1";
  const allowedSorts=new Set(["recommended","latest","best","price-asc","price-desc"]);
  store.sort=allowedSorts.has(params.get("urut")||params.get("sort"))?(params.get("urut")||params.get("sort")):"recommended";
  if($("#searchInput"))$("#searchInput").value=store.query;
  if($("#minPrice"))$("#minPrice").value=store.minPrice;
  if($("#maxPrice"))$("#maxPrice").value=store.maxPrice;
  if($("#featuredOnly"))$("#featuredOnly").checked=store.featuredOnly;
  if($("#sortProducts"))$("#sortProducts").value=store.sort;
}
function bindFilters(){
 $("#searchInput").addEventListener("input",event=>{store.query=event.target.value.trim();store.page=1;syncUrlFilters();renderSuggestions();renderProducts();});
 $("#searchInput").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();store.query=event.currentTarget.value.trim();store.page=1;syncUrlFilters();renderSuggestions();renderProducts();$("#katalog").scrollIntoView({behavior:"smooth",block:"start"});}});
 $("#minPrice")?.addEventListener("input",e=>{store.minPrice=e.target.value;store.page=1;syncUrlFilters();renderProducts();});$("#maxPrice")?.addEventListener("input",e=>{store.maxPrice=e.target.value;store.page=1;syncUrlFilters();renderProducts();});$("#featuredOnly")?.addEventListener("change",e=>{store.featuredOnly=e.target.checked;store.page=1;syncUrlFilters();renderProducts();});$("#sortProducts")?.addEventListener("change",e=>{store.sort=e.target.value;store.page=1;syncUrlFilters();renderProducts();});
}
function renderSuggestions(){const holder=$("#productSuggestions");if(!holder)return;const q=normalText(store.query);const names=store.products.filter(p=>!q||normalText(p.name).includes(q)).slice(0,12).map(p=>p.name);holder.innerHTML=[...new Set(names)].map(name=>`<option value="${escapeHtml(name)}"></option>`).join("");}
async function loadData(){
 $("#yearNow").textContent=String(new Date().getFullYear());
 const wa=`https://wa.me/${store.settings.whatsappPhone}?text=${encodeURIComponent("Halo Sayur Pasundan, saya ingin bertanya mengenai produk.")}`;const chat=$("#chatLink");if(chat)chat.href=wa;const floating=$("#floatingWhatsApp");if(floating)floating.href=wa;
 try{const [settings,categories,products]=await Promise.all([getJson("/api/settings"),getJson("/api/categories"),getJson("/api/products")]);store.settings={...store.settings,...settings};store.categories=categories;store.products=products;applyUrlFilters();const brand=$(".brand-caption");if(brand)brand.textContent=store.settings.tagline||"Rencanakan Masakan Anda";const url=`https://wa.me/${String(store.settings.whatsappPhone||"6281221031765").replace(/\D/g,"")}?text=${encodeURIComponent("Halo Sayur Pasundan, saya ingin bertanya mengenai produk.")}`;if(chat)chat.href=url;if(floating)floating.href=url;renderCategories();renderSuggestions();renderShowcases();renderProducts();$("#statusBanner").hidden=true;}
 catch(error){store.products=[];renderCategories();renderShowcases();renderProducts();const banner=$("#statusBanner");banner.textContent="Katalog belum terhubung ke database D1. Jalankan migrasi dan impor data yang telah lolos audit sebelum toko diluncurkan.";banner.hidden=false;}
 renderCart();if(new URLSearchParams(location.search).get("keranjang")==="1")openCart();
}
$("#openCart")?.addEventListener("click",openCart);$("#mobileCart")?.addEventListener("click",openCart);$("#closeCart")?.addEventListener("click",closeCart);$("#cartBackdrop")?.addEventListener("click",closeCart);$("#checkoutOpen")?.addEventListener("click",()=>{if(!store.cart.length)return;$("#checkoutBackdrop").hidden=false;updateCheckoutQuote();if(!store.paymentMethods.length)loadPaymentMethods();else renderPaymentOptions();});$("#closeCheckout")?.addEventListener("click",()=>$("#checkoutBackdrop").hidden=true);$("#checkoutBackdrop")?.addEventListener("click",event=>{if(event.target===$("#checkoutBackdrop"))$("#checkoutBackdrop").hidden=true;});$("#checkoutForm")?.addEventListener("submit",submitOrder);$("#getLocation")?.addEventListener("click",()=>{const status=$("#locationStatus");if(!navigator.geolocation){status.textContent="Browser ini tidak mendukung lokasi. Tempel tautan Google Maps atau hubungi toko.";return;}status.textContent="Meminta izin lokasiÃ¢â‚¬Â¦";navigator.geolocation.getCurrentPosition(position=>{setCustomerCoordinates(position.coords.latitude,position.coords.longitude,"dari perangkat");},error=>{status.textContent=error.code===1?"Izin lokasi ditolak. Izinkan lokasi atau tempel tautan Google Maps.":"Lokasi belum bisa didapatkan. Periksa GPS atau tempel tautan Google Maps.";updateCheckoutQuote();},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});});$("#checkoutForm [name='customer_district']")?.addEventListener("input",()=>{renderPaymentOptions();updateCheckoutQuote();});document.addEventListener("keydown",event=>{if(event.key==="Escape"){$("#checkoutBackdrop").hidden=true;closeCart();}});
bindFilters();setupQuickCategories();setupCheckoutMapFields();if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));loadData();loadPaymentMethods();loadDynamicBanners().finally(setupHeroCarousel);loadPublicPromotions();


// CUSTOMER_ACCOUNT_UI
(function setupCustomerAccount() {
  const $ = (selector) => document.querySelector(selector);
  const backdrop = $("#accountBackdrop");
  const loginForm = $("#customerLoginForm");
  const registerForm = $("#customerRegisterForm");
  const verifyForm = $("#customerVerifyForm");
  if (!backdrop || !loginForm || !registerForm || !verifyForm) return;

  const signedOut = $("#accountSignedOut");
  const signedIn = $("#accountSignedIn");
  const buttonLabel = $("#accountButtonLabel");
  const tabs = document.querySelector(".account-tabs");
  let customer = null;

  function message(id, text) {
    const el = $("#" + id);
    if (el) el.textContent = text || "";
  }

  function showTab(tab) {
    const login = tab === "login";
    loginForm.hidden = !login;
    registerForm.hidden = login;
    verifyForm.hidden = true;
    if (tabs) tabs.hidden = false;

    document.querySelectorAll("[data-account-tab]").forEach((button) => {
      const active = button.dataset.accountTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    $("#accountTitle").textContent = login ? "Login pelanggan" : "Daftar akun";
    message("loginMessage", "");
    message("registerMessage", "");
    message("verifyMessage", "");
  }

  function showVerification(email, note, otp) {
    loginForm.hidden = true;
    registerForm.hidden = true;
    verifyForm.hidden = false;
    if (tabs) tabs.hidden = true;

    $("#accountTitle").textContent = "Verifikasi email";
    $("#customerVerifyEmail").value = email || "";
    verifyForm.querySelector('[name="otp"]').value = "";

    let text = note || "Masukkan kode verifikasi untuk melanjutkan.";
    if (otp) text += " Kode OTP khusus pengujian lokal: " + otp;
    message("verifyMessage", text);
  }

  function renderAccount() {
    signedOut.hidden = Boolean(customer);
    signedIn.hidden = !customer;
    buttonLabel.textContent = customer
      ? (customer.full_name || "Akun Saya")
      : "Akun Saya";

    if (customer) {
      $("#accountCustomerName").textContent = customer.full_name || "Pelanggan";
      $("#accountCustomerContact").textContent =
        [customer.phone, customer.email].filter(Boolean).join(" Â· ");
    }
  }

  async function refreshAccount() {
    try {
      const result = await getJson("/api/customer/me");
      customer = result.authenticated ? result.customer : null;
    } catch {
      customer = null;
    }
    renderAccount();
  }

  $("#openAccount").addEventListener("click", async () => {
    backdrop.hidden = false;
    document.body.classList.add("drawer-open");
    await refreshAccount();
    showTab("login");
  });

  function closeAccount() {
    backdrop.hidden = true;
    document.body.classList.remove("drawer-open");
  }

  $("#closeAccount").addEventListener("click", closeAccount);
  document.querySelector("#continueAsGuest")?.addEventListener("click", () => { closeAccount(); document.querySelector("#katalog")?.scrollIntoView({ behavior: "smooth", block: "start" }); });


  document.querySelectorAll("[data-account-tab]").forEach((button) => {
    button.addEventListener("click", () => showTab(button.dataset.accountTab));
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = loginForm.querySelector('[type="submit"]');
    submit.disabled = true;
    message("loginMessage", "Memeriksa akun...");

    const form = new FormData(loginForm);
    const identifier = String(form.get("identifier") || "").trim();

    try {
      const result = await getJson("/api/customer/login", {
        method: "POST",
        body: JSON.stringify({
          identifier,
          password: String(form.get("password") || "")
        })
      });

      customer = result.customer;
      renderAccount();
      loginForm.reset();
      toast("Login berhasil.");
      closeAccount();
    } catch (error) {
      if (error.needs_email_verification && identifier.includes("@")) {
        showVerification(
          identifier,
          "Email belum terverifikasi. Minta kode jika belum memilikinya."
        );
      } else {
        message("loginMessage", error.message || "Login gagal. Silakan coba lagi.");
      }
    } finally {
      submit.disabled = false;
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(registerForm);
    const phone = String(form.get("phone") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();

    if (!email) {
      message("registerMessage", "Email wajib diisi untuk verifikasi akun.");
      return;
    }

    const submit = registerForm.querySelector('[type="submit"]');
    submit.disabled = true;
    message("registerMessage", "Membuat akun dan kode verifikasi...");

    try {
      const result = await getJson("/api/customer/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: String(form.get("full_name") || "").trim(),
          phone,
          email,
          password: String(form.get("password") || "")
        })
      });

      registerForm.reset();
      showVerification(
        email,
        result.message || "Akun dibuat. Verifikasi email sebelum login.",
        result.development_otp
      );
    } catch (error) {
      message("registerMessage", error.message || "Registrasi gagal. Silakan coba lagi.");
    } finally {
      submit.disabled = false;
    }
  });

  verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = verifyForm.querySelector('[type="submit"]');
    submit.disabled = true;
    message("verifyMessage", "Memeriksa kode...");

    const form = new FormData(verifyForm);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const otp = String(form.get("otp") || "").trim();

    try {
      const result = await getJson("/api/customer/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, otp })
      });

      verifyForm.reset();
      showTab("login");
      loginForm.querySelector('[name="identifier"]').value = email;
      message("loginMessage", result.message || "Email terverifikasi. Silakan login.");
    } catch (error) {
      message("verifyMessage", error.message || "Verifikasi gagal. Silakan coba lagi.");
    } finally {
      submit.disabled = false;
    }
  });

  $("#resendCustomerOtp").addEventListener("click", async () => {
    const button = $("#resendCustomerOtp");
    button.disabled = true;
    message("verifyMessage", "Meminta kode baru...");

    try {
      const result = await getJson("/api/customer/resend-otp", {
        method: "POST",
        body: JSON.stringify({
          email: String($("#customerVerifyEmail").value || "").trim().toLowerCase()
        })
      });

      let text = result.message || "Permintaan diproses.";
      if (result.development_otp) {
        text += " Kode OTP khusus pengujian lokal: " + result.development_otp;
      }
      message("verifyMessage", text);
    } catch (error) {
      message("verifyMessage", error.message || "Kode belum dapat dikirim ulang.");
    } finally {
      button.disabled = false;
    }
  });

  $("#backToCustomerLogin").addEventListener("click", () => showTab("login"));

  $("#customerLogout").addEventListener("click", async () => {
    const button = $("#customerLogout");
    button.disabled = true;

    try {
      await getJson("/api/customer/logout", { method: "POST", body: "{}" });
      customer = null;
      renderAccount();
      showTab("login");
      toast("Anda telah logout.");
    } catch (error) {
      toast(error.message || "Logout gagal. Silakan coba lagi.");
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) closeAccount();
  });

  refreshAccount();
})();


