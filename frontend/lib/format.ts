export function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString("en-CA", { style: "currency", currency });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
