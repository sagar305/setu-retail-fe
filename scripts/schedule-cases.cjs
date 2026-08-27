const {
  isDueOn,
  describeRecurrence,
  describeSnooze,
  snoozeMinutes,
  nextOccurrence,
  occurrencesBetween,
} = require('./schedule.js');
const { addDays, daysBetween, formatTime, toLocalDateTime } = require('./dates.js');

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${name}\n     got  ${JSON.stringify(actual)}\n     want ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// 2026-08-24 is a Monday. 2026-08-30 is a Sunday.
const base = { archived: false, startDate: '2026-08-24' };
const chore = (recurrence, overrides = {}) => ({ ...base, recurrence, ...overrides });

console.log('\n-- once --');
const once = chore({ preset: 'once' });
check('due on start day', isDueOn(once, '2026-08-24'), true);
check('not due next day', isDueOn(once, '2026-08-25'), false);
check('no next occurrence once past', nextOccurrence(once, '2026-08-25'), undefined);

console.log('\n-- daily --');
const daily = chore({ preset: 'daily' });
check('due every day', [0, 1, 2, 3].map((d) => isDueOn(daily, addDays('2026-08-24', d))), [true, true, true, true]);
check('not due before start', isDueOn(daily, '2026-08-23'), false);

console.log('\n-- alternate (every 2 days) --');
const alternate = chore({ preset: 'alternate' });
check('day 0/1/2/3', [0, 1, 2, 3].map((d) => isDueOn(alternate, addDays('2026-08-24', d))), [true, false, true, false]);

console.log('\n-- weekday (Mon-Sat, Sunday off) --');
const weekday = chore({ preset: 'weekday' });
check('Mon..Sat due', [0, 1, 2, 3, 4, 5].map((d) => isDueOn(weekday, addDays('2026-08-24', d))), [true, true, true, true, true, true]);
check('Sunday not due', isDueOn(weekday, '2026-08-30'), false);

console.log('\n-- sunday only --');
const sunday = chore({ preset: 'sunday' });
check('Sunday due', isDueOn(sunday, '2026-08-30'), true);
check('Monday not due', isDueOn(sunday, '2026-08-31'), false);
check('every Sunday', isDueOn(sunday, '2026-09-06'), true);

console.log('\n-- monthly = every 4 weeks on chosen weekday (Wed) --');
const monthly = chore({ preset: 'monthly', weekday: 3 });
check('week 0 Wed due', isDueOn(monthly, '2026-08-26'), true);
check('week 1 Wed not due', isDueOn(monthly, '2026-09-02'), false);
check('week 2 Wed not due', isDueOn(monthly, '2026-09-09'), false);
check('week 4 Wed due', isDueOn(monthly, '2026-09-23'), true);
check('never lands on a non-Wed', isDueOn(monthly, '2026-09-24'), false);

console.log('\n-- twice monthly = every 2 weeks on chosen weekday (Fri) --');
const twice = chore({ preset: 'twiceMonthly', weekday: 5 });
check('week 0 Fri due', isDueOn(twice, '2026-08-28'), true);
check('week 1 Fri not due', isDueOn(twice, '2026-09-04'), false);
check('week 2 Fri due', isDueOn(twice, '2026-09-11'), true);

console.log('\n-- alternate Sunday --');
const altSunday = chore({ preset: 'alternateSunday' });
check('first Sunday due', isDueOn(altSunday, '2026-08-30'), true);
check('next Sunday skipped', isDueOn(altSunday, '2026-09-06'), false);
check('following Sunday due', isDueOn(altSunday, '2026-09-13'), true);
check('non-Sunday never due', isDueOn(altSunday, '2026-09-14'), false);

console.log('\n-- custom --');
const every3Days = chore({ preset: 'custom', custom: { unit: 'day', interval: 3 } });
check('every 3 days', [0, 1, 2, 3, 6].map((d) => isDueOn(every3Days, addDays('2026-08-24', d))), [true, false, false, true, true]);

const customWeek = chore({ preset: 'custom', custom: { unit: 'week', interval: 2, daysOfWeek: [1, 4] } });
check('wk0 Mon due', isDueOn(customWeek, '2026-08-24'), true);
check('wk0 Thu due', isDueOn(customWeek, '2026-08-27'), true);
check('wk1 Mon not due', isDueOn(customWeek, '2026-08-31'), false);
check('wk2 Mon due', isDueOn(customWeek, '2026-09-07'), true);

const customDates = chore({ preset: 'custom', custom: { unit: 'month', interval: 1, datesOfMonth: [5, 20] } });
check('5th due', isDueOn(customDates, '2026-09-05'), true);
check('20th due', isDueOn(customDates, '2026-09-20'), true);
check('6th not due', isDueOn(customDates, '2026-09-06'), false);

console.log('\n-- archived --');
check('archived never due', isDueOn({ ...daily, archived: true }, '2026-08-25'), false);

console.log('\n-- date maths --');
check('year boundary', addDays('2026-12-31', 1), '2027-01-01');
check('leap day exists', addDays('2028-02-28', 1), '2028-02-29');
check('days across year', daysBetween('2026-12-31', '2027-01-01'), 1);
check('occurrences in a week', occurrencesBetween(customWeek, '2026-08-24', '2026-08-30'), ['2026-08-24', '2026-08-27']);

console.log('\n-- time helpers --');
check('format morning', formatTime('09:05'), '9:05 AM');
check('format noon', formatTime('12:00'), '12:00 PM');
check('format midnight', formatTime('00:30'), '12:30 AM');
check('format evening', formatTime('18:45'), '6:45 PM');
const dt = toLocalDateTime('2026-08-24', '18:45');
check('local datetime hour', dt.getHours(), 18);
check('local datetime date', dt.getDate(), 24);

console.log('\n-- snooze --');
check('6h', snoozeMinutes({ preset: '6h' }), 360);
check('12h', snoozeMinutes({ preset: '12h' }), 720);
check('1 day', snoozeMinutes({ preset: '1d' }), 1440);
check('1 week', snoozeMinutes({ preset: '1w' }), 10080);
check('custom 3 hours', snoozeMinutes({ preset: 'custom', customAmount: 3, customUnit: 'hour' }), 180);
check('custom 2 days', snoozeMinutes({ preset: 'custom', customAmount: 2, customUnit: 'day' }), 2880);
check('custom floors at 1', snoozeMinutes({ preset: 'custom', customAmount: 0, customUnit: 'hour' }), 60);
check('describe custom days', describeSnooze({ preset: 'custom', customAmount: 2, customUnit: 'day' }), '2 din baad');
check('describe preset', describeSnooze({ preset: '6h' }), '6 ghante baad');

console.log('\n-- labels --');
check('describe daily', describeRecurrence({ preset: 'daily' }), 'Roz');
check('describe monthly w/ day', describeRecurrence({ preset: 'monthly', weekday: 3 }), 'Har 4 hafte, Budh');
check('describe alternate Sunday', describeRecurrence({ preset: 'alternateSunday' }), 'Ek Ravivar chhod kar');
check('describe custom weeks', describeRecurrence({ preset: 'custom', custom: { unit: 'week', interval: 2, daysOfWeek: [1, 4] } }), 'Har 2 hafte, Som, Guru');
check('describe custom dates', describeRecurrence({ preset: 'custom', custom: { unit: 'month', interval: 1, datesOfMonth: [5, 20] } }), 'Har mahine, tareekh 5, 20');

console.log(failures === 0 ? `\nALL PASS` : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
