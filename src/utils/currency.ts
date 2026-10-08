/** The figure alone ("12,500"), for layouts that set the unit in its own type. */
export function formatKyatNumber(amount: number): string {
  return Math.round(amount).toLocaleString("en-US");
}

export function formatKyat(amount: number): string {
  return `${formatKyatNumber(amount)} Ks`;
}
