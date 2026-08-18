export function formatKyat(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} Ks`;
}
