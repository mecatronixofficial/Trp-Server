const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function indiaDayStart(value: string | Date) {
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    return new Date(`${value}T00:00:00.000+05:30`);
  }
  return new Date(value);
}

export function indiaDayEnd(value: string | Date) {
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    return new Date(`${value}T23:59:59.999+05:30`);
  }
  return new Date(value);
}
