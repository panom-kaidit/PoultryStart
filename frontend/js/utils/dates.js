// Uganda (UTC+3) date helpers.
const UGANDA_UTC_OFFSET_HOURS = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ugandaToday(now = new Date()) {
  return new Date(now.getTime() + UGANDA_UTC_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? ''));
  if (!match) return String(isoDate ?? '');
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function formatUtcAsUgandaDateTime(utcTimestamp) {
  if (!utcTimestamp) return '';
  const time = Date.parse(`${String(utcTimestamp).replace(' ', 'T')}Z`);
  if (Number.isNaN(time)) return String(utcTimestamp);
  const uganda = new Date(time + UGANDA_UTC_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
  return `${formatDate(uganda.slice(0, 10))}, ${uganda.slice(11, 16)}`;
}

export function formatUtcAsUgandaDate(utcTimestamp) {
  if (!utcTimestamp) return '';
  const time = Date.parse(`${String(utcTimestamp).replace(' ', 'T')}Z`);
  if (Number.isNaN(time)) return String(utcTimestamp);
  return formatDate(ugandaToday(new Date(time)));
}
