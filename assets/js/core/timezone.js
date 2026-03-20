// js/core/timezone.js

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function resolveTimezone(campaignTimezone, unitTimezone, tenantTimezone) {
  return campaignTimezone || unitTimezone || tenantTimezone || DEFAULT_TIMEZONE;
}

export function getNowInTimezone(timezone = DEFAULT_TIMEZONE) {
  const now = new Date();

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
}

export function getLocalDateForTimezone(timezone = DEFAULT_TIMEZONE) {
  const now = new Date();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function formatDateTimeInTimezone(dateValue, timezone = DEFAULT_TIMEZONE, locale = 'pt-BR') {
  if (!dateValue) return '';

  const date = new Date(dateValue);

  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function isValidIanaTimezone(timezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
