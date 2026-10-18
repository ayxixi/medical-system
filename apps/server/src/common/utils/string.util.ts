export function trimString(value: string): string;
export function trimString<T>(value: T): T;
export function trimString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export function trimOptionalString(value: string): string | undefined;
export function trimOptionalString<T>(value: T): T;
export function trimOptionalString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}
