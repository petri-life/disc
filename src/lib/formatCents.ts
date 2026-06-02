// Balances and costs come from the API in whole cents (integers). Show small
// amounts as "4¢" and dollar-plus amounts as "$1.20".
export function formatCents(cents: number): string {
  if (cents < 100) return `${cents}¢`
  return `$${(cents / 100).toFixed(2)}`
}
