# Deployment

Panduan langkah demi langkah yang berlaku untuk Tahap 4 berada di [`DEPLOYMENT_STEP_BY_STEP_ID.md`](DEPLOYMENT_STEP_BY_STEP_ID.md). Ikuti urutan lokal → GitHub → Cloudflare Pages preview, dan jangan lompat langsung ke production.

Konfigurasi `wrangler.jsonc` pada repository ini khusus lokal: D1 bernama `sayur-pasundan-local`, R2 lokal/emulasi, serta variabel bisnis nonrahasia. Konfigurasi ini sengaja tidak memiliki `pages_build_output_dir`; konfigurasi Pages production harus diatur di Dashboard Cloudflare.

## Perintah pemeriksaan

```powershell
npm run check:js
npm run check:stage1
npm run check:stage2
npm run check:stage3
npm run check:stage4
python scripts/check-schema.py
```

Jangan jalankan migrasi SQL remote atau skrip impor remote ke database produksi sebelum target ditinjau, perubahan telah direview, dan prosedur backup/pemulihan tersedia. Laporan status yang sedang berlaku ada di [`STAGE4_READINESS_AUDIT.md`](STAGE4_READINESS_AUDIT.md).
