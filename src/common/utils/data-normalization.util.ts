export type NormalizedPostFormat = 'short' | 'medium' | 'long';

export const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed;
};

export const normalizeStringArray = (value: unknown, limit = 10): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item));

  const unique = Array.from(new Set(normalized));
  return unique.slice(0, Math.max(1, limit));
};

export const normalizeLanguageInput = (value: unknown, fallback: string): string => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return fallback;
  }

  return normalized.toLowerCase();
};

export const normalizeFormat = (value: unknown): NormalizedPostFormat | null => {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  switch (normalized.toLowerCase()) {
    case 'short':
    case 'short_form':
    case 'short-form':
      return 'short';
    case 'long':
    case 'long_form':
    case 'long-form':
      return 'long';
    case 'medium':
    case 'mid':
      return 'medium';
    default:
      return null;
  }
};

export const parsePositiveInt = (
  value: unknown,
  fallback: number | undefined,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number | undefined => {
  if (value === undefined || value === null) {
    return fallback;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }

  const clamped = Math.max(min, Math.min(max, Math.floor(num)));
  return clamped;
};

export const normalizeTimezoneOffset = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^Z$/i.test(trimmed)) {
    return 'Z';
  }

  const alias = trimmed.replace(/\s+/g, '').toLowerCase();
  switch (alias) {
    case 'asia/ho_chi_minh':
    case 'asia/hochiminh':
    case 'asia/saigon':
    case 'asia/bangkok':
      return '+07:00';
    default:
      break;
  }

  const match = trimmed.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const sign = match[1];
  const hours = match[2].padStart(2, '0');
  const minutes = (match[3] ?? '00').padStart(2, '0');

  return `${sign}${hours}:${minutes}`;
};

export const normalizeScheduleIso = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed.toISOString();
  }

  if (typeof value === 'object') {
    const map = value as Record<string, unknown>;
    const directKeys = ['iso', 'scheduledAt', 'datetime', 'dateTime'];

    for (const key of directKeys) {
      const candidate = map[key];
      if (typeof candidate === 'string') {
        const normalized = normalizeScheduleIso(candidate);
        if (normalized) {
          return normalized;
        }
      }
    }

    const date = normalizeString(map['date'] ?? map['day'] ?? map['publishDate']);
    if (!date) {
      return undefined;
    }

    const time =
      normalizeString(map['time'] ?? map['hour'] ?? map['window'] ?? map['publishTime']) ?? '09:00';

    const timezoneInput =
      normalizeString(map['timezone'] ?? map['tz'] ?? map['timeZone'] ?? map['offset']) ?? '+07:00';

    const timezone = normalizeTimezoneOffset(timezoneInput);
    if (!timezone) {
      return undefined;
    }

    const isoCandidate = `${date}T${time}${timezone}`;
    const parsed = new Date(isoCandidate);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed.toISOString();
  }

  return undefined;
};

export const subtractDays = (date: Date, days: number): Date => {
  const clone = new Date(date.getTime());
  clone.setDate(clone.getDate() - days);
  return clone;
};
