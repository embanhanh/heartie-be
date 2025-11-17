import { ValueTransformer } from 'typeorm';

function parseVector(value: unknown): number[] | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => (item === null || item === undefined ? 0 : Number(item)));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length <= 2) {
      return [];
    }

    let withoutBrackets = trimmed;
    if (withoutBrackets.startsWith('[') || withoutBrackets.startsWith('(')) {
      withoutBrackets = withoutBrackets.slice(1);
    }
    if (withoutBrackets.endsWith(']') || withoutBrackets.endsWith(')')) {
      withoutBrackets = withoutBrackets.slice(0, -1);
    }
    withoutBrackets = withoutBrackets.trim();
    if (!withoutBrackets) {
      return [];
    }

    return withoutBrackets
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => Number(item));
  }

  return null;
}

export const VectorTransformer: ValueTransformer = {
  to(value: number[] | null | undefined): string | null {
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }

    try {
      return formatVectorLiteral(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to serialize vector: ${message}`);
    }
  },
  from(value: unknown): number[] | null {
    return parseVector(value);
  },
};

export function formatVectorLiteral(values: Array<number | string>): string {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Vector literal requires at least one numeric value');
  }

  const sanitized = values.map((value, index) => {
    const numeric = typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(numeric)) {
      throw new Error(`Invalid vector component at position ${index}`);
    }

    return numeric;
  });

  const literal = `[${sanitized.join(',')}]`;

  if (!/^\[[0-9eE+\-., ]+\]$/.test(literal)) {
    throw new Error('Vector literal contains unsupported characters');
  }

  return literal;
}
