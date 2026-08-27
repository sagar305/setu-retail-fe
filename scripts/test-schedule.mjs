/**
 * Assertions for the recurrence engine and reminder planner.
 * Run with: npm run test:schedule
 *
 * The TypeScript sources are compiled to a temp dir first so this stays a
 * plain `node` script with no test-runner dependency.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const work = mkdtempSync(join(tmpdir(), 'chorely-test-'));

try {
  // Compile the pure-logic modules, stripping the RN/i18n imports they only
  // use for display strings.
  cpSync('src/lib/dates.ts', join(work, 'dates.ts'));
  cpSync('src/lib/schedule.ts', join(work, 'schedule.ts'));

  const stubs = `
export const strings = {
  days: { today: 'Aaj', tomorrow: 'Kal', yesterday: 'Beeta kal' },
  frequency: { once: 'Ek baar', daily: 'Roz', alternate: 'Ek din chhod kar',
    weekday: 'Somvar se Shanivar', sunday: 'Sirf Ravivar', monthly: 'Har 4 hafte',
    twiceMonthly: 'Har 2 hafte', alternateSunday: 'Ek Ravivar chhod kar', custom: 'Apni marzi se' },
  snooze: { '6h': '6 ghante baad', '12h': '12 ghante baad', '1d': '1 din baad',
    '1w': '1 hafte baad', custom: 'Apna time' },
  units: { hour: 'Ghante', day: 'Din', week: 'Hafte', month: 'Mahine' },
};
export const WEEKDAY_LABELS = ['Ravi', 'Som', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani'];
export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
`;
  writeFileSync(join(work, 'strings.ts'), stubs);

  for (const file of ['dates.ts', 'schedule.ts']) {
    const path = join(work, file);
    let source = readFileSync(path, 'utf8');
    source = source.replace(/from '@\/i18n\/strings'/g, "from './strings'");
    source = source.replace(/import type \{[^}]*\} from '@\/types';\n/g, '');
    source = source.replace(/export type \{ DateKey, TimeKey \};/g, 'export type DateKey = string;\nexport type TimeKey = string;');
    source = source.replace(/: Chore\b/g, ': any').replace(/: Recurrence\b/g, ': any');
    source = source.replace(/: SnoozeSetting\b/g, ': any');
    source = source.replace(/Recurrence\['custom'\]/g, 'any');
    source = source.replace(/NonNullable<any>/g, 'any');
    writeFileSync(path, source);
  }

  try {
    execSync(
      `npx tsc --ignoreConfig ${join(work, 'dates.ts')} ${join(work, 'schedule.ts')} ${join(work, 'strings.ts')} ` +
        `--outDir ${join(work, 'out')} --module commonjs --target es2022 --noImplicitAny false --skipLibCheck`,
      { stdio: 'pipe' },
    );
  } catch (error) {
    console.error(error.stdout?.toString() ?? error.message);
    throw new Error('Compilation of the schedule modules failed.');
  }

  cpSync('scripts/schedule-cases.cjs', join(work, 'out', 'cases.cjs'));
  execSync(`node ${join(work, 'out', 'cases.cjs')}`, { stdio: 'inherit' });
} finally {
  rmSync(work, { recursive: true, force: true });
}
