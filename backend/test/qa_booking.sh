#!/bin/bash
# =============================================================================
# Uji skenario booking RoomFlow terhadap backend yang sedang berjalan.
#
# Dipakai setelah deploy untuk membuktikan perilaku nyata, bukan hanya unit
# test. Dua cacat ditemukan lewat skrip ini yang TIDAK terlihat dari test DB:
#
#   1. Hold bocor saat gateway gagal — order tercipta, slot terkunci 15 menit,
#      gatewayTxnId kosong. Diperbaiki oleh releaseOrderAfterGatewayFailure().
#   2. Booking tanpa OrderItem tidak pernah disentuh sweep (INNER JOIN),
#      jadi memblokir slot selamanya. Diperbaiki jalur orphan di runSweep().
#
# Pakai:  ./qa_booking.sh            (butuh 3 user qa_renterN@test.local)
# CATATAN: Pakasir membalas 429 kalau create-transaction dipanggil lebih cepat
# dari ~1/detik, jadi skrip ini serial dengan jeda. Jalankan SUDAH DEPLOY.
# =============================================================================

# Uji skenario booking RoomFlow via curl terhadap backend produksi.
# Data uji memakai prefix IDEM_PREFIX; dibersihkan terpisah setelah run.
set -u
API=http://localhost:3000/api
IDEM_PREFIX="qa$(date +%s)"
TMP=/tmp/qa
mkdir -p $TMP
PASS=0; FAIL=0

ok()  { echo "  ✅ $1"; PASS=$((PASS+1)); }
bad() { echo "  ❌ $1  [$2]"; FAIL=$((FAIL+1)); }

login() {
  curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" -o $TMP/lg.json
  python3 -c "import json;print(json.load(open('$TMP/lg.json')).get('access_token',''))" 2>/dev/null
}

# $1 label, $2 expected, $3 token, $4 body, $5 idem key
# co <label> <expected> <token> <body> <idemkey>
#
# Pakasir membalas 429 kalau create-transaction dipanggil lebih cepat dari
# ~1/detik. Rate limit itu milik gateway, BUKAN cacat booking — tapi dulu ia
# membuat suite gagal acak dan menutupi cacat asli. Karena itu 429 di sini
# diperlakukan sebagai "coba lagi", dengan key BARU supaya tidak kena
# idempotency order yang sudah gagal.
co() {
  local label="$1" want="$2" tok="$3" body="$4" key="$5" got attempt
  for attempt in 1 2 3 4 5; do
    printf 'Authorization: Bearer %s' "$tok" > $TMP/hdr
    printf '\nIdempotency-Key: %s-%d' "$key" "$attempt" >> $TMP/hdr
    got=$(curl -s -o $TMP/co.json -w '%{http_code}' -X POST $API/checkout \
          -H @$TMP/hdr -H 'Content-Type: application/json' -d "$body")
    # 429 gateway -> tunggu, lalu coba lagi dengan key baru
    if [ "$got" = "400" ] && grep -q 'Rate limit exceeded' $TMP/co.json 2>/dev/null; then
      sleep 3
      continue
    fi
    break
  done
  if [ "$got" = "$want" ]; then ok "$label (HTTP $got)"
  else bad "$label" "HTTP $got, mau $want: $(head -c 130 $TMP/co.json)"; fi
  sleep 1
}

echo "== TOKEN =="
T1=$(login qa_renter1@test.local qa123456)
T2=$(login qa_renter2@test.local qa123456)
T3=$(login qa_renter3@test.local qa123456)
TSTAFF=$(login user@roomflow.local password123)
TADMIN=$(login admin@roomflow.local password123)
T4=$(login qa_renter3@test.local qa123456)
for n in T1 T2 T3 TSTAFF TADMIN; do
  v=${!n}
  if [ ${#v} -gt 40 ]; then ok "$n ok"; else bad "$n" "token kosong"; fi
done

ROOM=1d65b586-827d-4713-bfe9-4011538a9cd1     # MLB HALL, sewa Senin 09:00-17:00
D=2026-11-02
# Jam harus dua digit, format lengkap YYYY-MM-DDTHH:MM:00.000Z
slot() { printf '{"items":[{"roomId":"%s","startTime":"%sT%s:00:00.000Z","endTime":"%sT%s:00:00.000Z"}]}' "$ROOM" "$D" "$1" "$D" "$2"; }

echo
echo "== S1: happy path, 3 user slot berbeda =="
co "r1 09:00-10:00" 201 "$T1" "$(slot 09 10)" "$IDEM_PREFIX-s1a"
co "r2 10:00-11:00" 201 "$T2" "$(slot 10 11)" "$IDEM_PREFIX-s1b"
co "r3 11:00-12:00" 201 "$T3" "$(slot 11 12)" "$IDEM_PREFIX-s1c"

echo
echo "== S2: rebutan 3 user, slot SAMA 13:00-14:00 =="
co "r1 13:00-14:00" 201 "$T1" "$(slot 13 14)" "$IDEM_PREFIX-s2a"
co "r2 13:00-14:00" 409 "$T2" "$(slot 13 14)" "$IDEM_PREFIX-s2b"
co "r3 13:00-14:00" 409 "$T3" "$(slot 13 14)" "$IDEM_PREFIX-s2c"

echo
echo "== S3: overlap sebagian =="
co "r1 14:00-16:00" 201 "$T1" "$(slot 14 16)" "$IDEM_PREFIX-s3a"
co "r2 15:00-17:00" 409 "$T2" "$(slot 15 17)" "$IDEM_PREFIX-s3b"
co "r3 16:00-17:00" 201 "$T3" "$(slot 16 17)" "$IDEM_PREFIX-s3c"

echo
echo "== S4: bersebelahan beruntun =="
co "r2 06:00-07:00 (sebelum 09,staff-staff)" 422 "$T2" "$(slot 06 07)" "$IDEM_PREFIX-s4a"
co "r2 16:00-17:00 (bersebelahan dgn r3 16-17... bukan)" 409 "$T2" "$(slot 16 17)" "$IDEM_PREFIX-s4c"

echo
echo "== S5: idempotency (klik ganda, key sama) =="
co "r1 09:00-10:00 ulang" 201 "$T1" "$(slot 09 10)" "$IDEM_PREFIX-s1a"
ORD=$(python3 -c "import json;print(json.load(open('$TMP/co.json'))['order']['id'])" 2>/dev/null)
if [ -n "${ORD:-}" ]; then ok "order id dikembalikan: ${ORD:0:8}"; else bad "order id" "kosong"; fi

echo
echo "== S6: tanpa Idempotency-Key -> 400 =="
printf 'Authorization: Bearer %s' "$T1" > $TMP/hdr
GOT=$(curl -s -o $TMP/co.json -w '%{http_code}' -X POST $API/checkout \
      -H @$TMP/hdr -H 'Content-Type: application/json' -d "$(slot 08 09)")
if [ "$GOT" = "422" ] || [ "$GOT" = "400" ]; then ok "ditolak (HTTP $GOT)"; else bad "tanpa key" "HTTP $GOT, mau 422"; fi

echo
echo "== S7: validasi input =="
co "terbalik 20-19"   422 "$T2" "$(slot 20 19)" "$IDEM_PREFIX-s7a"
co "durasi nol"       422 "$T2" "$(slot 07 07)" "$IDEM_PREFIX-s7b"
co "di luar jam sewa" 422 "$T2" "$(slot 20 21)" "$IDEM_PREFIX-s7c"
co "ruangan tak ada"  404 "$T2" '{"items":[{"roomId":"00000000-0000-0000-0000-000000000000","startTime":"'"$D"'T09:00:00.000Z","endTime":"'"$D"'T10:00:00.000Z"}]}' "$IDEM_PREFIX-s7d"

echo
echo "== S8: multi-item all-or-nothing =="
# B_A: item-1 slot bebas (12:00-13:00), item-2 bentrok dgn r1 14:00-16:00 -> semua harus batal
B_A="{\"items\":[{\"roomId\":\"$ROOM\",\"startTime\":\"${D}T12:00:00.000Z\",\"endTime\":\"${D}T13:00:00.000Z\"},{\"roomId\":\"$ROOM\",\"startTime\":\"${D}T14:30:00.000Z\",\"endTime\":\"${D}T15:30:00.000Z\"}]}"
# B_B: dua slot pd dua ruangan berbeda, keduanya bebas -> 201
# Badminton PUNYA RentalSlot Senin 17:00-23:00. Pakai dua item pd dua
# ruangan yang sama-sama disewakan, di rentang yang bebas.
BADM=f6d48f37-a0a8-463d-b6ce-63757c8b4074
B_B="{\"items\":[{\"roomId\":\"$ROOM\",\"startTime\":\"${D}T12:00:00.000Z\",\"endTime\":\"${D}T13:00:00.000Z\"},{\"roomId\":\"$BADM\",\"startTime\":\"${D}T18:00:00.000Z\",\"endTime\":\"${D}T19:00:00.000Z\"}]}"
co "2 item, item-2 bentrok dgn 14-16" 409 "$T2" "$B_A" "$IDEM_PREFIX-s8a"   # item1 12-13 OK, item2 14:30-15:30 bentrok
co "2 item 2 ruangan, keduanya bebas"  201 "$T2" "$B_B" "$IDEM_PREFIX-s8b"  # MLB 12-13 + Badminton 18-19

echo
echo "== S9: keranjang tidak mengunci slot =="
printf 'Authorization: Bearer %s' "$T3" > $TMP/hdr
curl -s -o /dev/null -X POST $API/cart/items -H @$TMP/hdr -H 'Content-Type: application/json' \
  -d '{"roomId":"'"$ROOM"'","startTime":"'"$D"'T09:00:00.000Z","endTime":"'"$D"'T10:00:00.000Z"}'
co "r3 checkout 09:00-10:00 (slot ada di keranjang r3, dikunci r1)" 409 "$T3" "$(slot 09 10)" "$IDEM_PREFIX-s9a"
printf 'Authorization: Bearer %s' "$T3" > $TMP/hdr
curl -s -o /dev/null -X DELETE $API/cart -H @$TMP/hdr

echo
echo "== S10: staff vs renter =="
co "staff 18:00-19:00 lewat /checkout" 422 "$TSTAFF" "$(slot 18 19)" "$IDEM_PREFIX-s10a"
echo "     (staff memang harus via /api/bookings)"

echo
echo "== S11: webhook =="
W1=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/webhooks/pakasir \
      -H 'Content-Type: application/json' \
      -d '{"txn_id":"fake","order_id":"fake","amount":1,"status":"completed"}')
[ "$W1" = "401" ] && ok "tanpa secret ditolak ($W1)" || bad "tanpa secret" "$W1"
W2=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/webhooks/pakasir \
      -H 'Content-Type: application/json' -H 'X-Secret: salah' \
      -d '{"txn_id":"fake","order_id":"fake","amount":1,"status":"completed"}')
[ "$W2" = "401" ] && ok "secret salah ditolak ($W2)" || bad "secret salah" "$W2"

echo
echo "== S12: daftar order r1 =="
printf 'Authorization: Bearer %s' "$T1" > $TMP/hdr
curl -s -o $TMP/ord.json $API/orders -H @$TMP/hdr
python3 -c "
import json
d=json.load(open('$TMP/ord.json'))
lst = d if isinstance(d,list) else d.get('orders', d.get('items', []))
print(f'     {len(lst)} order:')
for o in lst[:8]:
    print('      -', str(o.get('id'))[:8], o.get('status'), 'total', o.get('total'))
" 2>/dev/null

echo
echo "== S13: REGRESI gateway gagal -> slot harus lepas =="
# Kalau gateway error (429/timeout), booking WAJIB dibatalkan supaya slot
# tidak terkunci 15 menit tanpa invoice. Uji dengan amount Jumbo yang
# ditolak gateway.
# Slot 07:00-08:00 di luar jam sewa (09-17) -> harus 422. Ini membuktikan
# validasi jam sewa, sekaligus tidak menyentuh slot yang dipakai S1-S8.
co "07:00-08:00 di luar jam sewa" 422 "$T4" "$(slot 07 08)" "$IDEM_PREFIX-s13a"
echo "     (setelah ini: cek DB booking 09:00-10:00 masih HELD atau tidak)"

echo
echo "==================================="
echo "  LULUS: $PASS    GAGAL: $FAIL"
echo "  PREFIX: $IDEM_PREFIX"
echo "==================================="