export function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString("en-CA", { style: "currency", currency });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatPnl(value: number, currency: string): string {
  const prefix = value >= 0 ? "+" : "";
  return prefix + formatCurrency(value, currency);
}
