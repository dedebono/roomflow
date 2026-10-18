/**
 * Self-check untuk expandSeries — logika murni, tanpa database.
 *
 *   npx ts-node --transpile-only test/series-expand.ts
 *
 * Fokus pada hal yang paling mudah salah: hari dalam seminggu tidak boleh
 * bergeser (bug DST ±7 jam), durasi tiap sesi harus tetap sama, dan pola
 * CUSTOM harus menghasilkan tepat jumlah hari x siklus.
 */
import { expandSeries } from '../src/checkout/series.service';

let failed = 0;
function check(name: string, cond: boolean, extra = '') {
  if (!cond) {
    failed++;
    console.log(`  FAIL ${name} ${extra}`);
  } else {
    console.log(`  ok   ${name}`);
  }
}
function dayOf(iso: string) {
  return new Date(iso).getUTCDay(); // 0=Minggu
}

// 2026-11-02 = Senin.
const MON = '2026-11-02T09:00:00.000Z';
const MON_END = '2026-11-02T11:00:00.000Z';

console.log('WEEKLY, 4 sesi');
{
  const r = expandSeries({ pattern: 'WEEKLY', occurrences: 4 }, MON, MON_END);
  check('jumlah sesi = 4', r.length === 4, `got ${r.length}`);
  check(
    'semua hari Senin',
    r.every((s) => dayOf(s.start.toISOString()) === 1),
    r.map((s) => dayOf(s.start.toISOString())).join(','),
  );
  check(
    'jarak tepat 7 hari',
    r.every((s, i) => i === 0 || s.start.getTime() - r[i - 1].start.getTime() === 7 * 86400000),
  );
  check('jam dinding tetap 09:00', r.every((s) => s.start.toISOString().substring(11, 16) === '09:00'));
  check('durasi tetap 2 jam', r.every((s) => (s.end.getTime() - s.start.getTime()) / 3600000 === 2));
}

console.log('BIWEEKLY, 3 sesi');
{
  const r = expandSeries({ pattern: 'BIWEEKLY', occurrences: 3 }, MON, MON_END);
  check('jumlah sesi = 3', r.length === 3, `got ${r.length}`);
  check(
    'jarak tepat 14 hari',
    r.every((s, i) => i === 0 || s.start.getTime() - r[i - 1].start.getTime() === 14 * 86400000),
  );
}

console.log('intervalWeeks eksplisit = 3');
{
  const r = expandSeries({ pattern: 'WEEKLY', intervalWeeks: 3, occurrences: 3 }, MON, MON_END);
  check(
    'jarak tepat 21 hari',
    r.every((s, i) => i === 0 || s.start.getTime() - r[i - 1].start.getTime() === 21 * 86400000),
  );
}

console.log('CUSTOM: Senin+Kamis, 3 siklus');
{
  const r = expandSeries(
    { pattern: 'CUSTOM', daysOfWeek: [1, 4], occurrences: 6 },
    MON,
    MON_END,
  );
  check('jumlah sesi = 6', r.length === 6, `got ${r.length}`);
  const dows = r.map((s) => dayOf(s.start.toISOString()));
  check('hanya Senin(1) dan Kamis(4)', dows.every((d) => d === 1 || d === 4), dows.join(','));
  check(
    'pola berulang 1,4,1,4,1,4',
    dows.join(',') === '1,4,1,4,1,4',
    dows.join(','),
  );
}

console.log('CUSTOM dengan until');
{
  // 2026-11-02 s/d 2026-11-30
  const r = expandSeries(
    { pattern: 'CUSTOM', daysOfWeek: [1], until: '2026-11-30' },
    MON,
    MON_END,
  );
  // Senin: 2, 9, 16, 23, 30 Nov = 5
  check('jumlah sesi = 5', r.length === 5, `got ${r.length}: ${r.map((s) => s.start.toISOString().substring(0, 10)).join(',')}`);
  check(
    'terakhir = 30 Nov',
    r[r.length - 1].start.toISOString().substring(0, 10) === '2026-11-30',
    r[r.length - 1].start.toISOString(),
  );
}

console.log('ONCE');
{
  const r = expandSeries({ pattern: 'ONCE' }, MON, MON_END);
  check('tepat 1 sesi', r.length === 1);
  check('tanggal tidak berubah', r[0].start.toISOString() === MON);
}

console.log('Error harus dilempar');
function expectThrow(name: string, fn: () => any, code?: string) {
  try {
    fn();
    failed++;
    console.log(`  FAIL ${name} — tidak melempar`);
  } catch (e: any) {
    const got = e?.getResponse?.().code;
    if (code && got !== code) {
      failed++;
      console.log(`  FAIL ${name} — kode ${got}, harap ${code}`);
    } else {
      console.log(`  ok   ${name} (${got})`);
    }
  }
}
expectThrow(
  'CUSTOM tanpa daysOfWeek',
  () => expandSeries({ pattern: 'CUSTOM', occurrences: 2 }, MON, MON_END),
  'DAYS_REQUIRED',
);
expectThrow(
  'tanpa occurrences maupun until',
  () => expandSeries({ pattern: 'WEEKLY' }, MON, MON_END),
  'SERIES_NEEDS_END',
);
expectThrow(
  'until sebelum mulai',
  () => expandSeries({ pattern: 'WEEKLY', until: '2026-10-01' }, MON, MON_END),
  'INVALID_UNTIL',
);
expectThrow(
  'durasi negatif',
  () => expandSeries({ pattern: 'ONCE' }, MON_END, MON),
  'INVALID_RANGE',
);
expectThrow(
  'hari di luar 1..7',
  () => expandSeries({ pattern: 'CUSTOM', daysOfWeek: [9], occurrences: 1 }, MON, MON_END),
  'INVALID_DAY',
);
expectThrow(
  'occurrences melebihi yang bisa dihasilkan',
  () => expandSeries({ pattern: 'WEEKLY', occurrences: 50, until: '2026-11-10' }, MON, MON_END),
  'SERIES_TOO_SHORT',
);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURE(S)`);
process.exit(failed === 0 ? 0 : 1);