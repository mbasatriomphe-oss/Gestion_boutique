"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  Eye,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { backendRequest, getStoredToken } from "../services/backend"
import { useAuth } from "../context/auth-context"

interface DashboardStats {
  totalSales: number
  totalOrders: number
  totalCustomers: number
  lowStockItems: number
  salesGrowth: number
  orderGrowth: number
  topProducts: Array<{
    id: number
    name: string
    sales: number
    growth: number
  }>
  recentOrders: Array<{
    id: string
    customer: string
    total: number
    status: string
    timestamp: Date
  }>
}

interface BackendClient {
  id: number
  nom?: string
  post_nom?: string | null
  prenom?: string | null
}

interface BackendProductLine {
  id: number
  quantite: number
  prix_vente: number | string
  produit?: {
    id: number
    nom?: string
  } | null
}

interface BackendSale {
  id: number
  code?: string
  date?: string
  created_at?: string
  id_client?: number | null
  client?: BackendClient | null
  lignes?: BackendProductLine[]
}

interface BackendStockItem {
  id: number
  code?: string
  nom?: string
  stock_actuel: number | string
}

interface BackendEnvelope<T> {
  status?: string
  data?: T
}

const LOW_STOCK_THRESHOLD = 10

function toNumber(value: number | string | null | undefined): number {
  return typeof value === "number" ? value : Number(value ?? 0)
}

function formatCustomerName(client?: BackendClient | null): string {
  if (!client) {
    return "Guest"
  }

  return [client.nom, client.post_nom, client.prenom].filter(Boolean).join(" ").trim() || "Guest"
}

function getSaleDate(sale: BackendSale): Date {
  return new Date(sale.date ?? sale.created_at ?? Date.now())
}

function getSaleTotal(sale: BackendSale): number {
  return (sale.lignes ?? []).reduce((sum, line) => sum + toNumber(line.quantite) * toNumber(line.prix_vente), 0)
}

function buildPeriod(range: string) {
  const periodDays = range === "7d" ? 7 : range === "30d" ? 30 : 90
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - periodDays)

  const previousEndDate = new Date(startDate)
  previousEndDate.setDate(previousEndDate.getDate() - 1)

  const previousStartDate = new Date(previousEndDate)
  previousStartDate.setDate(previousStartDate.getDate() - periodDays)

  return { startDate, endDate, previousStartDate, previousEndDate }
}

function calculateGrowth(currentValue: number, previousValue: number): number {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : 100
  }

  return ((currentValue - previousValue) / previousValue) * 100
}

function aggregateProductSales(sales: BackendSale[]) {
  const productSales = new Map<number, { name: string; sales: number }>()

  for (const sale of sales) {
    for (const line of sale.lignes ?? []) {
      const productId = Number(line.produit?.id ?? line.id)
      const existing = productSales.get(productId) || {
        name: line.produit?.nom || `Produit #${productId}`,
        sales: 0,
      }

      existing.sales += toNumber(line.quantite) * toNumber(line.prix_vente)
      productSales.set(productId, existing)
    }
  }

  return productSales
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("7d")
  const [authError, setAuthError] = useState<string | null>(null)
  const { user, isLoading: authLoading } = useAuth() as {
    user: { role?: string } | null
    isLoading: boolean
  }
  const router = useRouter()

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!user || user.role !== "admin") {
      return
    }

    void loadDashboardData()
  }, [timeRange, authLoading, user])

  const loadDashboardData = async () => {
    const token = getStoredToken()

    if (!token) {
      setAuthError("Session expirée. Veuillez vous reconnecter.")
      setStats(null)
      setLoading(false)
      router.push("/login")
      return
    }

    setAuthError(null)
    setLoading(true)
    try {
      const { startDate, endDate, previousStartDate, previousEndDate } = buildPeriod(timeRange)

      const [customersResponse, stocksResponse, currentSalesResponse, previousSalesResponse] = await Promise.all([
        backendRequest<BackendEnvelope<BackendClient[]>>("/clients?per_page=all", {}, token),
        backendRequest<BackendEnvelope<BackendStockItem[]>>("/stocks/disponible", {}, token),
        backendRequest<BackendEnvelope<BackendSale[]>>("/ventes?per_page=all&sort_by=id&sort_direction=desc", {}, token),
        backendRequest<BackendEnvelope<BackendSale[]>>("/ventes?per_page=all&sort_by=id&sort_direction=desc", {}, token),
      ])

      const customers = customersResponse.data ?? []
      const lowStockItems = (stocksResponse.data ?? []).filter((item) => toNumber(item.stock_actuel) <= LOW_STOCK_THRESHOLD)

      const currentTransactions = (currentSalesResponse.data ?? []).filter((sale) => {
        const saleDate = getSaleDate(sale)
        return saleDate >= startDate && saleDate <= endDate
      })

      const previousTransactions = (previousSalesResponse.data ?? []).filter((sale) => {
        const saleDate = getSaleDate(sale)
        return saleDate >= previousStartDate && saleDate <= previousEndDate
      })

      const totalSales = currentTransactions.reduce((sum, sale) => sum + getSaleTotal(sale), 0)
      const totalOrders = currentTransactions.length

      const previousTotalSales = previousTransactions.reduce((sum, sale) => sum + getSaleTotal(sale), 0)
      const previousTotalOrders = previousTransactions.length

      const salesGrowth = calculateGrowth(totalSales, previousTotalSales)
      const orderGrowth = calculateGrowth(totalOrders, previousTotalOrders)

      const currentProductSales = aggregateProductSales(currentTransactions)
      const previousProductSales = aggregateProductSales(previousTransactions)

      const topProducts = Array.from(currentProductSales.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          sales: data.sales,
          growth: calculateGrowth(data.sales, previousProductSales.get(id)?.sales ?? 0),
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5)

      const recentOrders = currentTransactions
        .slice()
        .sort((a, b) => getSaleDate(b).getTime() - getSaleDate(a).getTime())
        .slice(0, 5)
        .map((sale) => ({
          id: sale.code ? String(sale.code) : String(sale.id),
          customer: formatCustomerName(sale.client),
          total: getSaleTotal(sale),
          status: "completed",
          timestamp: getSaleDate(sale),
        }))

      setStats({
        totalSales,
        totalOrders,
        totalCustomers: customers.length,
        lowStockItems: lowStockItems.length,
        salesGrowth,
        orderGrowth,
        topProducts,
        recentOrders,
      })
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
      const message = error instanceof Error ? error.message : "Impossible de charger le tableau de bord."

      if (/Unauthenticated|401/i.test(message)) {
        setAuthError("Session expirée. Veuillez vous reconnecter.")
        router.push("/login")
        return
      }

      setAuthError(message)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  if (authError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Tableau de bord indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">{authError}</p>
          <Button className="mt-4" onClick={() => router.push("/login")}>Retour à la connexion</Button>
        </div>
      </div>
    )
  }

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl lg:text-3xl font-bold">Tableau de bord</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold">Tableau de bord</h1>
        <div className="flex gap-2">
          {["7d", "30d", "90d"].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range === "7d" ? "7 jours" : range === "30d" ? "30 jours" : "90 jours"}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalSales.toFixed(2)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stats.salesGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={stats.salesGrowth >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(stats.salesGrowth).toFixed(1)}%
              </span>
              <span className="ml-1">par rapport à la période précédente</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stats.orderGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={stats.orderGrowth >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(stats.orderGrowth).toFixed(1)}%
              </span>
              <span className="ml-1">par rapport à la période précédente</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients au total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Base clients active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes de stock faible</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Les articles doivent être réapprovisionnés</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Produits les plus performants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">${product.sales.toFixed(2)}</span>
                        {product.growth >= 0 ? (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                            +{product.growth.toFixed(1)}%
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                            {product.growth.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Progress value={(product.sales / stats.topProducts[0].sales) * 100} className="w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Commandes récentes</CardTitle>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Voir tout
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">#{order.id}</p>
                    <p className="text-xs text-muted-foreground">{order.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">${order.total.toFixed(2)}</p>
                    <Badge variant="secondary" className="text-xs">
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button className="h-20 flex-col gap-2">
              <Package className="h-6 w-6" />
              Ajouter un produit
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
              <ShoppingCart className="h-6 w-6" />
              Voir les commandes
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
              <Users className="h-6 w-6" />
              Gérer les clients
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2 bg-transparent">
              <BarChart3 className="h-6 w-6" />
              Voir les analyses
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
