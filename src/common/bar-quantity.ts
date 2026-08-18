const SIZE_MULTIPLIERS: Record<string, number> = {
  '1/4': 0.25,
  '1/2': 0.5,
  '3/4': 0.75,
  '1': 1,
  '2': 2,
  '3': 3,
};

export function barSizeMultiplier(size?: string | number) {
  return SIZE_MULTIPLIERS[String(size || '1')] || 1;
}

export function barQuantity(item: { size?: string | number; quantity?: string | number }) {
  return Number(item.quantity || 0) * barSizeMultiplier(item.size);
}

export function totalBarQuantity(items: Array<{ size?: string | number; quantity?: string | number }>) {
  return items.reduce((sum, item) => sum + barQuantity(item), 0);
}
