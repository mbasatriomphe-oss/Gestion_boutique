"use client"

import { useState, useEffect, useCallback } from "react"
import { Filter, History, Loader2, RefreshCw, ShoppingCart, Trash2, TrendingUp } from "lucide-react"
import ProductGrid from "./components/product-grid"
import CartSidebar from "./components/cart-sidebar"
import CategorySidebar from "./components/category-sidebar"
import Header from "./components/header"
import { useAuth } from "./context/auth-context"
import { useSettings } from "./context/settings-context"
import { useCart } from "./context/cart-context"
import { useRouter } from "next/navigation"
import { backendRequest } from "./services/backend"
import type { Product } from "./context/cart-context"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

type POSSettings = {
  quickActionsEnabled: boolean
}

type BackendCategory = {
  id: number
  nom: string
}

type BackendProduct = {
  id: number
  code: string
  nom: string
  photo: string | null
  categorie?: BackendCategory
}

type BackendLot = {
  id: number
  id_produit: number
  ligne_approvisionnement?: {
    prix_vente?: string | null
    prix_unitaire?: string | null
  }
  devise?: {
    code?: string
    symbole?: string
  }
}

type StockRow = {
  id: number
  code: string
  nom: string
  stock_actuel: number
}

type SaleClient = {
  id: number
  nom: string
  post_nom?: string | null
  prenom?: string | null
}

type SaleVendor = {
  id: number
  nom: string
  prenom?: string | null
}

type SaleLine = {
  id: number
  quantite: number
  prix_vente: string
  devise?: { id?: number; code?: string; symbole?: string }
}

type Sale = {
  id: number
  code: string
  date: string
  created_at?: string
  id_vendeur: number
  id_client: number
  vendeur?: SaleVendor
  client?: SaleClient
  lignes: SaleLine[]
  reste_a_payer?: number
  deviseVente?: { id?: number; code?: string; symbole?: string }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getPhotoUrl(photo: string | null | undefined) {
  if (!photo) return "/placeholder.svg"
  if (photo.startsWith("http://") || photo.startsWith("https://") || photo.startsWith("blob:")) return photo
  // Use relative path — proxied through Next.js /storage/* rewrite
  return `/storage/${photo.replace(/^\/+/, "")}`
}

function getToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatDateTime(value?: string) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function saleTotal(sale: Sale) {
  return (sale.lignes ?? []).reduce((sum, line) => sum + Number(line.quantite) * Number(line.prix_vente), 0)
}

function isCancelableSale(sale: Sale) {
  if (!sale.created_at) return false

  const elapsed = Date.now() - new Date(sale.created_at).getTime()
  return Number.isFinite(elapsed) && elapsed <= 60 * 60 * 1000
}

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const { user, isLoading } = useAuth()
  const { settings } = useSettings() as { settings: POSSettings }
  const { clearCart, itemCount } = useCart()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([{ id: "all", name: "Tous les produits" }])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [sales, setSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState("")
  const [salePeriod, setSalePeriod] = useState<"today" | "month" | "all">("today")
  const [saleDate, setSaleDate] = useState(getToday())
  const [saleMonth, setSaleMonth] = useState(getToday().slice(0, 7))
  const [saleSortDirection, setSaleSortDirection] = useState<"desc" | "asc">("desc")

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!settings.quickActionsEnabled) return

    // Check if user is typing in an input
    const target = e.target as HTMLElement
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      if (e.key === "Escape") {
        target.blur()
      }
      return
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault()
          clearCart()
          break
        case "p":
          e.preventDefault()
          router.push("/checkout")
          break
        case "f":
          e.preventDefault()
          const searchInput = document.querySelector('input[placeholder="Rechercher des produits..."]') as HTMLInputElement
          searchInput?.focus()
          break
        case "d":
          e.preventDefault()
          // Trigger discount modal (handled by cart sidebar)
          const discountBtn = document.querySelector('[data-discount-trigger]') as HTMLButtonElement
          discountBtn?.click()
          break
      }
    }

    if (e.key === "Escape") {
      clearCart()
      setSearchQuery("")
    }
  }, [settings.quickActionsEnabled, clearCart, router])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const fetchSales = useCallback(async () => {
    if (!user) return

    setSalesLoading(true)
    setSalesError("")

    try {
      const params = new URLSearchParams({
        per_page: "0",
        sort_by: "created_at",
        sort_direction: saleSortDirection,
      })

      if (salePeriod === "today") {
        params.set("period", "daily")
        params.set("date", saleDate)
      } else if (salePeriod === "month") {
        params.set("period", "monthly")
        params.set("month", saleMonth)
      }

      const response = await backendRequest<{ data: Sale[] }>(`/ventes?${params.toString()}`)
      setSales((response.data ?? []).map((sale) => ({ ...sale, lignes: sale.lignes ?? [] })))
    } catch (error) {
      setSalesError(error instanceof Error ? error.message : "Impossible de charger les ventes.")
    } finally {
      setSalesLoading(false)
    }
  }, [saleDate, saleMonth, salePeriod, saleSortDirection, user])

  useEffect(() => {
    if (!user) return

    void fetchSales()
  }, [user, fetchSales])

  const handleCancelSale = async (sale: Sale) => {
    if (!confirm(`Annuler la vente ${sale.code} ?`)) {
      return
    }

    try {
      await backendRequest(`/ventes/${sale.id}`, { method: "DELETE" })
      setSales((prev) => prev.filter((item) => item.id !== sale.id))
    } catch (error) {
      setSalesError(error instanceof Error ? error.message : "Impossible d'annuler cette vente.")
    }
  }
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [selectedSaleToPay, setSelectedSaleToPay] = useState<Sale | null>(null)
  const [paymentsToMake, setPaymentsToMake] = useState<Array<{ devise_id: string; montant: string }>>([])
  const [paymentFormError, setPaymentFormError] = useState("")
  const [isSavingPayment, setIsSavingPayment] = useState(false)
  const [devisesList, setDevisesList] = useState<Array<{ id: number; code?: string; symbole?: string }>>([])
  const [rateByPair, setRateByPair] = useState<Record<string, number>>({})
  const [rateInfoByPair, setRateInfoByPair] = useState<Record<string, string>>({})

  function makeRateKey(sourceCurrencyId: number, targetCurrencyId: number) {
    return `${sourceCurrencyId}-${targetCurrencyId}`
  }

  async function resolveRate(sourceCurrencyId?: number, targetCurrencyId?: number, date?: string) {
    if (!sourceCurrencyId || !targetCurrencyId) return NaN
    if (sourceCurrencyId === targetCurrencyId) return 1

    const dateParam = date ? `&date=${encodeURIComponent(date)}` : ''

    try {
      const directResponse = await backendRequest<{ status?: string; data?: { valeur?: string } }>(`/taux/actif?devise_source=${sourceCurrencyId}&devise_but=${targetCurrencyId}${dateParam}`)
      const direct = Number(directResponse.data?.valeur)
      if (Number.isFinite(direct) && direct > 0) return direct
      throw new Error('Taux invalide')
    } catch {
      const reverseResponse = await backendRequest<{ status?: string; data?: { valeur?: string } }>(`/taux/actif?devise_source=${targetCurrencyId}&devise_but=${sourceCurrencyId}${dateParam}`)
      const reverse = Number(reverseResponse.data?.valeur)
      if (!Number.isFinite(reverse) || reverse <= 0) throw new Error('Taux introuvable')
      return 1 / reverse
    }
  }

  const handlePayDebt = async (sale: Sale) => {
    if (!sale || Number(sale.reste_a_payer ?? 0) <= 0) {
      alert("Aucune dette à payer pour cette vente.")
      return
    }

    try {
      const devRes = await backendRequest<{ data: Array<{ id: number; code?: string; symbole?: string }> }>(`/devises?per_page=all`)
      const devises = devRes.data ?? []

      setDevisesList(devises)

      if (devises.length === 0) {
        setPaymentFormError('Aucune devise disponible.')
        return
      }

      const defaultDev = String(sale.deviseVente?.id ?? devises[0].id ?? "")
      setRateByPair({})
      setRateInfoByPair({})
      setPaymentsToMake([{ devise_id: defaultDev, montant: String(Number(sale.reste_a_payer ?? 0).toFixed(2)) }])
      setSelectedSaleToPay(sale)
      setPaymentFormError("")
      setShowPayDialog(true)
    } catch (err: unknown) {
      setPaymentFormError(err instanceof Error ? err.message : 'Erreur lors de la récupération des devises')
    }
  }

  // Load needed rates whenever the dialog opens or payments/devise change
  useEffect(() => {
    let cancelled = false

    const loadRates = async () => {
      if (!showPayDialog || !selectedSaleToPay) return

      const saleDevId = Number(selectedSaleToPay?.deviseVente?.id ?? selectedSaleToPay?.lignes?.[0]?.devise?.id ?? 0)
      const neededPairs: Array<[number, number]> = []

      for (const p of paymentsToMake) {
        const payDevId = Number(p.devise_id)
        if (!payDevId || !saleDevId) continue
        const key = makeRateKey(payDevId, saleDevId)
        if (rateByPair[key] === undefined) {
          neededPairs.push([payDevId, saleDevId])
        }
      }

      if (neededPairs.length === 0) return

      const nextRates: Record<string, number> = {}
      const nextInfo: Record<string, string> = {}
      try {
        for (const [src, tgt] of neededPairs) {
          try {
            const dateParam = selectedSaleToPay?.date ? `&date=${encodeURIComponent(selectedSaleToPay.date)}` : ''
            const directResp = await backendRequest<{ status?: string; data?: { valeur?: string } }>(`/taux/actif?devise_source=${src}&devise_but=${tgt}${dateParam}`)
            const directVal = Number(directResp.data?.valeur)
            const key = makeRateKey(src, tgt)
            if (Number.isFinite(directVal) && directVal > 0) {
              nextRates[key] = directVal
              nextInfo[key] = `1 ${devisesList.find(d => d.id === src)?.code ?? src} = ${directVal} ${devisesList.find(d => d.id === tgt)?.code ?? tgt}`
              continue
            }

            const reverseResp = await backendRequest<{ status?: string; data?: { valeur?: string } }>(`/taux/actif?devise_source=${tgt}&devise_but=${src}${dateParam}`)
            const reverseVal = Number(reverseResp.data?.valeur)
            if (Number.isFinite(reverseVal) && reverseVal > 0) {
              nextRates[key] = 1 / reverseVal
              nextInfo[key] = `1 ${devisesList.find(d => d.id === src)?.code ?? src} = ${(1 / reverseVal).toFixed(8)} ${devisesList.find(d => d.id === tgt)?.code ?? tgt} (inverse)`
            }
          } catch (e) {
            // leave undefined
          }
        }

        if (!cancelled) {
          setRateByPair(prev => ({ ...prev, ...nextRates }))
          setRateInfoByPair(prev => ({ ...prev, ...nextInfo }))
        }
      } catch {
        // ignore
      }
    }

    void loadRates()

    return () => { cancelled = true }
  }, [showPayDialog, selectedSaleToPay, paymentsToMake])

  // When user changes payment devise, auto-convert the amount to the new currency
  const handlePaymentDeviseChange = async (idx: number, newDeviseId: string) => {
    const newPayDevId = Number(newDeviseId)
    const saleDevId = Number(selectedSaleToPay?.deviseVente?.id ?? selectedSaleToPay?.lignes?.[0]?.devise?.id ?? 0)

    let rate: number | undefined = rateByPair[makeRateKey(newPayDevId, saleDevId)]

    if (rate === undefined && newPayDevId && saleDevId && newPayDevId !== saleDevId) {
      try {
        const dateParam = selectedSaleToPay?.date ? `&date=${encodeURIComponent(selectedSaleToPay.date)}` : ''
        const directResp = await backendRequest<{ status?: string; data?: { valeur?: string } }>(`/taux/actif?devise_source=${newPayDevId}&devise_but=${saleDevId}${dateParam}`)
        const directVal = Number(directResp.data?.valeur)
        const key = makeRateKey(newPayDevId, saleDevId)
        if (Number.isFinite(directVal) && directVal > 0) {
          rate = directVal
          setRateByPair(prev => ({ ...prev, [key]: rate! }))
          setRateInfoByPair(prev => ({ ...prev, [key]: `1 ${devisesList.find(d => d.id === newPayDevId)?.code ?? newPayDevId} = ${directVal} ${devisesList.find(d => d.id === saleDevId)?.code ?? saleDevId}` }))
        } else {
          const reverseResp = await backendRequest<{ status?: string; data?: { valeur?: string } }>(`/taux/actif?devise_source=${saleDevId}&devise_but=${newPayDevId}${dateParam}`)
          const reverseVal = Number(reverseResp.data?.valeur)
          if (Number.isFinite(reverseVal) && reverseVal > 0) {
            rate = 1 / reverseVal
            setRateByPair(prev => ({ ...prev, [key]: rate! }))
            setRateInfoByPair(prev => ({ ...prev, [key]: `1 ${devisesList.find(d => d.id === newPayDevId)?.code ?? newPayDevId} = ${(1 / reverseVal).toFixed(8)} ${devisesList.find(d => d.id === saleDevId)?.code ?? saleDevId} (inverse)` }))
          }
        }
      } catch { /* leave undefined */ }
    }

    // montant_payment = reste_a_payer / rate(payment→sale)
    const resteAPayer = Number(selectedSaleToPay?.reste_a_payer ?? 0)
    let newMontant: string
    if (!newPayDevId || newPayDevId === saleDevId) {
      newMontant = resteAPayer.toFixed(2)
    } else if (rate !== undefined && rate > 0) {
      newMontant = (resteAPayer / rate).toFixed(2)
    } else {
      newMontant = paymentsToMake[idx]?.montant ?? ''
    }

    setPaymentsToMake(prev => prev.map((r, i) => i === idx ? { ...r, devise_id: newDeviseId, montant: newMontant } : r))
  }

  useEffect(() => {
    if (!user) return

    let cancelled = false

    const loadProducts = async () => {
      setLoadingProducts(true)
      try {
        const [productRes, lotRes, stockRes] = await Promise.all([
          backendRequest<{ data: BackendProduct[] }>("/produits?per_page=all").catch(() => ({ data: [] })),
          backendRequest<{ data: BackendLot[] }>("/lots?per_page=all").catch(() => ({ data: [] })),
          backendRequest<{ data: StockRow[] }>("/stocks/disponible").catch(() => ({ data: [] })),
        ])

        const latestLotByProduct = new Map<number, BackendLot>()
        for (const lot of lotRes.data ?? []) {
          if (!latestLotByProduct.has(lot.id_produit)) {
            latestLotByProduct.set(lot.id_produit, lot)
          }
        }

        const productById = new Map<number, BackendProduct>()
        for (const product of productRes.data ?? []) {
          productById.set(product.id, product)
        }

        const stockById = new Map<number, StockRow>()
        for (const row of stockRes.data ?? []) {
          stockById.set(row.id, row)
        }

        const sourceRows: StockRow[] = []
        const seenIds = new Set<number>()

        for (const product of productRes.data ?? []) {
          seenIds.add(product.id)
          sourceRows.push({
            id: product.id,
            code: product.code,
            nom: product.nom,
            stock_actuel: Number(stockById.get(product.id)?.stock_actuel ?? 0),
          })
        }

        for (const row of stockRes.data ?? []) {
          if (seenIds.has(row.id)) {
            continue
          }

          sourceRows.push({
            id: row.id,
            code: row.code,
            nom: row.nom,
            stock_actuel: Number(row.stock_actuel ?? 0),
          })
        }

        const mappedProducts: Product[] = sourceRows.map((row) => {
          const product = productById.get(row.id)
          const latestLot = latestLotByProduct.get(row.id)
          const price = Number(latestLot?.ligne_approvisionnement?.prix_vente ?? latestLot?.ligne_approvisionnement?.prix_unitaire ?? 0)
          const categoryName = product?.categorie?.nom ?? "Autres"
          const currencySymbol = latestLot?.devise?.symbole ?? latestLot?.devise?.code ?? "$"

          return {
            id: row.id,
            name: product?.nom ?? row.nom,
            price,
            image: getPhotoUrl(product?.photo ?? null),
            category: slugify(categoryName) || "autres",
            categoryLabel: categoryName,
            currencySymbol,
            stock: Number(row.stock_actuel ?? 0),
          }
        })

        const categoryEntries = new Map<string, { id: string; name: string }>()

        for (const product of productRes.data ?? []) {
          const categoryName = product.categorie?.nom?.trim() || "Autres"
          const categoryId = slugify(categoryName) || "autres"

          if (!categoryEntries.has(categoryId)) {
            categoryEntries.set(categoryId, {
              id: categoryId,
              name: categoryName,
            })
          }
        }

        const mappedCategories = [
          { id: "all", name: "Tous les produits" },
          ...Array.from(categoryEntries.values()).sort((left, right) => left.name.localeCompare(right.name)),
        ]

        if (!cancelled) {
          setProducts(mappedProducts)
          setCategories(mappedCategories)
        }
      } catch {
        if (!cancelled) {
          setProducts([])
        }
      } finally {
        if (!cancelled) {
          setLoadingProducts(false)
        }
      }
    }

    const refreshProducts = () => {
      void loadProducts()
    }

    refreshProducts()

    window.addEventListener("focus", refreshProducts)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshProducts()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      window.removeEventListener("focus", refreshProducts)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user])

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  // If no user, the auth context will redirect to login
  if (!user) {
    return null
  }

  const totalSalesAmount = sales.reduce((sum, sale) => sum + saleTotal(sale), 0)
  const cancelableSales = sales.filter((sale) => isCancelableSale(sale)).length

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <CategorySidebar selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} categories={categories} />

      <main className="flex min-h-0 flex-1 flex-col">
        <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        <Tabs defaultValue="catalog" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b bg-background/95 px-3 py-3 shadow-sm backdrop-blur sm:px-4">
            <TabsList className="grid h-12 w-full max-w-md grid-cols-2 rounded-2xl bg-muted/80 p-1">
              <TabsTrigger
                value="catalog"
                className="rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Catalogue
              </TabsTrigger>
              <TabsTrigger
                value="sales"
                className="rounded-xl text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Mes ventes
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                    {sales.length}
                  </Badge>
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="catalog" className="m-0 flex-1 overflow-auto p-3 sm:p-4">
            <ProductGrid category={selectedCategory} searchQuery={searchQuery} products={products} />
          </TabsContent>

          <TabsContent value="sales" className="m-0 flex-1 overflow-auto p-3 sm:p-4">
            <div className="space-y-4">
              {salesError && (
                <Alert variant="destructive">
                  <AlertDescription>{salesError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Ventes affichées</p>
                    <p className="text-2xl font-bold">{sales.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Montant total</p>
                    <p className="text-2xl font-bold">{totalSalesAmount.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Annulables maintenant</p>
                    <p className="text-2xl font-bold">{cancelableSales}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-4 w-4" />Historique des ventes
                    </CardTitle>
                    <Button variant="outline" onClick={() => void fetchSales()} disabled={salesLoading}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${salesLoading ? "animate-spin" : ""}`} />Actualiser
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Période</Label>
                      <Select value={salePeriod} onValueChange={(value) => setSalePeriod(value as "today" | "month" | "all")}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir une période" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="today">Journalier</SelectItem>
                          <SelectItem value="month">Mensuel</SelectItem>
                          <SelectItem value="all">Toutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {salePeriod === "today" && (
                      <div className="space-y-1">
                        <Label>Date</Label>
                        <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                      </div>
                    )}
                    {salePeriod === "month" && (
                      <div className="space-y-1">
                        <Label>Mois</Label>
                        <Input type="month" value={saleMonth} onChange={(e) => setSaleMonth(e.target.value)} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Tri</Label>
                      <Select value={saleSortDirection} onValueChange={(value) => setSaleSortDirection(value as "asc" | "desc")}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ordre" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="desc">Plus récentes</SelectItem>
                          <SelectItem value="asc">Plus anciennes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border">
                    {salesLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : sales.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        <TrendingUp className="mx-auto mb-3 h-12 w-12 opacity-40" />Aucune vente trouvée.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Date / heure</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Montant</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="w-24" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sales.map((sale) => {
                            const cancelable = isCancelableSale(sale)

                            return (
                              <TableRow key={sale.id}>
                                <TableCell className="font-mono text-xs">{sale.code}</TableCell>
                                <TableCell>{formatDateTime(sale.created_at ?? sale.date)}</TableCell>
                                <TableCell>
                                  {[sale.client?.prenom, sale.client?.post_nom, sale.client?.nom].filter(Boolean).join(" ") || "—"}
                                </TableCell>
                                <TableCell className="font-semibold text-emerald-600">{saleTotal(sale).toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge variant={cancelable ? "secondary" : "outline"}>
                                    {cancelable ? "Annulable" : "Trop tard"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="flex gap-2">
                                  {Number(sale.reste_a_payer ?? 0) > 0 && (
                                    <Button variant="secondary" size="sm" className="h-8" onClick={() => void handlePayDebt(sale)}>
                                      Payer dette
                                    </Button>
                                  )}

                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8"
                                    disabled={!cancelable}
                                    onClick={() => void handleCancelSale(sale)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />Annuler
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-3.5 w-3.5" />Les ventes sont automatiquement limitées à votre compte vendeur.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
      
          <Dialog open={showPayDialog} onOpenChange={o => { if (!o) { setShowPayDialog(false); setSelectedSaleToPay(null); setPaymentsToMake([]); setPaymentFormError("") } }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Payer la dette — {selectedSaleToPay?.code ?? ''}</DialogTitle>
              </DialogHeader>
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (!selectedSaleToPay) return

                const payloadPayments = paymentsToMake
                  .map(p => ({ devise_id: Number(p.devise_id), montant: Number(p.montant) }))
                  .filter(p => Number.isFinite(p.devise_id) && !Number.isNaN(p.montant) && p.montant > 0)

                if (payloadPayments.length === 0) { setPaymentFormError('Saisis au moins un paiement valide'); return }

                setIsSavingPayment(true)
                try {
                  await backendRequest(`/ventes/${selectedSaleToPay.id}/paiements`, { method: 'POST', body: JSON.stringify({ paiements: payloadPayments }) })
                  void fetchSales()
                  setShowPayDialog(false)
                  setSelectedSaleToPay(null)
                  setPaymentsToMake([])
                } catch (ex: unknown) {
                  setPaymentFormError(ex instanceof Error ? ex.message : 'Erreur lors du paiement')
                } finally { setIsSavingPayment(false) }
              }} className="space-y-4">
                {(paymentsToMake.length === 0 ? [{ devise_id: String(devisesList[0]?.id ?? ''), montant: '' }] : paymentsToMake).map((p, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                    <div className="col-span-2">
                      <Label>Devise</Label>
                      <Select value={p.devise_id} onValueChange={v => { void handlePaymentDeviseChange(idx, v) }}>
                        <SelectTrigger><SelectValue placeholder="Choisir une devise" /></SelectTrigger>
                        <SelectContent>
                          {devisesList.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.symbole} {d.code}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Montant</Label>
                        <Input type="number" step="0.01" value={p.montant} onChange={e => setPaymentsToMake(prev => prev.map((r, i) => i === idx ? { ...r, montant: e.target.value } : r))} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {
                            (() => {
                              const saleDevId = Number(selectedSaleToPay?.deviseVente?.id ?? selectedSaleToPay?.lignes?.[0]?.devise?.id ?? 0)
                              const payDevId = Number(p.devise_id)
                              const key = makeRateKey(payDevId, saleDevId)
                              const rate = rateByPair[key]
                              const info = rateInfoByPair[key]

                              if (!saleDevId || !payDevId) return ''
                              if (rate === undefined) return 'Taux: ...'

                              const amt = Number(p.montant) || 0
                              const converted = (amt * rate)
                              return `${converted.toFixed(2)} ${selectedSaleToPay?.deviseVente?.symbole ?? ''}${info ? ' — ' + info : ''}`
                            })()
                          }
                        </p>
                    </div>
                    <div className="col-span-3 flex gap-2">
                      <div className="ml-auto">
                        {paymentsToMake.length > 1 && (
                          <Button variant="destructive" onClick={() => setPaymentsToMake(prev => prev.filter((_, i) => i !== idx))}>Supprimer</Button>
                        )}
                        {idx === paymentsToMake.length - 1 && paymentsToMake.length < 2 && (
                          <Button className="ml-2" onClick={() => setPaymentsToMake(prev => [...prev, { devise_id: String(devisesList[0]?.id ?? ''), montant: '' }])}>Ajouter paiement</Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {paymentFormError && <div className="text-sm text-destructive">{paymentFormError}</div>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setShowPayDialog(false); setPaymentsToMake([]); setSelectedSaleToPay(null) }}>Annuler</Button>
                  <Button type="submit" disabled={isSavingPayment}>{isSavingPayment ? 'En cours...' : 'Payer'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </Tabs>
      </main>

      <div className="hidden md:block">
        <CartSidebar />
      </div>

      <Button
        type="button"
        className="fixed bottom-4 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:hidden"
        size="icon"
        onClick={() => setMobileCartOpen(true)}
        aria-label="Ouvrir le panier"
      >
        <ShoppingCart className="h-5 w-5" />
        {itemCount > 0 && (
          <Badge className="absolute -right-1 -top-1 h-6 min-w-6 rounded-full px-1.5 text-[10px] leading-none">
            {itemCount}
          </Badge>
        )}
      </Button>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="w-[100vw] max-w-sm p-0 sm:w-[88vw]">
          <SheetTitle className="sr-only">Panier mobile</SheetTitle>
          <SheetDescription className="sr-only">
            Consultez les produits ajoutés au panier et passez au paiement.
          </SheetDescription>
          <CartSidebar />
        </SheetContent>
      </Sheet>
    </div>
  )
}
