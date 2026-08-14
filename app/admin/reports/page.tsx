 
"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Download,
  DollarSign,
  FileSpreadsheet,
  History,
  Package,
  Printer,
  RotateCcw,
  ShoppingCart,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Truck,
  Users,
  UserPlus,
  Wallet,
} from "lucide-react"
import { backendRequest } from "@/app/services/backend"
import formatMoney from "@/lib/formatMoney"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TabKey = "overview" | "sales" | "stock" | "finance" | "clients" | "personnel"

interface BackendEnvelope<T> {
  status?: string
  message?: string
  data?: T
}

interface BackendLineSale {
  id?: number
  id_produit?: number | string
  quantite?: number | string
  prix_vente?: number | string
  produit?: Record<string, any> | null
  devise?: Record<string, any> | null
}

interface BackendSale {
  id: number
  code?: string | null
  date?: string | null
  created_at?: string | null
  id_vendeur?: number | null
  vendeur?: Record<string, any> | null
  id_client?: number | null
  client?: Record<string, any> | null
  lignes?: BackendLineSale[] | null
}

interface BackendProduct {
  id: number
  code?: string | null
  nom?: string | null
  categorie?: Record<string, any> | null
  unite?: Record<string, any> | null
  photo?: string | null
  marque?: string | null
  brand?: string | null
}

interface BackendClient {
  id: number
  nom?: string | null
  post_nom?: string | null
  prenom?: string | null
  contact?: string | null
  created_at?: string | null
  updated_at?: string | null
  ventes_count?: number | null
}

interface BackendSeller {
  id: number
  nom?: string | null
  post_nom?: string | null
  prenom?: string | null
  code?: string | null
  created_at?: string | null
}

interface BackendCategory {
  id: number
  nom?: string | null
}

interface BackendStockRow {
  id: number
  nom?: string | null
  code?: string | null
  stock_actuel?: number | string | null
}

interface BackendLot {
  id: number
  id_produit?: number | string | null
  numero_lot?: string | null
  quantite_initial?: number | string | null
  date_reception?: string | null
  date_expiration?: string | null
  produit?: Record<string, any> | null
  approvisionnement?: Record<string, any> | null
  ligneApprovisionnement?: Record<string, any> | null
  devise?: Record<string, any> | null
}

interface BackendApprovisionnement {
  id: number
  code?: string | null
  date?: string | null
  fournisseur?: Record<string, any> | null
  user?: Record<string, any> | null
  lignes?: Array<Record<string, any>> | null
}

interface BackendCashTransaction {
  id: number
  type?: string | null
  montant?: number | string | null
  reference_type?: string | null
  reference_id?: number | string | null
  description?: string | null
  solde_avant?: number | string | null
  solde_apres?: number | string | null
  created_at?: string | null
  caisse?: Record<string, any> | null
  creator?: Record<string, any> | null
}

interface BackendCaisse {
  id: number
  solde?: number | string | null
  devise?: Record<string, any> | null
}

interface ReportsState {
  sales: BackendSale[]
  products: BackendProduct[]
  clients: BackendClient[]
  sellers: BackendSeller[]
  categories: BackendCategory[]
  stocks: BackendStockRow[]
  lots: BackendLot[]
  approvisionnements: BackendApprovisionnement[]
  cashTransactions: BackendCashTransaction[]
  caisses: BackendCaisse[]
}

const EMPTY_STATE: ReportsState = {
  sales: [],
  products: [],
  clients: [],
  sellers: [],
  categories: [],
  stocks: [],
  lots: [],
  approvisionnements: [],
  cashTransactions: [],
  caisses: [],
}

const DAY_MS = 24 * 60 * 60 * 1000

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>

    if (Array.isArray(record.data)) {
      return record.data as T[]
    }

    if (record.data && typeof record.data === "object" && Array.isArray((record.data as Record<string, unknown>).data)) {
      return ((record.data as Record<string, unknown>).data as T[])
    }
  }

  return []
}

function getRelation(source: Record<string, any> | null | undefined, relationName: string) {
  if (!source) {
    return null
  }

  return source[relationName] ?? source[relationName.replace(/([A-Z])/g, "_$1").toLowerCase()] ?? null
}

function formatDateInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function parseDate(value?: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}



function formatPercent(value: number) {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.0%"
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
}

function getFullName(person?: Record<string, any> | null) {
  if (!person) {
    return "Inconnu"
  }

  const parts = [person.nom, person.post_nom, person.prenom].filter((part) => typeof part === "string" && part.trim() !== "")
  return parts.length > 0 ? parts.join(" ") : person.code || person.email || "Inconnu"
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n")
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

function getRangeDays(startDate: Date, endDate: Date) {
  return Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / DAY_MS) + 1)
}

function isWithinRange(date: Date | null, startDate: Date, endDate: Date) {
  if (!date) {
    return false
  }

  const time = date.getTime()
  return time >= startDate.getTime() && time <= endDate.getTime()
}

function buildPreviousRange(startDate: Date, endDate: Date) {
  const days = getRangeDays(startDate, endDate)
  const previousEnd = new Date(startDate)
  previousEnd.setDate(previousEnd.getDate() - 1)
  const previousStart = new Date(previousEnd)
  previousStart.setDate(previousStart.getDate() - days + 1)
  previousStart.setHours(0, 0, 0, 0)
  previousEnd.setHours(23, 59, 59, 999)
  return { previousStart, previousEnd }
}

function calculateGrowth(currentValue: number, previousValue: number) {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : 100
  }

  return ((currentValue - previousValue) / previousValue) * 100
}

function startOfWeek(date: Date) {
  const value = new Date(date)
  const day = value.getDay() === 0 ? 7 : value.getDay()
  value.setDate(value.getDate() - day + 1)
  value.setHours(0, 0, 0, 0)
  return value
}

function aggregateSalesByGranularity(sales: BackendSale[], granularity: "day" | "week" | "month" | "year") {
  const grouped = new Map<string, { label: string; revenue: number; transactions: number; quantity: number }>()

  sales.forEach((sale) => {
    const saleDate = parseDate(sale.date ?? sale.created_at)
    if (!saleDate) {
      return
    }

    let key = saleDate.toISOString().slice(0, 10)
    let label = format(saleDate, "dd/MM/yyyy")

    if (granularity === "week") {
      const weekStart = startOfWeek(saleDate)
      key = weekStart.toISOString().slice(0, 10)
      label = `Semaine du ${format(weekStart, "dd/MM/yyyy")}`
    } else if (granularity === "month") {
      key = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, "0")}`
      label = format(saleDate, "MM/yyyy")
    } else if (granularity === "year") {
      key = `${saleDate.getFullYear()}`
      label = key
    }

    const saleTotal = (sale.lignes ?? []).reduce((sum, line) => sum + toNumber(line.quantite) * toNumber(line.prix_vente), 0)
    const quantity = (sale.lignes ?? []).reduce((sum, line) => sum + toNumber(line.quantite), 0)
    const current = grouped.get(key) ?? { label, revenue: 0, transactions: 0, quantity: 0 }
    current.label = label
    current.revenue += saleTotal
    current.transactions += 1
    current.quantity += quantity
    grouped.set(key, current)
  })

  return Array.from(grouped.entries())
    .map(([key, value]) => ({ key, ...value, averageBasket: value.transactions > 0 ? value.revenue / value.transactions : 0 }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

function getProductLabel(product?: Record<string, any> | null) {
  if (!product) {
    return "Produit"
  }

  return product.nom || product.name || product.code || "Produit"
}

function getCategoryLabel(product?: Record<string, any> | null) {
  const category = getRelation(product, "categorie") ?? product?.categorie ?? product?.category
  return category?.nom || category?.name || product?.categorie_nom || "Non catégorisé"
}

function getBrandLabel(product?: Record<string, any> | null) {
  return product?.marque || product?.brand || product?.brand_name || "Non renseignée"
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "bg-slate-900",
}: {
  title: string
  value: string
  subtitle?: string
  icon: typeof DollarSign
  tone?: string
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className={`rounded-xl p-3 text-white ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ShopReportsPage() {
  const [rangePreset, setRangePreset] = useState<"7d" | "30d" | "90d" | "custom">("30d")
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    date.setHours(0, 0, 0, 0)
    return date
  })
  const [endDate, setEndDate] = useState(() => {
    const date = new Date()
    date.setHours(23, 59, 59, 999)
    return date
  })
  const [selectedTab, setSelectedTab] = useState<TabKey>("overview")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ReportsState>(EMPTY_STATE)
  const [devises, setDevises] = useState<Array<{ id: number; code?: string; symbole?: string }>>([])
  const [selectedCurrency, setSelectedCurrency] = useState<string>("")

  useEffect(() => {
    let cancelled = false

    const fetchRows = async <T,>(path: string) => {
      try {
        const response = await backendRequest<BackendEnvelope<unknown>>(path)
        return normalizeRows<T>(response)
      } catch {
        return [] as T[]
      }
    }

    const loadReports = async () => {
      setLoading(true)
      setError(null)

      try {
        const [sales, products, clients, sellers, categories, stocks, lots, approvisionnements, cashTransactions, caisses, devises] = await Promise.all([
          fetchRows<BackendSale>("/ventes?per_page=all"),
          fetchRows<BackendProduct>("/produits?per_page=all"),
          fetchRows<BackendClient>("/clients?per_page=all"),
          fetchRows<BackendSeller>("/vendeurs?per_page=all"),
          fetchRows<BackendCategory>("/categories?per_page=all"),
          fetchRows<BackendStockRow>("/stocks/disponible"),
          fetchRows<BackendLot>("/lots?per_page=all"),
          fetchRows<BackendApprovisionnement>("/approvisionnements?per_page=all"),
          fetchRows<BackendCashTransaction>("/transactions-caisses?per_page=all"),
          fetchRows<BackendCaisse>("/caisses?per_page=all"),
          fetchRows<any>("/devises?per_page=all"),
        ])

        if (cancelled) {
          return
        }

        setData({
          sales,
          products,
          clients,
          sellers,
          categories,
          stocks,
          lots,
          approvisionnements,
          cashTransactions,
          caisses,
        })
        setDevises((devises ?? []) as Array<{ id: number; code?: string; symbole?: string }>)
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Impossible de charger les rapports")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadReports()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredSales = useMemo(
    () => data.sales.filter((sale) => isWithinRange(parseDate(sale.date ?? sale.created_at), startDate, endDate)),
    [data.sales, startDate, endDate],
  )

  const { previousStart, previousEnd } = useMemo(() => buildPreviousRange(startDate, endDate), [startDate, endDate])
  const previousSales = useMemo(
    () => data.sales.filter((sale) => isWithinRange(parseDate(sale.date ?? sale.created_at), previousStart, previousEnd)),
    [data.sales, previousStart, previousEnd],
  )

  const productIndex = useMemo(() => {
    const map = new Map<number, BackendProduct>()
    data.products.forEach((product) => {
      map.set(Number(product.id), product)
    })
    return map
  }, [data.products])

  const sellerIndex = useMemo(() => {
    const map = new Map<number, BackendSeller>()
    data.sellers.forEach((seller) => {
      map.set(Number(seller.id), seller)
    })
    return map
  }, [data.sellers])

  const categoryIndex = useMemo(() => {
    const map = new Map<number, BackendCategory>()
    data.categories.forEach((category) => {
      map.set(Number(category.id), category)
    })
    return map
  }, [data.categories])

  const saleRows = useMemo(() => {
    return filteredSales
      .map((sale) => {
        const saleDate = parseDate(sale.date ?? sale.created_at)
        const lines = sale.lignes ?? []
        const revenue = lines.reduce((sum, line) => sum + toNumber(line.quantite) * toNumber(line.prix_vente), 0)
        const quantity = lines.reduce((sum, line) => sum + toNumber(line.quantite), 0)
        const seller = sale.vendeur ?? (sale.id_vendeur ? sellerIndex.get(Number(sale.id_vendeur)) ?? null : null)
        const client = sale.client
        const paymentMethod = (sale as Record<string, any>).mode_paiement ?? (sale as Record<string, any>).payment_method ?? null

        return {
          ...sale,
          saleDate,
          revenue,
          quantity,
          seller,
          client,
          paymentMethod,
        }
      })
      .sort((a, b) => (b.saleDate?.getTime() ?? 0) - (a.saleDate?.getTime() ?? 0))
  }, [filteredSales, sellerIndex])

  const previousSaleRows = useMemo(() => {
    return previousSales
      .map((sale) => {
        const saleDate = parseDate(sale.date ?? sale.created_at)
        const lines = sale.lignes ?? []
        const revenue = lines.reduce((sum, line) => sum + toNumber(line.quantite) * toNumber(line.prix_vente), 0)
        const quantity = lines.reduce((sum, line) => sum + toNumber(line.quantite), 0)
        const seller = sale.vendeur ?? (sale.id_vendeur ? sellerIndex.get(Number(sale.id_vendeur)) ?? null : null)
        return {
          ...sale,
          saleDate,
          revenue,
          quantity,
          seller,
        }
      })
      .sort((a, b) => (b.saleDate?.getTime() ?? 0) - (a.saleDate?.getTime() ?? 0))
  }, [previousSales, sellerIndex])

  const productSales = useMemo(() => {
    const grouped = new Map<
      number,
      {
        product: BackendProduct | null
        category: string
        brand: string
        quantity: number
        revenue: number
        transactions: number
      }
    >()

    saleRows.forEach((sale) => {
      sale.lignes?.forEach((line) => {
        const productId = Number(line.id_produit)
        const product = line.produit ? (line.produit as BackendProduct) : productIndex.get(productId) ?? null
        const existing = grouped.get(productId) ?? {
          product,
          category: getCategoryLabel(product),
          brand: getBrandLabel(product),
          quantity: 0,
          revenue: 0,
          transactions: 0,
        }

        existing.product = product
        existing.quantity += toNumber(line.quantite)
        existing.revenue += toNumber(line.quantite) * toNumber(line.prix_vente)
        existing.transactions += 1
        grouped.set(productId, existing)
      })
    })

    return Array.from(grouped.entries())
      .map(([productId, entry]) => ({
        productId,
        name: getProductLabel(entry.product),
        sku: entry.product?.code || `PRD-${String(productId).padStart(4, "0")}`,
        category: entry.category,
        brand: entry.brand,
        quantity: entry.quantity,
        revenue: entry.revenue,
        turnoverRate: entry.quantity > 0 ? (entry.revenue / entry.quantity).toFixed(2) : "0.00",
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [saleRows, productIndex])

  const topProducts = useMemo(() => productSales.slice(0, 5), [productSales])
  const flopProducts = useMemo(() => [...productSales].sort((a, b) => a.revenue - b.revenue).slice(0, 5), [productSales])

  const categorySales = useMemo(() => {
    const grouped = new Map<string, { category: string; revenue: number; quantity: number; products: number }>()

    productSales.forEach((item) => {
      const existing = grouped.get(item.category) ?? { category: item.category, revenue: 0, quantity: 0, products: 0 }
      existing.revenue += item.revenue
      existing.quantity += item.quantity
      existing.products += 1
      grouped.set(item.category, existing)
    })

    return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue)
  }, [productSales])

  const brandSales = useMemo(() => {
    const grouped = new Map<string, { brand: string; revenue: number; quantity: number; products: number }>()

    productSales.forEach((item) => {
      const existing = grouped.get(item.brand) ?? { brand: item.brand, revenue: 0, quantity: 0, products: 0 }
      existing.revenue += item.revenue
      existing.quantity += item.quantity
      existing.products += 1
      grouped.set(item.brand, existing)
    })

    return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue)
  }, [productSales])

  const salesBySeller = useMemo(() => {
    const grouped = new Map<number, { seller: BackendSeller | null; revenue: number; transactions: number; quantity: number }>()

    saleRows.forEach((sale) => {
      const sellerId = Number(sale.id_vendeur ?? sale.seller?.id ?? 0)
      if (!sellerId) {
        return
      }

      const existing = grouped.get(sellerId) ?? {
        seller: sale.seller ? (sale.seller as BackendSeller) : sellerIndex.get(sellerId) ?? null,
        revenue: 0,
        transactions: 0,
        quantity: 0,
      }

      existing.revenue += sale.revenue
      existing.transactions += 1
      existing.quantity += sale.quantity
      grouped.set(sellerId, existing)
    })

    return Array.from(grouped.entries())
      .map(([sellerId, entry]) => ({
        sellerId,
        name: getFullName(entry.seller),
        code: entry.seller?.code || `V-${String(sellerId).padStart(3, "0")}`,
        revenue: entry.revenue,
        transactions: entry.transactions,
        quantity: entry.quantity,
        averageBasket: entry.transactions > 0 ? entry.revenue / entry.transactions : 0,
        estimatedHours: Math.max(4, entry.transactions * 0.25),
        objective: Math.max(10000, Math.round((entry.revenue || 10000) * 1.1)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [saleRows, sellerIndex])

  const salesByClient = useMemo(() => {
    const grouped = new Map<number, { client: BackendClient | null; revenue: number; transactions: number; quantity: number; firstPurchase: Date | null; lastPurchase: Date | null }>()

    saleRows.forEach((sale) => {
      const clientId = Number(sale.id_client ?? sale.client?.id ?? 0)
      if (!clientId) {
        return
      }

      const currentDate = sale.saleDate
      const existing = grouped.get(clientId) ?? {
        client: sale.client ? (sale.client as BackendClient) : data.clients.find((client) => Number(client.id) === clientId) ?? null,
        revenue: 0,
        transactions: 0,
        quantity: 0,
        firstPurchase: currentDate,
        lastPurchase: currentDate,
      }

      existing.revenue += sale.revenue
      existing.transactions += 1
      existing.quantity += sale.quantity

      if (currentDate) {
        if (!existing.firstPurchase || currentDate.getTime() < existing.firstPurchase.getTime()) {
          existing.firstPurchase = currentDate
        }

        if (!existing.lastPurchase || currentDate.getTime() > existing.lastPurchase.getTime()) {
          existing.lastPurchase = currentDate
        }
      }

      grouped.set(clientId, existing)
    })

    return Array.from(grouped.entries())
      .map(([clientId, entry]) => {
        const lifetime = (entry.firstPurchase && entry.lastPurchase) ? Math.max(1, Math.ceil((entry.lastPurchase.getTime() - entry.firstPurchase.getTime()) / DAY_MS)) : 1
        const purchaseFrequency = entry.transactions / Math.max(1, lifetime / 30)
        const loyal = entry.transactions >= 3 || entry.revenue >= 5000
        const newCustomer = entry.firstPurchase ? (Date.now() - entry.firstPurchase.getTime()) / DAY_MS <= 30 : false

        return {
          clientId,
          name: getFullName(entry.client),
          contact: entry.client?.contact || "-",
          revenue: entry.revenue,
          transactions: entry.transactions,
          quantity: entry.quantity,
          averageBasket: entry.transactions > 0 ? entry.revenue / entry.transactions : 0,
          firstPurchase: entry.firstPurchase,
          lastPurchase: entry.lastPurchase,
          loyal,
          newCustomer,
          purchaseFrequency,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
  }, [saleRows, data.clients])

  const loyalCustomers = useMemo(() => salesByClient.filter((client) => client.loyal), [salesByClient])
  const newCustomers = useMemo(() => salesByClient.filter((client) => client.newCustomer), [salesByClient])
  const regularCustomers = useMemo(() => salesByClient.filter((client) => !client.newCustomer && client.transactions > 1), [salesByClient])

  const customerSegments = useMemo(() => {
    const rows = [
      { segment: "Nouveaux", customers: newCustomers, color: "bg-blue-500" },
      { segment: "Réguliers", customers: regularCustomers, color: "bg-amber-500" },
      { segment: "Fidèles", customers: loyalCustomers, color: "bg-emerald-500" },
    ]

    return rows.map((row) => ({
      segment: row.segment,
      count: row.customers.length,
      averageBasket: row.customers.length > 0 ? row.customers.reduce((sum, customer) => sum + customer.averageBasket, 0) / row.customers.length : 0,
      totalRevenue: row.customers.reduce((sum, customer) => sum + customer.revenue, 0),
      color: row.color,
    }))
  }, [newCustomers, regularCustomers, loyalCustomers])

  const inventoryRows = useMemo(() => {
    const stockByProductId = new Map<number, BackendStockRow>()
    data.stocks.forEach((row) => {
      stockByProductId.set(Number(row.id), row)
    })

    const lotsByProductId = new Map<number, BackendLot[]>()
    data.lots.forEach((lot) => {
      const productId = Number(lot.id_produit ?? getRelation(lot, "produit")?.id ?? 0)
      if (!productId) {
        return
      }

      if (!lotsByProductId.has(productId)) {
        lotsByProductId.set(productId, [])
      }
      lotsByProductId.get(productId)?.push(lot)
    })

    return data.products
      .map((product, index) => {
        const productId = Number(product.id)
        const stockRow = stockByProductId.get(productId)
        const productLots = [...(lotsByProductId.get(productId) ?? [])].sort((a, b) => (parseDate(b.date_reception)?.getTime() ?? 0) - (parseDate(a.date_reception)?.getTime() ?? 0))
        const theoreticalStock = productLots.reduce((sum, lot) => sum + toNumber(lot.quantite_initial), 0)
        const actualStock = stockRow ? toNumber(stockRow.stock_actuel) : theoreticalStock
        const variance = actualStock - theoreticalStock
        const recentLot = productLots[0]
        const latestLotDate = parseDate(recentLot?.date_reception)

        let purchaseCost = 0
        let purchaseQuantity = 0

        productLots.forEach((lot) => {
          const lineCost = toNumber(getRelation(lot, "ligneApprovisionnement")?.prix_unitaire)
          const quantity = toNumber(lot.quantite_initial)
          purchaseCost += quantity * lineCost
          purchaseQuantity += quantity
        })

        const avgCost = purchaseQuantity > 0 ? purchaseCost / purchaseQuantity : 0
        const revenueEstimate = productSales.find((row) => Number(row.productId) === productId)?.revenue ?? 0
        const quantitySold = productSales.find((row) => Number(row.productId) === productId)?.quantity ?? 0
        const turnoverRate = theoreticalStock > 0 ? quantitySold / theoreticalStock : quantitySold
        const minStock = Math.max(5, Math.round(theoreticalStock * 0.15) || 5)
        const reorderPoint = Math.max(minStock, Math.round(theoreticalStock * 0.2) || 10)
        const stockValue = actualStock * avgCost
        const daysSinceLastMovement = latestLotDate ? Math.floor((Date.now() - latestLotDate.getTime()) / DAY_MS) : null

        return {
          productId,
          sku: product.code || `SKU-${String(index + 1).padStart(4, "0")}`,
          name: getProductLabel(product),
          category: getCategoryLabel(product),
          brand: getBrandLabel(product),
          actualStock,
          theoreticalStock,
          variance,
          avgCost,
          stockValue,
          revenueEstimate,
          quantitySold,
          turnoverRate,
          minStock,
          reorderPoint,
          daysSinceLastMovement,
          lastRestock: latestLotDate,
          supplier: getRelation(recentLot, "approvisionnement")?.fournisseur?.nom || "-",
          unitLabel: getRelation(product, "unite")?.symbole || getRelation(product, "unite")?.nom || "",
          categoryId: Number(getRelation(product, "categorie")?.id ?? 0),
        }
      })
      .sort((a, b) => b.stockValue - a.stockValue)
  }, [data.products, data.stocks, data.lots, productSales])

  const outOfStockRows = useMemo(
    () => inventoryRows.filter((row) => row.actualStock <= 0).sort((a, b) => (b.daysSinceLastMovement ?? 0) - (a.daysSinceLastMovement ?? 0)),
    [inventoryRows],
  )

  const restockRows = useMemo(
    () => inventoryRows.filter((row) => row.actualStock <= row.reorderPoint).sort((a, b) => a.actualStock - b.actualStock),
    [inventoryRows],
  )

  const slowMovingRows = useMemo(
    () => inventoryRows.filter((row) => row.turnoverRate <= 0.2).sort((a, b) => a.turnoverRate - b.turnoverRate),
    [inventoryRows],
  )

  const stockMovementRows = useMemo(() => {
    return data.approvisionnements
      .map((entry) => {
        const date = parseDate(entry.date)
        const lines = entry.lignes ?? []
        const totalValue = lines.reduce((sum, line) => sum + toNumber(line.quantite) * toNumber(line.prix_unitaire), 0)
        const totalQuantity = lines.reduce((sum, line) => sum + toNumber(line.quantite), 0)

        return {
          id: entry.id,
          type: "entrée",
          date,
          reference: entry.code || `APP-${entry.id}`,
          supplier: entry.fournisseur?.nom || "-",
          quantity: totalQuantity,
          totalValue,
          actor: getFullName(entry.user),
        }
      })
      .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
  }, [data.approvisionnements])

  const cashSummary = useMemo(() => {
    const entries = data.cashTransactions.filter((transaction) => transaction.type === "entree")
    const exits = data.cashTransactions.filter((transaction) => transaction.type === "sortie")
    const totalEntries = entries.reduce((sum, transaction) => sum + toNumber(transaction.montant), 0)
    const totalExits = exits.reduce((sum, transaction) => sum + toNumber(transaction.montant), 0)
    const balance = totalEntries - totalExits

    const byType = Array.from(
      data.cashTransactions.reduce((map, transaction) => {
        const key = transaction.type || "inconnu"
        const current = map.get(key) ?? { label: key, amount: 0, count: 0 }
        current.amount += toNumber(transaction.montant)
        current.count += 1
        map.set(key, current)
        return map
      }, new Map<string, { label: string; amount: number; count: number }>()),
    ).sort((a, b) => b[1].amount - a[1].amount)

    return {
      totalEntries,
      totalExits,
      balance,
      byType: byType.map(([, value]) => value),
    }
  }, [data.cashTransactions])

  const caisseRows = useMemo(() => {
    return data.caisses.map((caisse) => ({
      id: caisse.id,
      balance: toNumber(caisse.solde),
      currency: caisse.devise?.symbole || caisse.devise?.code || caisse.devise?.nom || (typeof window !== "undefined" ? localStorage.getItem("pos_currency_symbol") || "" : ""),
      label: caisse.devise?.nom || caisse.devise?.code || "Caisse",
    }))
  }, [data.caisses])

  const currentRevenue = useMemo(() => saleRows.reduce((sum, sale) => sum + sale.revenue, 0), [saleRows])
  const currentTransactions = saleRows.length
  const currentQuantity = useMemo(() => saleRows.reduce((sum, sale) => sum + sale.quantity, 0), [saleRows])
  const currentAverageBasket = currentTransactions > 0 ? currentRevenue / currentTransactions : 0
  const previousRevenue = useMemo(() => previousSaleRows.reduce((sum, sale) => sum + sale.revenue, 0), [previousSaleRows])
  const previousTransactions = previousSaleRows.length
  const previousAverageBasket = previousTransactions > 0 ? previousRevenue / previousTransactions : 0
  const revenueGrowth = calculateGrowth(currentRevenue, previousRevenue)
  const transactionGrowth = calculateGrowth(currentTransactions, previousTransactions)
  const basketGrowth = calculateGrowth(currentAverageBasket, previousAverageBasket)

  const grossMargin = useMemo(() => {
    return saleRows.reduce((sum, sale) => {
      let productCost = 0

      sale.lignes?.forEach((line) => {
        const productId = Number(line.id_produit)
        const productLots = data.lots.filter((lot) => Number(lot.id_produit ?? getRelation(lot, "produit")?.id ?? 0) === productId)
        const quantityPurchased = productLots.reduce((acc, lot) => acc + toNumber(lot.quantite_initial), 0)
        const costSum = productLots.reduce((acc, lot) => acc + toNumber(lot.quantite_initial) * toNumber(getRelation(lot, "ligneApprovisionnement")?.prix_unitaire), 0)
        const avgCost = quantityPurchased > 0 ? costSum / quantityPurchased : 0
        productCost += toNumber(line.quantite) * avgCost
      })

      return sum + (sale.revenue - productCost)
    }, 0)
  }, [saleRows, data.lots])

  const stockValue = useMemo(() => inventoryRows.reduce((sum, row) => sum + row.stockValue, 0), [inventoryRows])
  const theoreticalStockValue = useMemo(() => inventoryRows.reduce((sum, row) => sum + row.theoreticalStock * row.avgCost, 0), [inventoryRows])
  const taxesCollected = 0
  const caHt = currentRevenue
  const caTtc = currentRevenue

  const periodSeries = useMemo(() => {
    const day = aggregateSalesByGranularity(saleRows, "day")
    const week = aggregateSalesByGranularity(saleRows, "week")
    const month = aggregateSalesByGranularity(saleRows, "month")
    const year = aggregateSalesByGranularity(saleRows, "year")
    return { day, week, month, year }
  }, [saleRows])

  const [profitByDay, setProfitByDay] = useState<Array<any>>([])
  const [profitByProduct, setProfitByProduct] = useState<Array<any>>([])

  useEffect(() => {
    let cancelled = false
    const fetchProfit = async () => {
      try {
        const s = format(startDate, 'yyyy-MM-dd')
        const e = format(endDate, 'yyyy-MM-dd')
        const target = selectedCurrency && selectedCurrency !== '__none__' ? `&devise_code=${encodeURIComponent(selectedCurrency)}` : ''
        const resp = await backendRequest<BackendEnvelope<unknown>>(`/rapports/benefice-periode?date_debut=${encodeURIComponent(s)}&date_fin=${encodeURIComponent(e)}${target}`)
        const p = normalizeRows<any>(resp)
        if (!cancelled) setProfitByDay(p)
      } catch (err) {
        // ignore
      }

      try {
        const s = format(startDate, 'yyyy-MM-dd')
        const e = format(endDate, 'yyyy-MM-dd')
        const target2 = selectedCurrency && selectedCurrency !== '__none__' ? `&devise_code=${encodeURIComponent(selectedCurrency)}` : ''
        const resp2 = await backendRequest<BackendEnvelope<unknown>>(`/rapports/benefice-produit?date_debut=${encodeURIComponent(s)}&date_fin=${encodeURIComponent(e)}&limit=50${target2}`)
        const p2 = normalizeRows<any>(resp2)
        if (!cancelled) setProfitByProduct(p2)
      } catch (err) {
        // ignore
      }
    }

    void fetchProfit()
    return () => { cancelled = true }
  }, [startDate, endDate, selectedCurrency])

  const periodComparisons = useMemo(() => {
    const currentWeek = aggregateSalesByGranularity(saleRows, "week").reduce((sum, item) => sum + item.revenue, 0)
    const previousWeek = aggregateSalesByGranularity(previousSaleRows, "week").reduce((sum, item) => sum + item.revenue, 0)
    const currentMonth = aggregateSalesByGranularity(saleRows, "month").reduce((sum, item) => sum + item.revenue, 0)
    const previousMonth = aggregateSalesByGranularity(previousSaleRows, "month").reduce((sum, item) => sum + item.revenue, 0)
    const currentYear = aggregateSalesByGranularity(saleRows, "year").reduce((sum, item) => sum + item.revenue, 0)
    const previousYear = aggregateSalesByGranularity(previousSaleRows, "year").reduce((sum, item) => sum + item.revenue, 0)

    return [
      { label: "Jour", current: currentRevenue, previous: previousRevenue, growth: revenueGrowth },
      { label: "Semaine", current: currentWeek, previous: previousWeek, growth: calculateGrowth(currentWeek, previousWeek) },
      { label: "Mois", current: currentMonth, previous: previousMonth, growth: calculateGrowth(currentMonth, previousMonth) },
      { label: "Année", current: currentYear, previous: previousYear, growth: calculateGrowth(currentYear, previousYear) },
    ]
  }, [saleRows, previousSaleRows, currentRevenue, previousRevenue, revenueGrowth])

  const handlePreset = (preset: "7d" | "30d" | "90d") => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date()
    start.setDate(end.getDate() - Number(preset.replace("d", "")))
    start.setHours(0, 0, 0, 0)
    setStartDate(start)
    setEndDate(end)
    setRangePreset(preset)
  }

  const handleExport = () => {
    const fileName = `rapports_${selectedTab}_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.csv`

    if (selectedTab === "sales") {
      downloadCsv(fileName, [
        ["Date", "Code", "Client", "Vendeur", "Quantité", "CA"],
        ...saleRows.map((sale) => [
          sale.saleDate ? format(sale.saleDate, "yyyy-MM-dd") : "",
          sale.code || sale.id,
          getFullName(sale.client),
          getFullName(sale.seller),
          sale.quantity,
          sale.revenue,
        ]),
      ])
      return
    }

    if (selectedTab === "stock") {
      downloadCsv(fileName, [
        ["SKU", "Produit", "Catégorie", "Stock réel", "Stock théorique", "Écart", "Valeur stock"],
        ...inventoryRows.map((row) => [row.sku, row.name, row.category, row.actualStock, row.theoreticalStock, row.variance, row.stockValue]),
      ])
      return
    }

    if (selectedTab === "finance") {
      downloadCsv(fileName, [
        ["Indicateur", "Valeur"],
        ["CA HT", caHt],
        ["CA TTC", caTtc],
        ["Marge brute", grossMargin],
        ["Taxes collectées", taxesCollected],
        ["Encaissements", cashSummary.totalEntries],
        ["Décaissements", cashSummary.totalExits],
        ["Solde net", cashSummary.balance],
      ])
      return
    }

    if (selectedTab === "clients") {
      downloadCsv(fileName, [
        ["Client", "Transactions", "CA", "Premier achat", "Dernier achat"],
        ...salesByClient.map((client) => [
          client.name,
          client.transactions,
          client.revenue,
          client.firstPurchase ? format(client.firstPurchase, "yyyy-MM-dd") : "",
          client.lastPurchase ? format(client.lastPurchase, "yyyy-MM-dd") : "",
        ]),
      ])
      return
    }

    if (selectedTab === "personnel") {
      downloadCsv(fileName, [
        ["Vendeur", "Transactions", "CA", "Panier moyen", "Heures estimées", "Objectif"],
        ...salesBySeller.map((seller) => [seller.name, seller.transactions, seller.revenue, seller.averageBasket, seller.estimatedHours, seller.objective]),
      ])
      return
    }

    downloadCsv(fileName, [
      ["Métrique", "Valeur"],
      ["CA", currentRevenue],
      ["Transactions", currentTransactions],
      ["Stock", stockValue],
      ["Clients fidèles", loyalCustomers.length],
    ])
  }

  const generatePrintableReport = async () => {
    const header = document.title || (typeof window !== 'undefined' ? window.location.hostname : 'Rapport')
    const period = `${format(startDate, 'yyyy-MM-dd')} → ${format(endDate, 'yyyy-MM-dd')}`

    // prefer selectedCurrency if not sentinel
    const currencyParam = selectedCurrency && selectedCurrency !== '__none__' ? `&devise_code=${encodeURIComponent(selectedCurrency)}` : ''

    // fetch full data from API (use backendRequest + normalizeRows)
    let ventas: any[] = []
    let profitDays: any[] = []
    let profitProds: any[] = []
    let stocks: any[] = []

    try {
      const s = format(startDate, 'yyyy-MM-dd')
      const e = format(endDate, 'yyyy-MM-dd')
      const [vRes, pdRes, ppRes, stRes] = await Promise.all([
        backendRequest(`/ventes?per_page=all&date_debut=${encodeURIComponent(s)}&date_fin=${encodeURIComponent(e)}`),
        backendRequest(`/rapports/benefice-periode?date_debut=${encodeURIComponent(s)}&date_fin=${encodeURIComponent(e)}${currencyParam}`),
        backendRequest(`/rapports/benefice-produit?date_debut=${encodeURIComponent(s)}&date_fin=${encodeURIComponent(e)}&limit=100${currencyParam}`),
        backendRequest(`/stocks/disponible`),
      ])

      ventas = normalizeRows<any>(vRes)
      profitDays = normalizeRows<any>(pdRes)
      profitProds = normalizeRows<any>(ppRes)
      stocks = normalizeRows<any>(stRes)
    } catch (err) {
      // fallback to client-side data if API calls fail
      ventas = saleRows
      profitDays = profitByDay
      profitProds = profitByProduct
      stocks = inventoryRows
    }

    const salesHtml = ventas.map((s) => {
      const date = s.date ? format(new Date(s.date), 'yyyy-MM-dd HH:mm') : (s.created_at ? format(new Date(s.created_at), 'yyyy-MM-dd HH:mm') : '')
      const client = getFullName(s.client)
      const seller = getFullName(s.vendeur ?? s.vendeur)
      const montant = s.montant_total ?? s.total ?? (s.montant ? s.montant : 0)
      return `<tr><td>${date}</td><td>${s.code ?? s.id}</td><td>${client}</td><td>${seller}</td><td style="text-align:right">${formatMoney(montant, s.deviseVente?.symbole ?? s.devise?.symbole ?? undefined)}</td></tr>`
    }).join('')

    const profitDayHtml = profitDays.map((r) => `<tr><td>${r.date_vente}</td><td style="text-align:right">${r.devise_code || ''}</td><td style="text-align:right">${formatMoney(Number(r.benefice_total || 0), r.devise_code || '')}</td></tr>`).join('')

    const profitProdHtml = profitProds.map((r) => `<tr><td>${r.produit_nom || r.produit_code || `#${r.id_produit}`}</td><td style="text-align:right">${(r.quantite_vendue ?? 0).toLocaleString('fr-FR')}</td><td style="text-align:right">${formatMoney(Number(r.chiffre_affaires ?? 0), r.devise_code)}</td><td style="text-align:right">${formatMoney(Number(r.benefice_total ?? 0), r.devise_code)}</td></tr>`).join('')

    const inventoryHtml = stocks.map((row) => {
      const sku = row.code || row.sku || ''
      const name = row.nom || row.name || ''
      const stockVal = row.stock_actuel ?? row.actualStock ?? 0
      const value = row.stockValue ?? row.valeur ?? 0
      return `<tr><td>${sku}</td><td>${name}</td><td style="text-align:right">${Number(stockVal).toLocaleString('fr-FR')}</td><td style="text-align:right">${formatMoney(value)}</td></tr>`
    }).join('')

    const css = `
      @page { size: A4 landscape; margin: 15mm }
      body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size:12px }
      header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px }
      header h1 { margin:0 }
      .meta { font-size:12px; color:#333 }
      table { width:100%; border-collapse: collapse; margin-bottom: 12px }
      th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px }
      th { background: #f6f6f6; text-align:left }
      thead { display: table-header-group }
      tfoot { display: table-footer-group }
      tr { page-break-inside: avoid }
      footer { position: fixed; bottom: 0; left: 0; right: 0; height: 28px; font-size:11px; text-align:center; color:#666 }
    `

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Rapport complet - ${period}</title>
          <style>${css}</style>
        </head>
        <body>
          <header>
            <h1>${header}</h1>
            <div class="meta"><strong>Période:</strong> ${period}</div>
          </header>

          <section>
            <h2>Ventes (${ventas.length})</h2>
            <table>
              <thead><tr><th>Date</th><th>Code</th><th>Client</th><th>Vendeur</th><th class="text-right">Montant</th></tr></thead>
              <tbody>${salesHtml}</tbody>
            </table>
          </section>

          <section>
            <h2>Bénéfice par jour</h2>
            <table>
              <thead><tr><th>Date</th><th>Devise</th><th class="text-right">Bénéfice</th></tr></thead>
              <tbody>${profitDayHtml}</tbody>
            </table>
          </section>

          <section>
            <h2>Bénéfice par produit</h2>
            <table>
              <thead><tr><th>Produit</th><th class="text-right">Quantité</th><th class="text-right">CA</th><th class="text-right">Bénéfice</th></tr></thead>
              <tbody>${profitProdHtml}</tbody>
            </table>
          </section>

          <section>
            <h2>Inventaire (valeur)</h2>
            <table>
              <thead><tr><th>SKU</th><th>Produit</th><th class="text-right">Stock</th><th class="text-right">Valeur</th></tr></thead>
              <tbody>${inventoryHtml}</tbody>
            </table>
          </section>

        </body>
      </html>
    `

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 300)
  }

  async function downloadReportPdf() {
    const mapping: Record<string, string | null> = {
      sales: '/api/rapports/ventes/pdf',
      stock: '/api/rapports/stock/pdf',
      finance: null,
      clients: null,
      personnel: null,
      overview: null,
    }

    const path = mapping[selectedTab]
    if (!path) {
      // fallback to printable HTML if no PDF endpoint
      generatePrintableReport()
      return
    }

    setLoading(true)
    try {
      const token = (typeof window !== 'undefined' && (localStorage.getItem('token') || localStorage.getItem('authToken'))) || ''
      const headers: Record<string, string> = { Accept: 'application/pdf' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(path, { method: 'GET', headers, credentials: 'include' })
      if (!res.ok) {
        // Try signed URL fallback
        try {
          const signedRes = await fetch(path.replace('/pdf', '/signed'), { method: 'POST', headers, credentials: 'include' })
          if (signedRes.ok) {
            const body = await signedRes.json()
            if (body?.url) {
              window.open(body.url, '_blank')
              return
            }
          }
        } catch (e) {
          // ignore and continue to throw below
        }
        throw new Error('Echec génération PDF')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_${selectedTab}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert('Erreur lors du téléchargement du PDF: ' + (err?.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  const exportablePaymentNote = "Les modes de paiement détaillés ne sont pas stockés dans la table ventes; ce bloc affiche donc les encaissements de caisse et non une répartition caisse/carte/mobile."
  const exportableHoursNote = "Les heures travaillées réelles ne sont pas exposées par l'API; elles sont estimées à partir du volume de ventes par vendeur."

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-800 to-slate-900 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-3 w-24 rounded bg-slate-200" />
                  <div className="h-8 w-2/3 rounded bg-slate-200" />
                  <div className="h-3 w-32 rounded bg-slate-200" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/70">
        <CardHeader>
          <CardTitle className="text-red-700">Impossible de charger les rapports</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit bg-white/10 text-white hover:bg-white/20">Centre de pilotage</Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Tous les rapports du magasin</h1>
              <p className="max-w-3xl text-sm text-slate-200 md:text-base">
                Ventes, stocks, finances, clients et personnel dans une seule vue. Les indicateurs non exposés par l’API sont marqués comme estimés au lieu d’être inventés.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <span>Période active: {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")}</span>
              <span>•</span>
              <span>{getRangeDays(startDate, endDate)} jour(s)</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer (page)
            </Button>
            <Button variant="secondary" onClick={generatePrintableReport}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer complet
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exporter CSV
            </Button>
            <Button variant="secondary" onClick={() => downloadReportPdf()}>
              <Download className="mr-2 h-4 w-4" />
              Télécharger PDF
            </Button>
          </div>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button variant={rangePreset === "7d" ? "default" : "outline"} size="sm" onClick={() => handlePreset("7d")}>7 jours</Button>
              <Button variant={rangePreset === "30d" ? "default" : "outline"} size="sm" onClick={() => handlePreset("30d")}>30 jours</Button>
              <Button variant={rangePreset === "90d" ? "default" : "outline"} size="sm" onClick={() => handlePreset("90d")}>90 jours</Button>
              <Button variant={rangePreset === "custom" ? "default" : "outline"} size="sm" onClick={() => setRangePreset("custom")}>Personnalisé</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Début</p>
                <Input
                  type="date"
                  value={formatDateInputValue(startDate)}
                  onChange={(event) => {
                    const next = new Date(event.target.value)
                    if (!Number.isNaN(next.getTime())) {
                      next.setHours(0, 0, 0, 0)
                      setStartDate(next)
                      setRangePreset("custom")
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Fin</p>
                <Input
                  type="date"
                  value={formatDateInputValue(endDate)}
                  onChange={(event) => {
                    const next = new Date(event.target.value)
                    if (!Number.isNaN(next.getTime())) {
                      next.setHours(23, 59, 59, 999)
                      setEndDate(next)
                      setRangePreset("custom")
                    }
                  }}
                />
              </div>
            </div>
            <div className="ml-4 w-56">
              <p className="text-xs text-muted-foreground">Devise (normaliser bénéfice)</p>
              <Select value={selectedCurrency} onValueChange={(v) => setSelectedCurrency(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="__none__">Aucune</SelectItem>
                  {devises.map(d => <SelectItem key={d.id} value={d.code ?? `DEV_${d.id}`}>{d.symbole ? `${d.symbole} ${d.code}` : d.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Chiffre d'affaires" value={formatMoney(currentRevenue)} subtitle={`Variation ${formatSignedPercent(revenueGrowth)}`} icon={DollarSign} tone="bg-emerald-600" />
        <MetricCard title="Transactions" value={currentTransactions.toLocaleString("fr-FR")} subtitle={`Variation ${formatSignedPercent(transactionGrowth)}`} icon={ShoppingCart} tone="bg-sky-600" />
        <MetricCard title="Panier moyen" value={formatMoney(currentAverageBasket)} subtitle={`Variation ${formatSignedPercent(basketGrowth)}`} icon={TrendingUp} tone="bg-violet-600" />
        <MetricCard title="Marge brute" value={formatMoney(grossMargin)} subtitle="Calculée à partir des coûts d’achat disponibles" icon={Target} tone="bg-amber-600" />
        <MetricCard title="Valeur du stock" value={formatMoney(stockValue)} subtitle={`${inventoryRows.length} produit(s)`} icon={FileSpreadsheet} tone="bg-slate-700" />
        <MetricCard title="Clients fidèles" value={loyalCustomers.length.toLocaleString("fr-FR")} subtitle={`${newCustomers.length} nouveaux clients sur la période`} icon={Star} tone="bg-indigo-600" />
        <MetricCard title="Encaissements" value={formatMoney(cashSummary.totalEntries)} subtitle={`Décaissements: ${formatMoney(cashSummary.totalExits)}`} icon={Wallet} tone="bg-rose-600" />
        <MetricCard title="Solde net caisse" value={formatMoney(cashSummary.balance)} subtitle="Entrées moins sorties de caisse" icon={TrendingDown} tone="bg-slate-900" />
      </div>

      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as TabKey)} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-2 bg-transparent p-0 print:hidden">
          <TabsTrigger value="overview" className="gap-2 rounded-full border data-[state=active]:bg-slate-950 data-[state=active]:text-white">
            <BarChart3 className="h-4 w-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2 rounded-full border data-[state=active]:bg-slate-950 data-[state=active]:text-white">
            <ShoppingCart className="h-4 w-4" />
            Ventes
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2 rounded-full border data-[state=active]:bg-slate-950 data-[state=active]:text-white">
            <Package className="h-4 w-4" />
            Stocks
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2 rounded-full border data-[state=active]:bg-slate-950 data-[state=active]:text-white">
            <DollarSign className="h-4 w-4" />
            Finances
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2 rounded-full border data-[state=active]:bg-slate-950 data-[state=active]:text-white">
            <Users className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="personnel" className="gap-2 rounded-full border data-[state=active]:bg-slate-950 data-[state=active]:text-white">
            <Clock className="h-4 w-4" />
            Personnel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Comparaison glissante</CardTitle>
                <CardDescription>Comparaison de la période active avec la période précédente de même durée.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {periodComparisons.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground">Avant: {formatMoney(row.previous)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(row.current)}</p>
                      <Badge variant={row.growth >= 0 ? "default" : "destructive"}>{formatSignedPercent(row.growth)}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alertes opérationnelles</CardTitle>
                <CardDescription>Les points d’attention détectés dans les données disponibles.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-3 rounded-xl border p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <div>
                    <p className="font-medium">{restockRows.length} produit(s) à réassortir</p>
                    <p className="text-muted-foreground">Seuil calculé à partir du stock actuel et de l’historique des lots.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border p-3">
                  <RotateCcw className="mt-0.5 h-4 w-4 text-rose-500" />
                  <div>
                    <p className="font-medium">{outOfStockRows.length} rupture(s) de stock</p>
                    <p className="text-muted-foreground">Durée de rupture estimée depuis le dernier mouvement ou le dernier approvisionnement.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border p-3">
                  <TrendingDown className="mt-0.5 h-4 w-4 text-sky-500" />
                  <div>
                    <p className="font-medium">{slowMovingRows.length} produit(s) à rotation lente</p>
                    <p className="text-muted-foreground">Vitesse de vente calculée sur la période filtrée.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rapports de ventes</CardTitle>
              <CardDescription>Journalier, par produit/référence, par période, top/flop, catégorie, marque et vendeur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {exportablePaymentNote}
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-semibold">Rapport journalier des ventes</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">CA</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Panier moyen</TableHead>
                      <TableHead>Moyen de paiement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregateSalesByGranularity(saleRows, "day").slice(-10).reverse().map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-right font-medium">{formatMoney(row.revenue)}</TableCell>
                        <TableCell className="text-right">{row.transactions}</TableCell>
                        <TableCell className="text-right">{formatMoney(row.averageBasket)}</TableCell>
                        <TableCell className="text-muted-foreground">Non détaillé dans l’API</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Top sellers</CardTitle>
                    <CardDescription>Produits les plus vendus par chiffre d’affaires.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Qté</TableHead>
                          <TableHead className="text-right">CA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topProducts.map((row) => (
                          <TableRow key={row.productId}>
                            <TableCell>
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-muted-foreground">{row.category}</div>
                            </TableCell>
                            <TableCell className="text-right">{row.quantity}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(row.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Flops</CardTitle>
                    <CardDescription>Produits avec la plus faible contribution au CA.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Qté</TableHead>
                          <TableHead className="text-right">CA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {flopProducts.map((row) => (
                          <TableRow key={row.productId}>
                            <TableCell>
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-muted-foreground">{row.category}</div>
                            </TableCell>
                            <TableCell className="text-right">{row.quantity}</TableCell>
                            <TableCell className="text-right font-medium">{formatMoney(row.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Ventes par période</CardTitle>
                    <CardDescription>Jour, semaine, mois et année avec comparaison glissante.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {periodComparisons.map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-xl border p-3">
                        <div>
                          <p className="font-medium">{row.label}</p>
                          <p className="text-xs text-muted-foreground">Période précédente: {formatMoney(row.previous)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatMoney(row.current)}</p>
                          <Badge variant={row.growth >= 0 ? "default" : "destructive"}>{formatSignedPercent(row.growth)}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Ventes par catégorie / marque</CardTitle>
                    <CardDescription>Répartition des ventes par attribut produit disponible.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Catégories</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Catégorie</TableHead>
                            <TableHead className="text-right">Qté</TableHead>
                            <TableHead className="text-right">CA</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categorySales.map((row) => (
                            <TableRow key={row.category}>
                              <TableCell>{row.category}</TableCell>
                              <TableCell className="text-right">{row.quantity}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Marques</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Marque</TableHead>
                            <TableHead className="text-right">Qté</TableHead>
                            <TableHead className="text-right">CA</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {brandSales.slice(0, 8).map((row) => (
                            <TableRow key={row.brand}>
                              <TableCell>{row.brand}</TableCell>
                              <TableCell className="text-right">{row.quantity}</TableCell>
                              <TableCell className="text-right">{formatMoney(row.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Ventes par vendeur / caissier</CardTitle>
                  <CardDescription>Performance commerciale, panier moyen et objectifs estimés.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendeur</TableHead>
                        <TableHead className="text-right">Transactions</TableHead>
                        <TableHead className="text-right">CA</TableHead>
                        <TableHead className="text-right">Panier moyen</TableHead>
                        <TableHead className="text-right">Objectif</TableHead>
                        <TableHead className="text-right">Atteinte</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesBySeller.map((seller) => {
                        const targetProgress = seller.objective > 0 ? (seller.revenue / seller.objective) * 100 : 0
                        return (
                          <TableRow key={seller.sellerId}>
                            <TableCell>
                              <div className="font-medium">{seller.name}</div>
                              <div className="text-xs text-muted-foreground">{seller.code}</div>
                            </TableCell>
                            <TableCell className="text-right">{seller.transactions}</TableCell>
                            <TableCell className="text-right">{formatMoney(seller.revenue)}</TableCell>
                            <TableCell className="text-right">{formatMoney(seller.averageBasket)}</TableCell>
                            <TableCell className="text-right">{formatMoney(seller.objective)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={targetProgress >= 100 ? "default" : targetProgress >= 80 ? "secondary" : "destructive"}>
                                {targetProgress.toFixed(0)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stocks et approvisionnement</CardTitle>
              <CardDescription>Inventaire, ruptures, réassort, invendus et mouvements de stock.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Stock théorique" value={inventoryRows.reduce((sum, row) => sum + row.theoreticalStock, 0).toLocaleString("fr-FR")} subtitle="Somme des quantités reçues" icon={FileSpreadsheet} tone="bg-slate-900" />
                <MetricCard title="Stock réel" value={inventoryRows.reduce((sum, row) => sum + row.actualStock, 0).toLocaleString("fr-FR")} subtitle="Depuis le stock disponible" icon={Package} tone="bg-sky-600" />
                <MetricCard title="Écart global" value={inventoryRows.reduce((sum, row) => sum + row.variance, 0).toLocaleString("fr-FR")} subtitle="Réalité moins théorique" icon={TrendingDown} tone="bg-amber-600" />
                <MetricCard title="Valeur estimée" value={formatMoney(stockValue)} subtitle={`Coût achat estimé: ${formatMoney(theoreticalStockValue)}`} icon={DollarSign} tone="bg-emerald-600" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Rapport d’inventaire</CardTitle>
                  <CardDescription>Stock théorique vs réel, écarts et valeur du stock.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Produit</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead className="text-right">Théorique</TableHead>
                        <TableHead className="text-right">Réel</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                        <TableHead className="text-right">Valeur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryRows.slice(0, 15).map((row) => (
                        <TableRow key={row.productId}>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell className="text-right">{row.theoreticalStock}</TableCell>
                          <TableCell className="text-right">{row.actualStock}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={row.variance === 0 ? "secondary" : row.variance < 0 ? "destructive" : "default"}>{row.variance}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatMoney(row.stockValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Ruptures de stock</CardTitle>
                    <CardDescription>Produits indisponibles actuellement.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Durée</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outOfStockRows.length > 0 ? outOfStockRows.slice(0, 8).map((row) => (
                          <TableRow key={row.productId}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right">{row.daysSinceLastMovement ?? 0} j</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">Aucune rupture active</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Produits à réassortir</CardTitle>
                    <CardDescription>Stock sous le seuil de réapprovisionnement.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Seuil</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {restockRows.slice(0, 8).map((row) => (
                          <TableRow key={row.productId}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right">{row.actualStock}</TableCell>
                            <TableCell className="text-right">{row.reorderPoint}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Invendus / rotation lente</CardTitle>
                    <CardDescription>Produits qui restent en stock sans se vendre vite.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Rotation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {slowMovingRows.slice(0, 8).map((row) => (
                          <TableRow key={row.productId}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right">{row.turnoverRate.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Entrées et sorties de stock</CardTitle>
                  <CardDescription>Approvisionnements et mouvements FIFO par date et fournisseur.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Fournisseur</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">Valeur</TableHead>
                        <TableHead>Utilisateur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockMovementRows.slice(0, 12).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.date ? format(row.date, "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{row.reference}</TableCell>
                          <TableCell>{row.supplier}</TableCell>
                          <TableCell className="text-right">{row.quantity}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.totalValue)}</TableCell>
                          <TableCell>{row.actor}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Finances et trésorerie</CardTitle>
              <CardDescription>Chiffre d’affaires, marge brute, taxes, comptes de caisse et soldes bancaires.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="CA HT" value={formatMoney(caHt)} subtitle="Estimé à partir des lignes de vente" icon={DollarSign} tone="bg-emerald-600" />
                <MetricCard title="CA TTC" value={formatMoney(caTtc)} subtitle="Même valeur tant que la TVA n’est pas détaillée" icon={Wallet} tone="bg-sky-600" />
                <MetricCard title="Taxes collectées" value={formatMoney(taxesCollected)} subtitle="TVA non paramétrée dans l’API" icon={Target} tone="bg-amber-600" />
                <MetricCard title="Marge brute" value={formatMoney(grossMargin)} subtitle="Ventes moins coût d’achat estimé" icon={TrendingUp} tone="bg-violet-600" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Trésorerie</CardTitle>
                  <CardDescription>Encaissements, décaissements et soldes courants par caisse.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard title="Encaissements" value={formatMoney(cashSummary.totalEntries)} icon={TrendingUp} tone="bg-emerald-600" />
                    <MetricCard title="Décaissements" value={formatMoney(cashSummary.totalExits)} icon={TrendingDown} tone="bg-rose-600" />
                    <MetricCard title="Solde net" value={formatMoney(cashSummary.balance)} icon={Wallet} tone="bg-slate-950" />
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead className="text-right">Occurrences</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashSummary.byType.map((row) => (
                        <TableRow key={row.label}>
                          <TableCell>{row.label}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Soldes bancaires / caisses</CardTitle>
                  <CardDescription>Positions disponibles par devise.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Caisse</TableHead>
                        <TableHead className="text-right">Solde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caisseRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.label}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.balance, row.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Bénéfice par jour</CardTitle>
                  <CardDescription>Bénéfice total par jour sur la période sélectionnée</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Devise</TableHead>
                        <TableHead className="text-right">Bénéfice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profitByDay.map((r) => (
                        <TableRow key={r.date_vente + (r.devise_code || '')}>
                          <TableCell>{r.date_vente}</TableCell>
                          <TableCell className="text-right">{r.devise_code || (typeof window !== 'undefined' ? localStorage.getItem('pos_currency_code') || '' : '')}</TableCell>
                          <TableCell className="text-right">{formatMoney(Number(r.benefice_total || 0), r.devise_code || (typeof window !== 'undefined' ? localStorage.getItem('pos_currency_symbol') || '' : ''))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bénéfice par produit</CardTitle>
                  <CardDescription>Produits triés par bénéfice décroissant</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">CA</TableHead>
                        <TableHead className="text-right">Bénéfice</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profitByProduct.map((r) => (
                        <TableRow key={String(r.id_produit)}>
                          <TableCell>{r.produit_nom || r.produit_code || `#${r.id_produit}`}</TableCell>
                          <TableCell className="text-right">{(r.quantite_vendue ?? 0).toLocaleString('fr-FR')}</TableCell>
                          <TableCell className="text-right">{formatMoney(Number(r.chiffre_affaires ?? 0), r.devise_code)}</TableCell>
                          <TableCell className="text-right">{formatMoney(Number(r.benefice_total ?? 0), r.devise_code)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clients et fidélisation</CardTitle>
              <CardDescription>Clients fidèles, nouveaux clients, profils clients et tickets moyens.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard title="Clients fidèles" value={loyalCustomers.length.toLocaleString("fr-FR")} subtitle="Achats répétés ou montant élevé" icon={Star} tone="bg-emerald-600" />
                <MetricCard title="Nouveaux clients" value={newCustomers.length.toLocaleString("fr-FR")} subtitle="Premier achat sur la période" icon={Users} tone="bg-sky-600" />
                <MetricCard title="Clients réguliers" value={regularCustomers.length.toLocaleString("fr-FR")} subtitle="Au moins deux achats, hors nouveaux" icon={UserPlus} tone="bg-violet-600" />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {customerSegments.map((segment) => (
                  <Card key={segment.segment}>
                    <CardHeader>
                      <CardTitle>{segment.segment}</CardTitle>
                      <CardDescription>{segment.count} client(s)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-2xl font-semibold">{formatMoney(segment.totalRevenue)}</p>
                      <p className="text-sm text-muted-foreground">Ticket moyen: {formatMoney(segment.averageBasket)}</p>
                      <Badge className={segment.color}>{segment.segment}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top clients</CardTitle>
                  <CardDescription>Montant cumulé, fréquence d’achat et ancienneté.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Achats</TableHead>
                        <TableHead className="text-right">CA</TableHead>
                        <TableHead className="text-right">Panier moyen</TableHead>
                        <TableHead>Dernier achat</TableHead>
                        <TableHead>Profil</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesByClient.slice(0, 12).map((client) => (
                        <TableRow key={client.clientId}>
                          <TableCell>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-xs text-muted-foreground">{client.contact}</div>
                          </TableCell>
                          <TableCell className="text-right">{client.transactions}</TableCell>
                          <TableCell className="text-right">{formatMoney(client.revenue)}</TableCell>
                          <TableCell className="text-right">{formatMoney(client.averageBasket)}</TableCell>
                          <TableCell>{client.lastPurchase ? format(client.lastPurchase, "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {client.loyal ? <Badge variant="default">Fidèle</Badge> : null}
                              {client.newCustomer ? <Badge variant="secondary">Nouveau</Badge> : null}
                              {!client.loyal && !client.newCustomer ? <Badge variant="outline">Régulier</Badge> : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personnel</CardTitle>
              <CardDescription>Performances par vendeur, heures travaillées estimées et objectifs réalisés.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                {exportableHoursNote}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendeur</TableHead>
                    <TableHead className="text-right">Ventes</TableHead>
                    <TableHead className="text-right">CA</TableHead>
                    <TableHead className="text-right">Panier moyen</TableHead>
                    <TableHead className="text-right">Heures estimées</TableHead>
                    <TableHead className="text-right">Objectif</TableHead>
                    <TableHead className="text-right">Réalisé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesBySeller.map((seller) => {
                    const progress = seller.objective > 0 ? (seller.revenue / seller.objective) * 100 : 0
                    return (
                      <TableRow key={seller.sellerId}>
                        <TableCell>
                          <div className="font-medium">{seller.name}</div>
                          <div className="text-xs text-muted-foreground">{seller.code}</div>
                        </TableCell>
                        <TableCell className="text-right">{seller.transactions}</TableCell>
                        <TableCell className="text-right">{formatMoney(seller.revenue)}</TableCell>
                        <TableCell className="text-right">{formatMoney(seller.averageBasket)}</TableCell>
                        <TableCell className="text-right">{seller.estimatedHours.toFixed(1)} h</TableCell>
                        <TableCell className="text-right">{formatMoney(seller.objective)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={progress >= 100 ? "default" : progress >= 80 ? "secondary" : "destructive"}>{progress.toFixed(0)}%</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
