# QA RoomFlow — Booking/Hold Engine v2

**Tanggal:** 2026-10-17
**Lingkungan:** produksi — `https://venueone.ytcb.org` → nginx → `roomflow-frontend` (3001) + `roomflow-backend` (3000) + `roomflow-postgres` (5432, healthy)
**Metode:** uji perilaku terhadap API yang sedang berjalan dan SQL langsung ke database produksi. Semua angka di bawah dibaca ulang dari sistem, bukan dari inspeksi kode.

---

## Ringkasan

| Area | Status | Catatan |
|---|---|---|
| Pemisahan role (renter vs staff) | ✅ hijau | diuji dua arah dengan token nyata |
| Cegah kebocoran data `GET /bookings` | ✅ hijau | RENTER 0 baris, filter dipaksa ke caller |
| Hold dipasang di checkout, bukan di keranjang | ✅ hijau | TTL di DB = `00:15:00` |
| Idempotensi | ✅ hijau | key sama → order sama; tanpa key → 422 |
| Batas role pada `GET /orders/:id` | ✅ hijau | order orang lain → 404 |
| Suite konkurensi (9 skenario) | ✅ hijau | 3× berturut-turut |
| Validasi format tanggal | ✅ hijau | 400, bukan 409 |
| Vakansi staff vs slot rental | ✅ hijau | tidak ada tumpang tindih |
| Kebocoran hold setelah gateway gagal | ✅ hijau | 0 baris |
| **Pembayaran uang sungguhan** | ⛔ **blokir** | QR sandbox = placeholder, tidak bisa menerima uang |

---

## 1. Pemisahan role — diuji dua arah

Endpoint `POST /bookings` hanya untuk staff. Renter harus lewat keranjang → `POST /checkout`.

```
RENTER   POST /bookings 08:00–09:00  → 403
         "Renter harus memesan lewat keranjang dan pembayaran. Endpoint ini untuk staff."

USER     POST /bookings 08:00–09:00  → 201  → CONFIRMED / INTERNAL / user@roomflow.local
ADMIN_IT POST /bookings 08:00–09:00  → 409  "Slot sudah diambil."   ← constraint, bukan bug
```

Role staff **ditolak di luar jam operasional** (staff window MLB HALL Senin = 07:00–09:00):

```
RENTER   POST /bookings 09:00–10:00  → 403  (ditolak lebih dulu di guard role)
ADMIN_IT POST /bookings 09:00–10:00  → 422  "Di luar jam kerja. Ruangan hanya bisa
                                            dipinjam staff di dalam jam operasional."
```

Yang ditulis ke database:

```
status     | source    | judul    | dibuat_oleh         | room     | jam
CONFIRMED  | INTERNAL  | QA USER  | user@roomflow.local | MLB HALL | 08:00-09:00
```

**Kenapa dua arah wajib diuji.** Kalau hanya uji penolakan, ia tetap hijau saat.bookingan staff dimatikan total. Kalau hanya uji successes, ia tetap hijau saat slotnya masih diblokir. Yang terbukti di sini: staff bisa, RENTER tidak bisa, dan slot 09:00–10:00 kembali milik renter.

## 2. Cegah kebocoran data di `GET /bookings`

`findAll(roomId?, userId?)` pernah mengembalikan seluruh tabel ke semua role. Sekarang di-scope di **controller** — filter dipaksa ke id pemanggil untuk role terbatas.

```
per saat probe:   ADMIN_IT 17 · ROOM_ADMIN 17 · USER 17 · RENTER 0
RENTER ?userId=<id admin>  → 0 baris   (filter dipaksa, tidak bisa enumerate orang lain)
tanpa header auth          → 401
```

Yang dicek adalah **panjang body per role**, bukan status code — keempat role membalas `200` sebelum fix, jadi status code tidak pernah menemukan kebocoran ini.

## 3. Alur renter: keranjang → checkout → bayar

```
POST /cart/items   → 201   keranjang berisi 1 item, total 50.000   (tidak mengunci slot)
POST /checkout     → 201   order AWAITING_PAYMENT, payment PENDING, hold expiresAt 08:11:28
```

TTL dibaca dari database, bukan dari response:

```
status | source | email             | ttl       | settling | punya_order
HELD   | RENTAL | jack@mail.com     | 00:15:00 | f        | t
```

`00:15:00`, bukan `00:00:00` — ini yang membuktikan literal `interval` benar-benar sampai ke `INSERT`. Response `201` saja tidak membuktikannya.

## 4. Idempotensi

```
POST /checkout dengan key sama ×2  → order id sama (True)
POST /checkout tanpa Idempotency-Key → 422 "Header Idempotency-Key wajib diisi untuk checkout."
```

## 5. Poll tidak menghilangkan metode pembayaran

`POST /checkout` mengembalikan `qrString` + `paymentUrl`; `GET /orders/:id` harus mengembalikan yang sama, kalau tidak QRIS hilang begitu frontend mulai polling.

```
GET /orders/65c35e02… →
{"order":{…,"status":"AWAITING_PAYMENT"},
 "payment":{"status":"PENDING","txnId":"g7ij3riq","method":"qris","amount":50000,
            "fee":"660","qrString":"qris-placeholder-for-g7ij3riq-venueone",
            "paymentUrl":"https://app.pakasir.com/pay-v2/g7ij3riq"},
 "hold":{"expiresAt":"…","settling":false,"extended":false}}
```

## 6. Batas akses antar order

```
USER lain → GET /orders/{id renter}  → 404 "Pesanan tidak ditemukan."
```

## 7. Validasi format tanggal

```
date=xx       → 400   (sebelumnya 409 — 409 membuat klien mengira slot bentrok)
date=2026-11-02 → 200
```

## 8. Vakansi staff vs slot rental

Staff window sudah dipangkas ke 07:00–09:00 (keputusan pengguna) supaya tidak memblokir jam yang sudah dibayar renter.

```
ruang    | dow | staff     | rental      | status
Badminton|  1  | 7:00-17:00| 17:00-23:00 | ok
MLB HALL |  1  | 7:00-9:00 | 9:00-17:00  | ok
```

Tidak ada tumpang tindih. Hari tanpa baris rental tidak muncul di tabel itu — itu benar, bukan data hilang.

## 9. Suite konkurensi — 9 skenario, 3× berturut-turut

```
PASS  #1  btree_gist terpasang
PASS  #1b exclusion constraint aktif
PASS  #2  dua user paralel → tepat satu menang
PASS  #3  50 user rebut 1 slot → 1 booking, bukan 50
PASS  #4  settling=true memblokir checkout (fail-closed)
PASS  #5  retry dengan Idempotency-Key sama → satu Order + TTL benar
PASS  #6  webhook ×5 paralel → 1 WebhookEvent
PASS  #7  slot bersebelahan (10–11 lalu 11–12) tidak bentrok
PASS  #8  partial overlap (10–12 vs 11–13) ditolak

=== 9 lulus, 0 gagal ===   ×3
```

## 10. Deteksi kebocoran hold

Kondisi yang harus selalu 0: order `AWAITING_PAYMENT` tanpa `gatewayTxnId` — booking tetap memblokir slot tapi tidak ada invoice yang bisa dibayar.

```
SELECT count(*) FROM "Order" o JOIN "Payment" p ON p."orderId"=o.id
 WHERE o."gatewayTxnId" IS NULL AND o.status='AWAITING_PAYMENT';

leaked_holds
------------
            0
```

---

## ⛔ Blokir: jalur pembayaran belum bisa menerima uang sungguhan

Dengan API key sandbox, gateway tetap mengembalikan `txn_id` nyata dan respons `201`, tapi payload QR-nya:

```
qrString: "qris-placeholder-for-g7ij3riq-venueone"
```

Placeholder. Tidak ada QR yang bisa di-scan, tidak ada dana yang bisa masuk. **Jangan laporkan jalur pembayaran sebagai terverifikasi** sampai key produksi dipakai dan QR yang kembali bukan placeholder — cukup satu transaksi uji nyata.

Test #4 di suite konkurensi membuktikan perilaku `settling` benar secara internal; itu tidak mengubah kenyataan bahwa uang belum pernah sampai.

---

## Kebersihan data

Semua data uji dibersihkan dalam satu transaksi (FK order: `CartItem` → `Cart`, `Booking` → `OrderItem` → `Payment` → `Order`, lalu `AuditLog` di-sapu per entitas yang hilang).

```
sebelum → sesudah
Order        1  →  0
Payment      1  →  0
OrderItem    1  →  0
Cart         1  →  0
CartItem     1  →  0
Booking QA   2  →  0     (total Booking tetap 32: CONFIRMED 17 · EXPIRED 11 · CANCELLED 4)
AuditLog     8  →  8     (8 baris `migration_conflict_resolved` — riwayat produksi, sengaja disimpan)
```

Leak detector setelah bersih: **0**. Token uji dihapus dari disk.

---

## Jebakan yang menyesatkan selama QA

Tiga di siniestone cached-nya lebih mahal daripada bug yang dicari:

- **Token yang lewat output tool ter-redact jadi `***`.** Semua endpoint membalas 401 dan tampak seperti backend mati. Solusinya: tulis file token di perintah shell yang sama dengan login-nya, lalu `curl -H @file`.
- **Route group `(dashboard)`/`(admin)` tidak muncul di URL.** `/bookings` membalas 404 bukan karena rusak, tapi memang tidak ada routenya. Peta route yang benar dari `find src/app -name page.tsx`.
- **Image bisa lebih tua dari source.** `docker compose build` selesai, container restart, tapi `dist` masih kode lama. Verifikasi dengan `docker exec roomflow-backend grep -c '<marker>' dist/src/<path>.js` sebelum menyatakan sesuatu live. Build `--no-cache` hanya perlu kalau marker benar-benar tidak cocok.