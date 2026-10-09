import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = p => fs.readFile(path.join(root, p), 'utf8');
const index = await read('public/index.html');
const app = await read('public/assets/app.js');
const detailHtml = await read('public/detail.html');
const detailJs = await read('public/assets/detail.js');
const css = await read('public/assets/style.css');
const productsApi = await read('functions/api/products.js');
const redirects = await read('public/_redirects');

const count = (text, regex) => [...text.matchAll(regex)].length;
assert.equal(count(index, /class="hero-slide(?:\s|\")/g), 4, 'Homepage harus memuat empat slide hero.');
assert.equal(count(index, /class="category-tile"/g), 6, 'Homepage harus memuat enam tile kategori.');
assert.equal(count(index, /class="benefit-tile"/g), 5, 'Homepage harus memuat lima ilustrasi benefit.');
assert.match(index, /id="productGrid"/, 'Grid katalog harus tersedia.');
assert.match(index, /id="categoryChips"/, 'Filter kategori harus tersedia.');
assert.match(index, /id="minPrice"[\s\S]*id="maxPrice"[\s\S]*id="sortProducts"/, 'Filter harga dan pengurutan harus tersedia.');
assert.match(app, /function syncUrlFilters\(/, 'Filter harus dapat dibagikan lewat URL.');
assert.match(app, /function applyUrlFilters\(/, 'Filter URL harus dipulihkan saat halaman dibuka.');
assert.match(app, /function renderPagination\(/, 'Pagination harus tersedia.');
assert.match(app, /localStorage\.setItem\(CART_KEY/, 'Keranjang guest harus disimpan di browser.');
assert.doesNotMatch(app, /categoryArt\(|CATEGORY_ART/, 'Ikon kategori tidak boleh digunakan sebagai foto produk.');
assert.match(app, /function imageUrl\(value\)[\s\S]*startsWith\("https:\/\/"\)/, 'Foto produk harus memvalidasi URL yang didukung.');
assert.match(detailHtml, /id="detailImageFrame"/, 'Frame gambar detail produk harus tersedia.');
assert.match(detailHtml, /id="photoZoomDialog"/, 'Dialog zoom foto harus tersedia.');
assert.match(detailHtml, /Foto produk belum diunggah\./, 'Detail produk harus menunjukkan status foto belum ada.');
assert.doesNotMatch(detailJs, /fallbackByCategory|kategori-sayuran\.webp/, 'Detail tidak boleh mengganti foto produk dengan gambar kategori.');
assert.match(detailJs, /dialog\.showModal\(\)/, 'Zoom foto harus bisa dibuka.');
assert.match(productsApi, /lower\(p\.status\)='active'/, 'API publik hanya mengembalikan produk aktif.');
assert.match(productsApi, /JOIN variants v/, 'Produk yang dipublikasikan wajib memiliki varian.');
assert.match(productsApi, /JOIN sale_units u/, 'Produk yang dipublikasikan wajib memiliki satuan jual.');
assert.match(redirects, /\/produk\/\* \/detail\.html 200/, 'Rute slug detail produk harus tersedia.');
assert.match(css, /@media\(max-width:680px\)[\s\S]*\.detail-layout\{grid-template-columns:1fr/, 'Detail produk harus responsif di mobile.');
assert.match(css, /@media\(max-width:680px\)\{\.site-header\{position:sticky;top:0;z-index:30\}\}/, 'Header harus tetap sticky pada perangkat mobile.');

// Check local images and linked static pages referenced by shipped HTML/CSS.
const htmlFiles = ['public/index.html', 'public/detail.html', 'public/tentang-kami.html', 'public/cara-belanja.html', 'public/kebijakan-pengiriman.html', 'public/lacak-pesanan.html', 'public/pesanan.html', 'public/admin/index.html'];
const missing = [];
for (const file of htmlFiles) {
  const content = await read(file);
  for (const m of content.matchAll(/(?:src|href)=["'](\/(?:assets\/|icon-\d+\.png|manifest\.webmanifest|tentang-kami\.html|cara-belanja\.html|kebijakan-pengiriman\.html|lacak-pesanan(?:\.html)?|admin\/|detail\.html)[^"']*)["']/g)) {
    const url = m[1].split(/[?#]/)[0];
    if (url.startsWith('/assets/') || url.startsWith('/icon-') || url === '/manifest.webmanifest' || url.endsWith('.html')) {
      const target = path.join(root, 'public', url.replace(/^\//, ''));
      try { await fs.access(target); } catch { missing.push(`${file}: ${url}`); }
    }
  }
}
assert.deepEqual(missing, [], `Referensi berkas lokal hilang:\n${missing.join('\n')}`);

console.log('OK: Tahap 1 static smoke test passed.');
console.log('4 hero slides; 6 category tiles; 5 benefit tiles; filters, pagination, detail zoom, blank image slots, active-product API, and local assets checked.');
