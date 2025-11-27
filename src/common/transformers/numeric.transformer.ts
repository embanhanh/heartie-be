export const NumericTransformer = {
  to(value?: number | null): number | null | undefined {
    return value;
  },
  from(value: string | null): number | null {
    return value === null ? null : Number(value);
  },
};
