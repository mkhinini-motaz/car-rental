// Money is stored in millimes (TND × 1000); price fields are typed in dinars.

export const priceInputFromMillimes = (millimes: number) => String(millimes / 1000);

// '90', '87.5' or '87,5' → millimes; null for empty, zero, negative or not a number.
export function millimesFromInput(input: string): number | null {
  const dinars = Number(input.trim().replace(',', '.'));
  return input.trim() && Number.isFinite(dinars) && dinars > 0 ? Math.round(dinars * 1000) : null;
}

// A broker's commission as typed: dinars ('20'), or a share of the rental's total ('10%').
// 0 when empty; null when it can't be read.
export function commissionFromInput(input: string, total: number): number | null {
  const typed = input.trim();
  if (! typed) {
    return 0;
  }
  if (typed.endsWith('%')) {
    const percent = Number(typed.slice(0, -1).trim().replace(',', '.'));
    return Number.isFinite(percent) && percent > 0 && percent <= 100 ? Math.round(total * percent / 100) : null;
  }
  return millimesFromInput(typed);
}
