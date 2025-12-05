import { NormalizeArray, NormalizeArrayOptions } from './normalize-array.decorator';

export type NormalizeEnumArrayOptions<T extends string> = NormalizeArrayOptions<T> & {
  acceptedValues: readonly T[];
  case?: 'upper' | 'lower' | 'none';
};

const applyCase = (value: string, mode: 'upper' | 'lower' | 'none' = 'none'): string => {
  if (mode === 'upper') {
    return value.toUpperCase();
  }

  if (mode === 'lower') {
    return value.toLowerCase();
  }

  return value;
};

export const NormalizeEnumArray = <T extends string>(options: NormalizeEnumArrayOptions<T>) =>
  NormalizeArray<T>({
    ...options,
    mapValue: (input) => {
      const normalized = applyCase(input, options.case);
      const match = options.acceptedValues.find(
        (value) => applyCase(value, options.case) === normalized,
      );
      return match ?? (normalized as T);
    },
  });
