import { Transform } from 'class-transformer';

export type NormalizeArrayOptions<T = string> = {
  mapValue?: (value: string) => T;
  splitBy?: string | RegExp;
  trim?: boolean;
  unique?: boolean;
  fallback?: T[];
};

const DEFAULT_SPLITTER = /\s*,\s*/;

const toScalarString = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  return '';
};

const toStringArray = (input: unknown, splitBy: string | RegExp): string[] => {
  if (input === undefined || input === null) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((value) => toScalarString(value).split(splitBy));
  }

  return toScalarString(input).split(splitBy);
};

export const NormalizeArray = <T = string>(options: NormalizeArrayOptions<T> = {}) => {
  const { mapValue, splitBy, trim, unique, fallback } = options;

  return Transform(({ value }) => {
    const values = toStringArray(value, splitBy ?? DEFAULT_SPLITTER)
      .map((item) => (trim === false ? item : item.trim()))
      .filter((item) => item.length > 0)
      .map((item) => (mapValue ? mapValue(item) : (item as unknown as T)));

    if (!values.length) {
      return fallback;
    }

    const result = unique ? Array.from(new Set(values)) : values;
    return result;
  });
};
