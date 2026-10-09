# Foto Produk

Taruh foto statis di folder ini hanya jika workbook `Foto_Produk.image_url` menunjuk ke `/assets/images/products/NAMA-FILE.webp`.

Jika file belum tersedia, generator impor melewati baris foto lokal tersebut agar katalog tidak menyimpan URL gambar yang pasti 404. Foto yang diunggah melalui Panel Admin disimpan ke R2 dan dapat menggunakan URL `/api/images/<key>`.

Jangan memasukkan workbook atau data pelanggan ke folder aset.
