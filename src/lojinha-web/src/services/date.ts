export function getTodayDateInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function toUtcDateOnlyIso(value: string) {
  return `${value}T12:00:00Z`;
}

export function formatUtcDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function getUtcDateParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

export function formatUtcDateRange(start: string | Date, end: string | Date) {
  const startText = formatUtcDate(start);
  const endText = formatUtcDate(end);
  return startText === endText ? startText : `${startText} a ${endText}`;
}

export function isUtcDateTodayOrPast(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const valueUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return valueUtc <= todayUtc;
}