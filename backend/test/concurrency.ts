/**
 * Test konkurensi untuk hold engine.
 *
 * Jalankan terhadap database NYATA, bukan mock. Yang diuji adalah
 * exclusion constraint PostgreSQL — mock Prisma tidak punya constraint
 * sama sekali, jadi test dengan mock akan selalu hijau sementara
 * produknya rusak.
 *
 *   node dist/test/concurrency.js        (setelah build)
 *   node test/concurrency.js             (langsung, butuh ts-node)
 *
 * DATABASE_URL harus menunjuk ke database yang SUDAH dimigrasi
 * (btree_gist + booking_no_overlap). Test #1 gagal keras kalau tidak.
 */
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert';

const prisma = new PrismaClient();
const GATEWAY = 'PAKASIR';

let pass = 0;
let fail = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    pass++;
  } catch (err: any) {
    console.error(`  FAIL  ${name}\n        ${err.message}`);
    fail++;
  }
}

function hhmm(d: Date) {
  return d.toISOString().substring(11, 16);
}

async function makeFixtures() {
  const passwordHash = 'x';
  const staff = await prisma.user.findFirst({ where: { email: 'staff@test.local' } });
  const renter = await prisma.user.findFirst({ where: { email: 'renter@test.local' } });
  const room = await prisma.room.findFirst({ where: { isRentable: true } });
  return {
    staff: staff ?? (await prisma.user.create({
      data: { name: 'Staff', email: 'staff@test.local', passwordHash, role: 'USER' },
    })),
    renter: renter ?? (await prisma.user.create({
      data: { name: 'Renter', email: 'renter@test.local', passwordHash, role: 'RENTER' },
    })),
    renter2: await prisma.user.findFirst({ where: { email: 'renter2@test.local' } }) ?? (await prisma.user.create({
      data: { name: 'Renter2', email: 'renter2@test.local', passwordHash, role: 'RENTER' },
    })),
    room: room ?? (await prisma.room.create({
      data: {
        name: `Test Room ${Date.now()}`,
        buildingId: (await prisma.building.findFirst())!.id,
        capacity: 10,
        isRentable: true,
      },
    })),
  };
}

/** Slot masa depan yang pasti kosong. 2099 dipakai agar tidak pernah bentrok. */
function slot(dayOffset: number, startH: number, endH: number) {
  const d = new Date(Date.UTC(2099, 0, 1 + dayOffset, startH, 0, 0, 0));
  return { start: d, end: new Date(Date.UTC(2099, 0, 1 + dayOffset, endH, 0, 0, 0)) };
}

/**
 * Reset TOTAL sebelum test. Wajib: kalau test dijalankan dua kali,
 * order dari run sebelumnya akan terhitung sebagai "yatim" dan assertion
 * gagal walau logikanya benar.
 */
async function resetAll(fx: any) {
  await prisma.$executeRaw`DELETE FROM "Booking" WHERE "roomId" = ${fx.room.id}`;
  await prisma.orderItem.deleteMany({ where: { roomId: fx.room.id } });
  // Semua Order/Payment/WebhookEvent yang dibuat test ini recognizable dari
  // pola idempotencyKey / txnId.
  await prisma.webhookEvent.deleteMany({ where: { gatewayTxnId: { startsWith: 'txn-dup-' } } });
  await prisma.order.deleteMany({
    where: {
      gatewayTxnId: null,
      idempotencyKey: { in: ['idem-key-1'] },
    },
  });
  await prisma.order.deleteMany({
    where: {
      gatewayTxnId: { startsWith: 'txn-dup-' },
    },
  });
  await prisma.payment.deleteMany({
    where: { gatewayTxnId: { startsWith: 'txn-dup-' } },
  });
  // Order dari skenario #2/#3 pakai key k2a-/k2b-/k3-
  await prisma.order.deleteMany({
    where: { idempotencyKey: { in: ['k7a', 'k7b', 'k8a', 'k8b', 'k6', 'k4'] } },
  });
  await prisma.order.deleteMany({ where: { idempotencyKey: { startsWith: 'k2' } } });
  await prisma.order.deleteMany({ where: { idempotencyKey: { startsWith: 'k3' } } });
  // Order tanpa item sama sekali = sisa test sebelumnya
  await prisma.order.deleteMany({
    where: { items: { none: {} }, gatewayTxnId: null, idempotencyKey: { not: null } },
  });
}

/** Retry deadlock — cerminan CheckoutService.withDeadlockRetry. */
async function withDeadlockRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const raw = String(err?.meta?.database_error || err?.message || '');
      const isDdl = err?.code === '40P01' || raw.includes('40P01') || raw.includes('deadlock detected');
      if (!isDdl || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 20 * (i + 1) + Math.random() * 40));
    }
  }
  throw new Error('unreachable');
}

/**
 * Simulasi checkout TANPA gateway (test offline).
 * Menyalin urutan operasi CheckoutService.acquireHolds + pembuatan Order.
 */
async function fakeCheckout(
  userId: string,
  roomId: string,
  s: Date,
  e: Date,
  key: string,
): Promise<{ ok: boolean; orderId?: string; code?: string; err?: string }> {
  try {
    const orderId = await withDeadlockRetry(() => prisma.$transaction(async (tx) => {
      // idempotency check
      const existing = await tx.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      });
      if (existing) return existing.id;

      const order = await tx.order.create({
        data: {
          userId,
          total: 100000,
          idempotencyKey: key,
          gateway: GATEWAY,
          gatewayOrderRef: `RF-${key.slice(0, 8)}`,
        },
      });

      // 1. cek settling
      const pending = await tx.booking.findFirst({
        where: {
          roomId,
          status: 'HELD',
          settling: true,
          startTime: { lt: e },
          endTime: { gt: s },
        },
      });
      if (pending) throw Object.assign(new Error('SETTLEMENT_PENDING'), { code: 'SETTLEMENT_PENDING' });

      // 2. reaping sinkron
      await tx.$executeRaw`
        UPDATE "Booking" SET settling = true, "updatedAt" = now()
         WHERE "roomId" = ${roomId} AND status = 'HELD' AND settling = false
           AND "holdExpiresAt" <= now()
           AND "startTime" < ${e} AND "endTime" > ${s}
      `;

      // 3. insert -> constraint yang memutuskan
      const bookingId = crypto.randomUUID();
      await tx.$executeRaw`
        INSERT INTO "Booking"
          (id,"roomId","userId",title,"startTime","endTime",status,source,"isRental",
           "holdExpiresAt",settling,"holdExtended","priceSnapshot","orderId","createdAt","updatedAt")
        VALUES
          (${bookingId},${roomId},${userId},'Test',${s},${e},'HELD','RENTAL',true,
           now() + interval '15 minutes', false, false, 100000, ${order.id}, now(), now())
      `;
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          bookingId,
          roomId,
          startTime: s,
          endTime: e,
          priceSnapshot: 100000,
        },
      });
      return order.id;
    }));
    return { ok: true, orderId };
  } catch (err: any) {
    const raw = String(err?.meta?.database_error || err?.message || '');
    const code = raw.includes('booking_no_overlap')
      ? 'SLOT_TAKEN'
      : err?.code === 'SETTLEMENT_PENDING'
        ? 'SETTLEMENT_PENDING'
        : raw.includes('40P01') || raw.includes('deadlock detected')
          ? 'DEADLOCK'
          : 'OTHER';
    return { ok: false, code, err: String(raw).slice(0, 200) };
  }
}

async function main() {
  console.log('\n=== TEST KONKURENSI HOLD ENGINE ===\n');

  // ---- #1 fondasi: tanpa ini semua test lain bohong ----
  await test('#1 btree_gist terpasang', async () => {
    const rows = await prisma.$queryRaw<any[]>`SELECT extname FROM pg_extension WHERE extname='btree_gist'`;
    assert(rows.length === 1, 'btree_gist tidak ada — constraint tidak mungkin dibuat');
  });

  await test('#1b exclusion constraint aktif', async () => {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT conname FROM pg_constraint WHERE conname = 'booking_no_overlap'
    `;
    assert(rows.length === 1, 'booking_no_overlap tidak ada di DB');
  });

  const fx = await makeFixtures();
  await resetAll(fx);

  // ---- #2 dua user paralel ----
  await test('#2 dua user paralel -> tepat satu menang', async () => {
    for (let i = 0; i < 20; i++) {
      const { start, end } = slot(0, 10, 12);
      await resetAll(fx);
      const [a, b] = await Promise.all([
        fakeCheckout(fx.renter.id, fx.room.id, start, end, `k2a-${i}`),
        fakeCheckout(fx.renter2.id, fx.room.id, start, end, `k2b-${i}`),
      ]);
      const winners = [a, b].filter((r) => r.ok);
      if (winners.length !== 1) {
      const losers = [a, b].filter((r) => !r.ok);
      throw new Error(
        `putaran ${i}: ${winners.length} Pemenang (harus 1); losers=${JSON.stringify(losers)}`,
      );
    }
      const loser = [a, b].find((r) => !r.ok);
      assert.strictEqual(
        loser?.code,
        'SLOT_TAKEN',
        `kode error: ${loser?.code} / ${(loser as any)?.err ?? ''}`,
      );

      // tidak ada booking nyasar
      const rows = await prisma.booking.findMany({
        where: { roomId: fx.room.id, status: { in: ['HELD', 'CONFIRMED'] } },
      });
      assert.strictEqual(rows.length, 1, `putaran ${i}: ${rows.length} booking aktif`);

      // request yang GAGAL tidak boleh meninggalkan Order tanpa OrderItem
      const orphanOrders = await prisma.order.count({
        where: {
          userId: { in: [fx.renter.id, fx.renter2.id] },
          gatewayTxnId: null,
          status: 'AWAITING_PAYMENT',
        },
      });
      const withItems = await prisma.orderItem.count({
        where: { roomId: fx.room.id },
      });
      assert.strictEqual(orphanOrders, withItems, `putaran ${i}: ada Order yatim (${orphanOrders} order, ${withItems} item)`);
    }
  });

  // ---- #3 N user rebut satu slot ----
  await test('#3 50 user rebut 1 slot -> 1 booking, bukan 50', async () => {
    const { start, end } = slot(1, 10, 12);
    await resetAll(fx);
    const users = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        prisma.user.upsert({
          where: { email: `racer${i}@test.local` },
          update: {},
          create: { name: `Racer ${i}`, email: `racer${i}@test.local`, passwordHash: 'x', role: 'RENTER' },
        }),
      ),
    );
    const results = await Promise.all(
      users.map((u, i) => fakeCheckout(u.id, fx.room.id, start, end, `k3-${i}`)),
    );
    const okResults = results.filter((r) => r.ok);
    const rows = await prisma.booking.findMany({
      where: { roomId: fx.room.id, status: { in: ['HELD', 'CONFIRMED'] } },
      select: { id: true, "userId": true, "startTime": true, "endTime": true, "orderId": true },
    });
    if (okResults.length !== 1 || rows.length !== 1) {
      const losers = results.filter((r) => !r.ok).map((r) => r.code);
      throw new Error(
        `pemenang=${okResults.length} baris=${rows.length} losers=${[...new Set(losers)]} ` +
        `rows=${JSON.stringify(rows.map((r) => ({ u: r.userId.slice(0,6), s: r.startTime, e: r.endTime })))}`,
      );
    }
  });

  // ---- #4 settling=true memblokir checkout ----
  await test('#4 settling=true memblokir checkout (fail-closed)', async () => {
    const { start, end } = slot(2, 10, 12);
    await resetAll(fx);
    // Booking HELD yang TTL-nya sudah lewat, settling=true (menunggu verdict).
    await prisma.$executeRaw`
      INSERT INTO "Booking"
        (id,"roomId","userId",title,"startTime","endTime",status,source,"isRental",
         "holdExpiresAt",settling,"holdExtended","priceSnapshot","createdAt","updatedAt")
      VALUES
        (${crypto.randomUUID()},${fx.room.id},${fx.renter.id},'settling',${start},${end},
         'HELD','RENTAL',true, now() - interval '1 hour', TRUE, false, 100000, now(), now())
    `;
    const res = await fakeCheckout(fx.renter2.id, fx.room.id, start, end, 'k4');
    assert.strictEqual(res.ok, false, 'checkout TIDAK BOLEH lolos');
    assert.strictEqual(res.code, 'SETTLEMENT_PENDING', `kode: ${res.code}`);

    // dan settling harus tetap true — tidak boleh di-reaping oleh checkout
    const still = await prisma.booking.findFirst({
      where: { roomId: fx.room.id, startTime: start },
    });
    assert.strictEqual(still?.settling, true, 'settling berubah — checkout merusak fail-closed');
  });

  // ---- #5 idempotency ----
  await test('#5 retry dengan Idempotency-Key sama -> satu Order + TTL benar', async () => {
    const { start, end } = slot(3, 10, 12);
    await resetAll(fx);
    const first = await fakeCheckout(fx.renter.id, fx.room.id, start, end, 'idem-key-1');
    assert(first.ok, 'checkout pertama gagal');
    const second = await fakeCheckout(fx.renter.id, fx.room.id, start, end, 'idem-key-1');
    assert.strictEqual(second.orderId, first.orderId, 'Order berbeda — idempotency bocor');
    const orders = await prisma.order.count({
      where: { userId: fx.renter.id, idempotencyKey: 'idem-key-1' },
    });
    assert.strictEqual(orders, 1, `harus 1 Order, dapat ${orders}`);

    // TTL harus ~15 menit, bukan 0. Regresi ini pernah terjadi: kolom
    // holdExpiresAt terisi sama dengan createdAt sehingga setiap hold
    // langsung dianggap expired.
    const bk = await prisma.booking.findFirstOrThrow({
      where: { roomId: fx.room.id, startTime: start },
    });
    const ttlMin = (bk.holdExpiresAt!.getTime() - bk.createdAt.getTime()) / 60000;
    assert(ttlMin > 14 && ttlMin <= 15.1, `TTL harus ~15 menit, dapat ${ttlMin.toFixed(2)}`);
  });

  // ---- #6 webhook ganda: 5 delivery paralel ----
  await test('#6 webhook x5 paralel -> 1 WebhookEvent', async () => {
    const { start, end } = slot(4, 10, 12);
    await resetAll(fx);
    const co = await fakeCheckout(fx.renter.id, fx.room.id, start, end, 'k6');
    assert(co.ok, 'checkout gagal');
    const order = await prisma.order.findUniqueOrThrow({ where: { id: co.orderId! } });
    const txnId = `txn-dup-${Date.now()}`;
    await prisma.order.update({ where: { id: order.id }, data: { gatewayTxnId: txnId } });
    const payment = await prisma.payment.create({
      data: { orderId: order.id, userId: fx.renter.id, amount: 100000, status: 'PENDING', gateway: GATEWAY, gatewayTxnId: txnId },
    });

    const booking = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } });

    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        prisma.webhookEvent
          .create({
            data: { gateway: 'gw-id', gatewayTxnId: txnId, eventType: 'completed' },
          })
          .then(() => 'created')
          .catch((e: any) => (e?.code === 'P2002' ? 'duplicate' : 'error')),
      ),
    );
    assert.strictEqual(attempts.filter((a) => a === 'created').length, 1,
      `harus tepat 1 yang create, dapat ${attempts.filter((a) => a === 'created').length}`);
    const events = await prisma.webhookEvent.count({
      where: { gateway: 'gw-id', gatewayTxnId: txnId },
    });
    assert.strictEqual(events, 1, `WebhookEvent = ${events}, harus 1`);

    // bonus: settlement idempotent (dipanggil 3x -> efek sekali)
    await Promise.all([
      confirmPaidSim(booking.bookingId!, order.id, payment.id, txnId),
      confirmPaidSim(booking.bookingId!, order.id, payment.id, txnId),
      confirmPaidSim(booking.bookingId!, order.id, payment.id, txnId),
    ]);
    const settled = await prisma.auditLog.count({
      where: { entityId: order.id, action: 'payment_confirmed' },
    });
    assert.strictEqual(settled, 1, `payment_confirmed tercatat ${settled}x, harus 1x`);
    void booking;
  });

  // ---- #7 bersebelahan tidak bentrok ----
  await test('#7 slot bersebelahan (10-11 lalu 11-12) tidak bentrok', async () => {
    const a = slot(5, 10, 11);
    const b = slot(5, 11, 12);
    await resetAll(fx);
    const first = await fakeCheckout(fx.renter.id, fx.room.id, a.start, a.end, 'k7a');
    const second = await fakeCheckout(fx.renter2.id, fx.room.id, b.start, b.end, 'k7b');
    assert(first.ok && second.ok, 'slot bersebelahan tidak boleh saling menolak');
  });

  // ---- #8 partial overlap ditolak ----
  await test('#8 partial overlap (10-12 vs 11-13) ditolak', async () => {
    const a = slot(6, 10, 12);
    const b = slot(6, 11, 13);
    await resetAll(fx);
    const first = await fakeCheckout(fx.renter.id, fx.room.id, a.start, a.end, 'k8a');
    const second = await fakeCheckout(fx.renter2.id, fx.room.id, b.start, b.end, 'k8b');
    assert(first.ok, 'booking pertama harus berhasil');
    assert.strictEqual(second.ok, false, 'partial overlap HARUS ditolak');
    assert.strictEqual(second.code, 'SLOT_TAKEN');
  });

  await resetAll(fx);
  console.log(`\n=== ${pass} lulus, ${fail} gagal ===\n`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

/**
 * Meniru SettlementService.confirmPaid yang sudah diperbaiki: guard
 * AWAITING_PAYMENT -> PAID pakai updateMany bersyarat, sehingga hanya satu
 * dari beberapa pemanggil paralel yang menang.
 */
async function confirmPaidSim(bookingId: string, orderId: string, paymentId: string, txnId: string) {
  const won = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'AWAITING_PAYMENT' },
      data: { status: 'PAID', paidAt: new Date(), settledAt: new Date() },
    });
    if (count === 0) return false;
    await tx.booking.updateMany({
      where: { id: bookingId, status: 'HELD' },
      data: { status: 'CONFIRMED', settling: false, confirmedAt: new Date(), settledAt: new Date() },
    });
    await tx.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        entityType: 'Order',
        entityId: orderId,
        action: 'payment_confirmed',
        toState: 'PAID',
        actorType: 'GATEWAY',
        meta: { bookingId, txnId },
      },
    });
    return true;
  });
  return won;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
