export function getCurrencySymbol(): string {
  if (typeof window === "undefined") return ""
  return (localStorage.getItem("pos_currency_symbol") || localStorage.getItem("pos_currency_code") || "")
}

export function formatMoney(value: number | string | undefined | null, symbol?: string) {
  const num = typeof value === "number" ? value : Number(value || 0)
  const safe = Number.isFinite(num) ? num : 0
  const sym = symbol ?? getCurrencySymbol()
  return `${sym} ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(safe)}`
}

export default formatMoney
