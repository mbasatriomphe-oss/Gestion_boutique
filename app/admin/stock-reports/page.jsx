"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileSpreadsheet,
  Download,
  Printer,
  Package,
  Boxes,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Filter,
  ArrowUpDown,
  BarChart3,
  History,
  FileText,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Warehouse,
  ArrowLeft,
  Search,
} from "lucide-react"
import { backendRequest, getBackendBaseUrl, getStoredToken } from "@/app/services/backend"

async function downloadPdf(path, filename) {
  try {
    const base = getBackendBaseUrl()
    const url = `${base}${path}`

    const headers = new Headers()
    headers.set("Accept", "application/pdf")
    const token = getStoredToken()
    let credentials = undefined

    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    } else {
      // fallback to cookie-based auth (Sanctum)
      credentials = "include"
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      credentials,
      keepalive: true,
    })

    if (!res.ok) {
      // If PDF endpoint failed, request a signed public URL from the backend and open it
      try {
        const signedResp = await fetch(`${base}${path.replace(/\.pdf$/, '/signed')}`, {
          method: 'POST',
          headers: new Headers({ 'Authorization': token ? `Bearer ${token}` : '' }),
        })
        if (signedResp.ok) {
          const j = await signedResp.json()
          if (j.url) {
            window.open(j.url, '_blank')
            return
          }
        }
      } catch (e) {
        // fallthrough to show error
      }
      let msg = `Erreur lors du téléchargement: ${res.status}`
      try {
        const text = await res.text()
        if (text) {
          // try parse json message
          try {
            const j = JSON.parse(text)
            msg = j.message || JSON.stringify(j)
          } catch {
            msg = text
          }
        }
      } catch {
        // ignore
      }
      throw new Error(msg)
    }
 
    const blob = await res.blob()
    const link = document.createElement("a")
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (err) {
    console.error(err)
    alert(err.message || "Impossible de télécharger le rapport")
  }
}

const DEFAULT_PRODUCT_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" rx="18" fill="#f3f4f6"/><path d="M30 84h100l-12-28H42L30 84Z" fill="#cbd5e1"/><circle cx="58" cy="52" r="8" fill="#94a3b8"/><circle cx="102" cy="52" r="8" fill="#94a3b8"/><path d="M52 31h56" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/></svg>',
  )

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatDate(value) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().split("T")[0]
}

function getRelation(source, relationName) {
  return source?.[relationName] ?? source?.[relationName.replace(/([A-Z])/g, "_$1").toLowerCase()]
}

function getProductCountUnits(product) {
  const unitsById = new Map()
  const purchaseUnits = getRelation(product, "unitesAchat") ?? []
  const saleUnits = getRelation(product, "unitesVente") ?? []

  for (const unit of [...purchaseUnits, ...saleUnits]) {
    const unitId = Number(unit.id_unite)
    if (!Number.isFinite(unitId) || unitsById.has(unitId)) continue
    unitsById.set(unitId, {
      id: unitId,
      label: unit.unite?.nom ?? unit.unite?.symbole ?? `Unité ${unitId}`,
      factor: safeNumber(unit.facteur, unitId === Number(product.unite_id) ? 1 : 0),
    })
  }

  const baseUnitId = Number(product.unite_id)
  if (Number.isFinite(baseUnitId) && !unitsById.has(baseUnitId)) {
    unitsById.set(baseUnitId, {
      id: baseUnitId,
      label: getRelation(product, "unite")?.nom ?? getRelation(product, "unite")?.symbole ?? "Unité de base",
      factor: 1,
    })
  }

  return Array.from(unitsById.values()).filter(unit => unit.factor > 0)
}

function makeRateKey(sourceCurrencyId, targetCurrencyId) {
  return `${sourceCurrencyId}:${targetCurrencyId}`
}

function getCurrencyLabel(currency, fallback = "") {
  return currency?.symbole || currency?.code || currency?.nom || fallback
}

function resolveRate(rateByPair, sourceCurrencyId, targetCurrencyId) {
  if (!sourceCurrencyId || !targetCurrencyId) {
    return 1
  }

  if (sourceCurrencyId === targetCurrencyId) {
    return 1
  }

  return rateByPair[makeRateKey(sourceCurrencyId, targetCurrencyId)] ?? null
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  if (Array.isArray(payload?.data?.data)) {
    return payload.data.data
  }

  return []
}

function buildInventoryData(products, stocks, lots) {
  const stockByProductId = new Map(stocks.map((item) => [Number(item.id), item]))
  const lotsByProductId = new Map()

  lots.forEach((lot) => {
    const productId = Number(lot.id_produit ?? getRelation(lot, "produit")?.id)
    if (!lotsByProductId.has(productId)) {
      lotsByProductId.set(productId, [])
    }
    lotsByProductId.get(productId).push(lot)
  })

  return products.map((product, index) => {
    const stockRow = stockByProductId.get(Number(product.id))
    const productLots = [...(lotsByProductId.get(Number(product.id)) ?? [])].sort((a, b) => {
      const firstDate = new Date(a.date_reception ?? a.created_at ?? 0).getTime()
      const secondDate = new Date(b.date_reception ?? b.created_at ?? 0).getTime()
      return secondDate - firstDate
    })
    const latestLot = productLots[0]
    const latestLine = getRelation(latestLot, "ligneApprovisionnement")
    const latestApprovisionnement = getRelation(latestLot, "approvisionnement")
    const latestCurrency = getRelation(latestLot, "devise")
    const currentStock = safeNumber(stockRow?.stock_actuel)
    const totalReceived = productLots.reduce((sum, lot) => sum + safeNumber(lot.quantite_initial), 0)
    const purchaseFactor = safeNumber(latestLine?.facteur_conversion, 1)
    const configuredPurchaseUnit = getRelation(product, "unitesAchat")?.[0] ?? getRelation(product, "unites_achat")?.[0]
    const configuredSaleUnits = getRelation(product, "unitesVente") ?? getRelation(product, "unites_vente") ?? []
    const configuredBaseSaleUnit = configuredSaleUnits.find((unit) => Number(unit.id_unite) === Number(product.unite_id))
    const configuredCostPrice = configuredPurchaseUnit?.prix == null ? null : safeNumber(configuredPurchaseUnit.prix) / Math.max(safeNumber(configuredPurchaseUnit.facteur, 1), 0.00000001)
    const legacyCostPrice = totalReceived > 0 ? totalReceived / Math.max(productLots.length, 1) : 0
    const openingLotCost = latestLot?.prix_unitaire_stock
    const costPrice = safeNumber(latestLine?.prix_unitaire_stock, safeNumber(openingLotCost, safeNumber(latestLine?.prix_unitaire, configuredCostPrice ?? legacyCostPrice) / purchaseFactor))
    const retailPrice = safeNumber(configuredBaseSaleUnit?.prix, safeNumber(latestLine?.prix_vente_stock, safeNumber(latestLine?.prix_vente, costPrice * purchaseFactor) / purchaseFactor))
    const alertThreshold = safeNumber(product.seuil_alerte, safeNumber(product.stock_min ?? product.minStock))
    const minStock = Math.max(5, Math.min(20, Math.round(totalReceived * 0.1) || 5))
    const maxStock = Math.max(currentStock + minStock, totalReceived || currentStock + 20)
    const restocksLast30Days = productLots.filter((lot) => {
      const date = new Date(lot.date_reception ?? lot.created_at ?? 0)
      return Number.isFinite(date.getTime()) && date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }).length

    return {
      ...product,
      sku: product.code || `SKU-${String(index + 1).padStart(4, "0")}`,
      name: product.nom || product.name || "Produit",
      category: getRelation(product, "categorie")?.nom || product.categorie_nom || product.category || "Non catégorisé",
      image: product.photo ? `/storage/${product.photo}` : product.image || DEFAULT_PRODUCT_IMAGE,
      sourceCurrencyId: latestCurrency?.id ?? latestLot?.id_devise ?? null,
      sourceCurrencyCode: latestCurrency?.code ?? latestLot?.devise?.code ?? "",
      sourceCurrencySymbol: getCurrencyLabel(latestCurrency, latestLot?.devise?.symbole ?? ""),
      currentStock,
      minStock: product.seuil_alerte == null ? minStock : alertThreshold,
      maxStock,
      costPrice,
      price: retailPrice,
      totalValue: currentStock * costPrice,
      retailValue: currentStock * retailPrice,
      supplier: latestApprovisionnement?.fournisseur?.nom || "—",
      lastRestock: formatDate(latestLot?.date_reception),
      movements: [],
      salesLast30Days: Math.max(0, totalReceived - currentStock),
      restocksLast30Days,
      unitLabel: getRelation(product, "unite")?.symbole || getRelation(product, "unite")?.nom || "",
      lots: productLots,
    }
  })
}

function formatStockQuantity(product) {
  const stock = safeNumber(product.currentStock)
  const purchaseUnit = getRelation(product, "unitesAchat")?.[0] ?? getRelation(product, "unites_achat")?.[0]
  const factor = safeNumber(purchaseUnit?.facteur, 1)
  const purchaseLabel = getRelation(purchaseUnit, "unite")?.symbole || getRelation(purchaseUnit, "unite")?.nom
  const stockLabel = product.unitLabel || "unité"

  if (!purchaseLabel || factor <= 1) {
    return `${stock.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${stockLabel}`
  }

  const packages = Math.floor((stock + 0.00000001) / factor)
  const remainder = Number((stock - packages * factor).toFixed(8))
  const parts = [`${packages} ${packages === 1 ? purchaseLabel : `${purchaseLabel}s`}`]
  if (remainder > 0) parts.push(`${remainder.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${stockLabel}`)
  return parts.join(" + ")
}

function buildRestockHistory(lots) {
  const grouped = new Map()

  lots.forEach((lot) => {
    const approvisionnement = getRelation(lot, "approvisionnement")
    const fournisseur = approvisionnement?.fournisseur
    const procurementLine = getRelation(lot, "ligneApprovisionnement")
    const lotCost = safeNumber(procurementLine?.prix_unitaire, safeNumber(lot.prix_unitaire_stock))
    const quantity = safeNumber(procurementLine?.quantite, safeNumber(lot.quantite_initial))
    const unitLabel = getRelation(procurementLine, "unite")?.symbole || getRelation(lot, "produit")?.unite?.symbole || ""
    const groupKey = approvisionnement?.id ?? lot.id

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        id: approvisionnement?.code || (lot.numero_lot?.startsWith("INIT-") ? "Stock initial" : lot.numero_lot) || `RS-${lot.id}`,
        date: formatDate(lot.date_reception),
        products: [],
        totalCost: 0,
        supplier: fournisseur?.nom || (lot.numero_lot?.startsWith("INIT-") ? "Ouverture du stock" : "—"),
        status: lot.numero_lot?.startsWith("INIT-") ? "stock initial" : "terminé",
        processedBy: approvisionnement?.user ? `${approvisionnement.user.nom ?? ""} ${approvisionnement.user.prenom ?? ""}`.trim() || "Système" : "Système",
        sourceCurrencyId: getRelation(lot, "devise")?.id ?? lot.id_devise ?? null,
        sourceCurrencySymbol: getCurrencyLabel(getRelation(lot, "devise"), ""),
      })
    }

    const entry = grouped.get(groupKey)
    entry.products.push({
      name: getRelation(lot, "produit")?.nom || "Produit",
      sku: getRelation(lot, "produit")?.code || lot.numero_lot || `LOT-${lot.id}`,
      quantity,
      unitLabel,
      cost: lotCost,
      sourceCurrencyId: getRelation(lot, "devise")?.id ?? lot.id_devise ?? null,
    })
    entry.totalCost += quantity * lotCost
  })

  return Array.from(grouped.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export default function StockReportsPage() {
  const [mainView, setMainView] = useState("inventory")
  const [inventoryStep, setInventoryStep] = useState("intro")
  const [inventoryIndex, setInventoryIndex] = useState(0)
  const [inventoryCounts, setInventoryCounts] = useState({})
  const [skippedInventoryProducts, setSkippedInventoryProducts] = useState([])
  const [inventorySaveError, setInventorySaveError] = useState("")
  const [isSavingInventory, setIsSavingInventory] = useState(false)
  const [inventorySearch, setInventorySearch] = useState("")
  const [inventoryFilter, setInventoryFilter] = useState("active")
  const [historySearch, setHistorySearch] = useState("")
  const [showValues, setShowValues] = useState(true)
  const [detailsPeriod, setDetailsPeriod] = useState("30")
  const [salesInPeriod, setSalesInPeriod] = useState([])
  const [stockData, setStockData] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [restockHistory, setRestockHistory] = useState([])
  const [currencyOptions, setCurrencyOptions] = useState([])
  const [selectedCurrencyId, setSelectedCurrencyId] = useState(null)
  const [rateByPair, setRateByPair] = useState({})
  const [selectedReport, setSelectedReport] = useState("sheet")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [sortOrder, setSortOrder] = useState("asc")
  const [dateRange, setDateRange] = useState("30")
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [movementByProduct, setMovementByProduct] = useState({})
  const [movementLoadingByProduct, setMovementLoadingByProduct] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fifoHtml, setFifoHtml] = useState("")
  const [fifoLoading, setFifoLoading] = useState(true)
  const [fifoError, setFifoError] = useState(null)

  useEffect(() => {
    const endDate = new Date()
    const startDate = new Date(endDate)
    if (detailsPeriod === "month") {
      startDate.setDate(1)
    } else if (detailsPeriod === "year") {
      startDate.setMonth(0, 1)
    } else {
      startDate.setDate(startDate.getDate() - Number(detailsPeriod) + 1)
    }
    const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const params = new URLSearchParams({ per_page: "all", date_debut: toDateKey(startDate), date_fin: toDateKey(endDate) })

    backendRequest(`/ventes?${params.toString()}`)
      .then(response => setSalesInPeriod(normalizeRows(response)))
      .catch(() => setSalesInPeriod([]))
  }, [detailsPeriod])

  useEffect(() => {
    let cancelled = false

    const loadStockReports = async () => {
      setLoading(true)
      setError(null)

      try {
        const [productsResponse, stocksResponse, lotsResponse, devisesResponse, movementsResponse] = await Promise.all([
          backendRequest("/produits?per_page=all"),
          backendRequest("/stocks/disponible"),
          backendRequest("/lots?per_page=all"),
          backendRequest("/devises?per_page=0"),
          backendRequest("/mouvements-stock-fifos?per_page=all").catch(() => ({ data: [] })),
        ])

        const products = normalizeRows(productsResponse)
        const stocks = normalizeRows(stocksResponse)
        const lots = normalizeRows(lotsResponse)
        const devises = normalizeRows(devisesResponse)
        const productIndex = new Map(products.map((product) => [Number(product.id), product]))
        const sourceRows = (stocks.length > 0 ? stocks : products).map((row) => ({
          ...productIndex.get(Number(row.id)),
          ...row,
        }))
        const inventory = buildInventoryData(sourceRows, stocks, lots)

        if (!cancelled) {
          setStockData(inventory)
          setStockMovements(normalizeRows(movementsResponse))
          setRestockHistory(buildRestockHistory(lots))
          setCurrencyOptions(devises)
          setSelectedCurrencyId((current) => current ?? devises[0]?.id ?? null)
          setSelectedProduct(null)
        }
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Impossible de charger les données depuis le backend.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadStockReports()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedProduct) {
      setFifoHtml("")
      setFifoError("Sélectionnez un produit pour afficher la fiche FIFO.")
      setFifoLoading(false)
      return
    }

    const loadFifoHtml = async () => {
      setFifoLoading(true)
      setFifoError(null)
      const base = getBackendBaseUrl()
      const params = new URLSearchParams()
      params.set('produit_id', String(selectedProduct))
      if (selectedCurrencyId) {
        params.set('devise_id', String(selectedCurrencyId))
      }
      const url = `${base}/rapports/stock-fifo/html?${params.toString()}`
      const headers = new Headers({ Accept: "text/html" })
      const token = getStoredToken()
      let credentials = undefined

      if (token) {
        headers.set("Authorization", `Bearer ${token}`)
      } else {
        credentials = "include"
      }

      try {
        const res = await fetch(url, {
          method: "GET",
          headers,
          credentials,
        })

        if (!res.ok) {
          throw new Error(`Impossible de charger la fiche FIFO (${res.status})`)
        }

        const html = await res.text()
        setFifoHtml(html)
      } catch (err) {
        setFifoError(err instanceof Error ? err.message : "Impossible de charger la fiche FIFO.")
      } finally {
        setFifoLoading(false)
      }
    }

    loadFifoHtml()
  }, [selectedProduct, selectedCurrencyId])

  useEffect(() => {
    if (!selectedCurrencyId || stockData.length === 0) {
      setRateByPair({})
      return
    }

    let cancelled = false

    const loadRates = async () => {
      try {
        const nextRates = {}
        const response = await backendRequest(`/taux/actif`)
        const rates = normalizeRows(response)
        const sourceCurrencyIds = new Set([
          ...stockData.map((product) => Number(product.sourceCurrencyId)),
          ...salesInPeriod.map((sale) => Number(sale.devise_vente_id ?? sale.deviseVente?.id)),
        ].filter((currencyId) => Number.isFinite(currencyId) && currencyId > 0))

        rates.forEach((rate) => {
          const sourceCurrencyId = Number(rate.devise_source)
          const targetCurrencyId = Number(rate.devise_but)
          const directValue = Number(rate.valeur)

          if (!Number.isFinite(sourceCurrencyId) || !Number.isFinite(targetCurrencyId) || !Number.isFinite(directValue) || directValue <= 0) {
            return
          }

          if (targetCurrencyId === Number(selectedCurrencyId) && sourceCurrencyIds.has(sourceCurrencyId)) {
            nextRates[makeRateKey(sourceCurrencyId, selectedCurrencyId)] = directValue
          }

          if (sourceCurrencyId === Number(selectedCurrencyId) && sourceCurrencyIds.has(targetCurrencyId)) {
            nextRates[makeRateKey(targetCurrencyId, selectedCurrencyId)] = 1 / directValue
          }
        })

        if (!cancelled) {
          setRateByPair(nextRates)
        }
      } catch {
        if (!cancelled) {
          setRateByPair({})
        }
      }
    }

    loadRates()

    return () => {
      cancelled = true
    }
  }, [selectedCurrencyId, stockData, salesInPeriod])

  const selectedCurrency = useMemo(
    () => currencyOptions.find((currency) => Number(currency.id) === Number(selectedCurrencyId)) ?? null,
    [currencyOptions, selectedCurrencyId],
  )

  const selectedCurrencySymbol = getCurrencyLabel(selectedCurrency, "$")

  const valuedStockData = useMemo(() => {
    return stockData.map((product) => {
      const sourceCurrencyId = Number(product.sourceCurrencyId) || null
      const rate = resolveRate(rateByPair, sourceCurrencyId, selectedCurrencyId)
      const displayCostPrice = rate ? product.costPrice * rate : product.costPrice
      const displayPrice = rate ? product.price * rate : product.price
      const displayTotalValue = rate ? product.totalValue * rate : product.totalValue
      const displayRetailValue = rate ? product.retailValue * rate : product.retailValue

      return {
        ...product,
        conversionRate: rate,
        displayCostPrice,
        displayPrice,
        displayTotalValue,
        displayRetailValue,
      }
    })
  }, [stockData, rateByPair, selectedCurrencyId])

  const missingRateCount = useMemo(() => {
    return valuedStockData.filter(
      (product) =>
        Number(product.sourceCurrencyId) > 0 &&
        selectedCurrencyId &&
        Number(product.sourceCurrencyId) !== Number(selectedCurrencyId) &&
        product.conversionRate === null,
    ).length
  }, [valuedStockData, selectedCurrencyId])

    const valuedRestockHistory = useMemo(() => {
      return restockHistory.map((entry) => {
        const entryRate = resolveRate(rateByPair, Number(entry.sourceCurrencyId) || null, selectedCurrencyId)

        const products = entry.products.map((product) => {
          const productRate = resolveRate(rateByPair, Number(product.sourceCurrencyId) || Number(entry.sourceCurrencyId) || null, selectedCurrencyId)
          const convertedCost = productRate ? product.cost * productRate : product.cost

          return {
            ...product,
            displayCost: convertedCost,
          }
        })

        return {
          ...entry,
          products,
          displayTotalCost: entryRate ? entry.totalCost * entryRate : entry.totalCost,
        }
      })
    }, [restockHistory, rateByPair, selectedCurrencyId])

  useEffect(() => {
    if (!selectedProduct || movementByProduct[selectedProduct] || movementLoadingByProduct[selectedProduct]) {
      return
    }

    let cancelled = false

    const loadMovements = async () => {
      setMovementLoadingByProduct((current) => ({ ...current, [selectedProduct]: true }))

      try {
        const response = await backendRequest(`/mouvements-stock-fifos/produit/${selectedProduct}`)
        const movements = normalizeRows(response).map((movement) => ({
          date: formatDate(movement.date_mouvement),
          type: movement.type_mouvement,
          quantity: safeNumber(movement.quantite),
          balance: safeNumber(movement.quantite_restante_apres),
        }))

        if (!cancelled) {
          setMovementByProduct((current) => ({ ...current, [selectedProduct]: movements }))
        }
      } catch {
        if (!cancelled) {
          setMovementByProduct((current) => ({ ...current, [selectedProduct]: [] }))
        }
      } finally {
        if (!cancelled) {
          setMovementLoadingByProduct((current) => ({ ...current, [selectedProduct]: false }))
        }
      }
    }

    loadMovements()

    return () => {
      cancelled = true
    }
  }, [selectedProduct, movementByProduct, movementLoadingByProduct])

  const categoryOptions = useMemo(() => {
    const categories = new Set(stockData.map((product) => product.category).filter(Boolean))
    return Array.from(categories)
  }, [stockData])

  const selectedMovements = selectedProduct ? movementByProduct[selectedProduct] ?? [] : []
  const selectedMovementsLoading = selectedProduct ? Boolean(movementLoadingByProduct[selectedProduct]) : false

  // Calculer les totaux
  const totals = useMemo(() => {
    const filtered = valuedStockData.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false
      if (stockFilter === "low" && p.currentStock > p.minStock) return false
      if (stockFilter === "out" && p.currentStock > 0) return false
      if (stockFilter === "ok" && p.currentStock <= p.minStock) return false
      return true
    })

    return {
      totalProducts: filtered.length,
      totalStock: filtered.reduce((sum, p) => sum + p.currentStock, 0),
      totalCostValue: filtered.reduce((sum, p) => sum + p.displayTotalValue, 0),
      totalRetailValue: filtered.reduce((sum, p) => sum + p.displayRetailValue, 0),
      lowStockItems: filtered.filter((p) => p.currentStock <= p.minStock).length,
      outOfStockItems: filtered.filter((p) => p.currentStock === 0).length,
    }
  }, [valuedStockData, categoryFilter, stockFilter])

  // Filtrer et trier
  const filteredData = useMemo(() => {
    let result = [...valuedStockData]

    if (selectedProduct) {
      result = result.filter((p) => Number(p.id) === Number(selectedProduct))
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category === categoryFilter)
    }

    if (stockFilter === "low") {
      result = result.filter((p) => p.currentStock <= p.minStock && p.currentStock > 0)
    } else if (stockFilter === "out") {
      result = result.filter((p) => p.currentStock === 0)
    } else if (stockFilter === "ok") {
      result = result.filter((p) => p.currentStock > p.minStock)
    }

    result.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })

    return result
  }, [valuedStockData, selectedProduct, categoryFilter, stockFilter, sortBy, sortOrder])

  const visibleMovements = useMemo(() => {
    const rangeDays = Math.max(1, Number(dateRange) || 30)
    const cutoff = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000)

    return selectedMovements.filter((movement) => {
      const movementDate = new Date(movement.date)
      return Number.isFinite(movementDate.getTime()) && movementDate >= cutoff
    })
  }, [dateRange, selectedMovements])

  const getStockBadge = (product) => {
    if (product.currentStock === 0) {
      return <Badge variant="destructive">Rupture</Badge>
    }
    if (product.currentStock <= product.minStock) {
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Stock Faible</Badge>
    }
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">OK</Badge>
  }

  const handlePrint = () => {
    window.print()
  }

  const handleSelectProduct = (productId) => {
    setSelectedProduct((current) => (current === productId ? null : productId))
  }

  const handleExport = () => {
    // Créer le contenu CSV
    let csvContent = "data:text/csv;charset=utf-8,"
    
    if (selectedReport === "sheet") {
      csvContent += `SKU,Produit,Catégorie,Stock Actuel,Stock Mini,Prix Revient (${selectedCurrencySymbol}),Valeur Totale (${selectedCurrencySymbol}),Statut\n`
      filteredData.forEach((p) => {
        csvContent += `${p.sku},${p.name},${p.category},${p.currentStock},${p.minStock},${p.displayCostPrice.toFixed(2)},${p.displayTotalValue.toFixed(2)},${p.currentStock <= p.minStock ? "Faible" : "OK"}\n`
      })
    } else if (selectedReport === "valuation") {
      csvContent += `SKU,Produit,Catégorie,Quantité,Prix Revient (${selectedCurrencySymbol}),Prix Vente (${selectedCurrencySymbol}),Valeur Revient (${selectedCurrencySymbol}),Valeur Vente (${selectedCurrencySymbol})\n`
      filteredData.forEach((p) => {
        csvContent += `${p.sku},${p.name},${p.category},${p.currentStock},${p.displayCostPrice.toFixed(2)},${p.displayPrice.toFixed(2)},${p.displayTotalValue.toFixed(2)},${p.displayRetailValue.toFixed(2)}\n`
      })
    }

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `rapport_stock_${selectedReport}_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatVisibleMoney = (value) => showValues
    ? `${selectedCurrencySymbol} ${safeNumber(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`
    : "••••••"

  const inventoryRows = useMemo(() => {
    const query = inventorySearch.trim().toLocaleLowerCase("fr")
    return valuedStockData
      .filter(product => {
        if (query && !`${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase("fr").includes(query)) return false
        if (inventoryFilter === "active" && product.currentStock <= 0) return false
        if (inventoryFilter === "low" && product.currentStock > product.minStock) return false
        return true
      })
      .sort((left, right) => left.name.localeCompare(right.name, "fr"))
  }, [valuedStockData, inventorySearch, inventoryFilter])

  const historyRows = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase("fr")
    const productsById = new Map(stockData.map(product => [Number(product.id), product]))
    const lotsById = new Map()
    stockData.forEach(product => (product.lots ?? []).forEach(lot => lotsById.set(Number(lot.id), { ...lot, product })))

    return stockMovements.map(movement => {
      const lot = lotsById.get(Number(movement.id_lot))
      const product = lot?.product ?? productsById.get(Number(lot?.id_produit))
      const purchaseLine = getRelation(lot, "ligneApprovisionnement")
      const procurement = getRelation(lot, "approvisionnement")
      const openingStock = String(lot?.numero_lot ?? "").startsWith("INIT-")
      const isReceipt = movement.type_mouvement === "entree"
      const isReturn = movement.type_mouvement === "retour"
      const quantity = isReceipt && purchaseLine ? safeNumber(purchaseLine.quantite, movement.quantite) : safeNumber(movement.quantite)
      const unitLabel = isReceipt && purchaseLine
        ? getRelation(purchaseLine, "unite")?.symbole || getRelation(purchaseLine, "unite")?.nom || product?.unitLabel
        : product?.unitLabel
      const description = openingStock
        ? `Produit créé · stock ${quantity} ${unitLabel ?? ""}`
        : isReceipt
          ? `Reçu +${quantity} ${unitLabel ?? ""}`
          : isReturn
            ? `Retour +${quantity} ${unitLabel ?? ""}`
            : `Vente −${quantity} ${unitLabel ?? ""}`

      return {
        id: movement.id,
        name: product?.name ?? `Produit #${lot?.id_produit ?? "?"}`,
        sku: product?.sku ?? lot?.numero_lot ?? "",
        description,
        date: formatDate(movement.date_mouvement),
        processedBy: procurement?.user ? `${procurement.user.nom ?? ""} ${procurement.user.prenom ?? ""}`.trim() || "Système" : "Système",
        type: openingStock ? "initial" : movement.type_mouvement,
      }
    })
      .filter(row => !query || `${row.name} ${row.sku} ${row.processedBy} ${row.description}`.toLocaleLowerCase("fr").includes(query))
      .sort((left, right) => right.date.localeCompare(left.date) || Number(right.id) - Number(left.id))
  }, [stockMovements, stockData, historySearch])

  const detailValues = useMemo(() => {
    const rangeEnd = new Date()
    const rangeStart = new Date(rangeEnd)
    if (detailsPeriod === "month") rangeStart.setDate(1)
    else if (detailsPeriod === "year") rangeStart.setMonth(0, 1)
    else rangeStart.setDate(rangeStart.getDate() - Number(detailsPeriod) + 1)
    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const startKey = dateKey(rangeStart)
    const endKey = dateKey(rangeEnd)
    let salesRevenue = 0
    let missingSalesRates = 0
    const productsBySales = new Map()

    salesInPeriod.forEach(sale => {
      ;(sale.lignes ?? []).forEach(line => {
        const quantity = safeNumber(line.quantite)
        const price = safeNumber(line.prix_vente)
        const sourceCurrencyId = Number(line.id_devise ?? line.devise?.id ?? sale.devise_vente_id ?? sale.deviseVente?.id) || null
        const rate = resolveRate(rateByPair, sourceCurrencyId, selectedCurrencyId)
        if (rate === null) {
          missingSalesRates += 1
          return
        }

        const lineTotal = quantity * price * rate
        salesRevenue += lineTotal
        const productId = Number(line.id_produit ?? line.produit?.id)
        const productName = line.produit?.nom ?? `Produit #${productId}`
        const current = productsBySales.get(productId) ?? { id: productId, name: productName, quantity: 0, revenue: 0 }
        current.quantity += quantity * safeNumber(line.facteur_conversion, 1)
        current.revenue += lineTotal
        productsBySales.set(productId, current)
      })
    })

    const purchases = valuedRestockHistory
      .filter(entry => entry.status !== "stock initial" && entry.date >= startKey && entry.date <= endKey)
      .reduce((sum, entry) => sum + safeNumber(entry.displayTotalCost), 0)
    const currentCost = valuedStockData.reduce((sum, product) => sum + safeNumber(product.displayTotalValue), 0)
    const currentRetail = valuedStockData.reduce((sum, product) => sum + safeNumber(product.displayRetailValue), 0)
    const topProducts = Array.from(productsBySales.values()).sort((left, right) => right.revenue - left.revenue).slice(0, 3)

    return {
      salesRevenue,
      purchases,
      periodDifference: salesRevenue - purchases,
      currentCost,
      currentRetail,
      currentPotentialProfit: currentRetail - currentCost,
      productCount: valuedStockData.length,
      outOfStock: valuedStockData.filter(product => product.currentStock <= 0).length,
      lowStock: valuedStockData.filter(product => product.currentStock > 0 && product.currentStock <= product.minStock).length,
      noPurchasePrice: valuedStockData.filter(product => product.costPrice <= 0).length,
      topProducts,
      missingSalesRates,
    }
  }, [detailsPeriod, salesInPeriod, rateByPair, selectedCurrencyId, valuedRestockHistory, valuedStockData])

  const countProducts = stockData
  const countProduct = countProducts[inventoryIndex] ?? null
  const countProductFormats = countProduct ? getProductCountUnits(countProduct) : []
  const countProductValues = countProduct ? inventoryCounts[countProduct.id] ?? {} : {}
  const countProductTotal = countProductFormats.reduce((sum, format) => sum + safeNumber(countProductValues[format.id]) * format.factor, 0)
  const countProductHasValues = Object.keys(countProductValues).length > 0
  const inventorySummary = useMemo(() => countProducts.map(product => {
    const formats = getProductCountUnits(product)
    const quantities = inventoryCounts[product.id] ?? {}
    const hasCounted = Object.keys(quantities).length > 0 && !skippedInventoryProducts.includes(product.id)
    const actual = formats.reduce((sum, format) => sum + safeNumber(quantities[format.id]) * format.factor, 0)
    const variance = actual - safeNumber(product.currentStock)
    return { product, hasCounted, actual, variance }
  }), [countProducts, inventoryCounts, skippedInventoryProducts])
  const countedInventorySummary = inventorySummary.filter(item => item.hasCounted)
  const inventoryDiscrepancyCount = countedInventorySummary.filter(item => Math.abs(item.variance) > 0.00000001).length
  const inventorySkippedCount = countProducts.length - countedInventorySummary.length

  const startInventoryCount = () => {
    setInventoryCounts({})
    setSkippedInventoryProducts([])
    setInventoryIndex(0)
    setInventorySaveError("")
    setInventoryStep("count")
    setMainView("counting")
  }

  const goToNextCountProduct = () => {
    if (!countProduct) return
    if (!countProductHasValues) {
      setInventorySaveError("Saisis les quantités comptées ou choisis « Passer ».")
      return
    }
    setInventorySaveError("")
    if (inventoryIndex + 1 >= countProducts.length) setInventoryStep("summary")
    else setInventoryIndex(index => index + 1)
  }

  const skipCountProduct = () => {
    if (!countProduct) return
    setSkippedInventoryProducts(current => current.includes(countProduct.id) ? current : [...current, countProduct.id])
    setInventorySaveError("")
    if (inventoryIndex + 1 >= countProducts.length) setInventoryStep("summary")
    else setInventoryIndex(index => index + 1)
  }

  const saveInventoryCount = async () => {
    const lines = countedInventorySummary.map(({ product }) => ({
      id_produit: Number(product.id),
      formats: getProductCountUnits(product).map(format => ({
        id_unite: format.id,
        quantite: safeNumber(inventoryCounts[product.id]?.[format.id]),
      })),
    }))

    if (lines.length === 0) {
      setInventorySaveError("Compte au moins un produit avant de sauvegarder l'inventaire.")
      return
    }

    setIsSavingInventory(true)
    setInventorySaveError("")
    try {
      await backendRequest("/stocks/inventaire", {
        method: "POST",
        body: JSON.stringify({ lignes: lines }),
      })

      const [productsResponse, stocksResponse, lotsResponse] = await Promise.all([
        backendRequest("/produits?per_page=all"),
        backendRequest("/stocks/disponible"),
        backendRequest("/lots?per_page=all"),
      ])
      const products = normalizeRows(productsResponse)
      const stocks = normalizeRows(stocksResponse)
      const lots = normalizeRows(lotsResponse)
      const productIndex = new Map(products.map(product => [Number(product.id), product]))
      const sourceRows = (stocks.length > 0 ? stocks : products).map(row => ({ ...productIndex.get(Number(row.id)), ...row }))
      setStockData(buildInventoryData(sourceRows, stocks, lots))
      setRestockHistory(buildRestockHistory(lots))
      setInventoryCounts({})
      setSkippedInventoryProducts([])
      setInventoryStep("intro")
      setMainView("inventory")
    } catch (error) {
      setInventorySaveError(error instanceof Error ? error.message : "Impossible de sauvegarder l'inventaire.")
    } finally {
      setIsSavingInventory(false)
    }
  }

  if (mainView === "inventory") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl space-y-5 px-4 py-5 pb-10 sm:px-6">
        <header>
          <h1 className="text-2xl font-bold">Stock</h1>
          <p className="text-sm text-muted-foreground">{detailValues.productCount} produits · {detailValues.lowStock} alerte(s)</p>
        </header>

        <section className="relative overflow-hidden rounded-2xl bg-indigo-600 px-5 py-5 text-white sm:px-7 sm:py-6">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">Valeur du stock</p>
              <p className="mt-2 text-3xl font-bold sm:text-4xl">{formatVisibleMoney(detailValues.currentRetail)}</p>
              <p className="mt-2 text-sm text-indigo-100">{detailValues.productCount} produits · {detailValues.lowStock} alerte(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="text-white hover:bg-white/15 hover:text-white" aria-label={showValues ? "Masquer les montants" : "Afficher les montants"} title={showValues ? "Masquer les montants" : "Afficher les montants"} onClick={() => setShowValues(value => !value)}>
                {showValues ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </Button>
              <Button type="button" variant="ghost" className="text-white hover:bg-white/15 hover:text-white" onClick={() => setMainView("details")}>
                Détails <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <nav className="grid grid-cols-3 gap-2" aria-label="Vues du stock">
          <Button type="button" variant="secondary" className="h-16 flex-col gap-1 bg-amber-50 text-amber-700 hover:bg-amber-100" onClick={startInventoryCount}>
            <Package className="h-5 w-5" />Inventaire
          </Button>
          <Button asChild variant="secondary" className="h-16 flex-col gap-1">
            <Link href="/admin/approvisionnements"><Warehouse className="h-5 w-5" />Recevoir</Link>
          </Button>
          <Button type="button" variant="secondary" className="h-16 flex-col gap-1" onClick={() => setMainView("history")}>
            <History className="h-5 w-5" />Historique
          </Button>
        </nav>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par niveau de stock">
          <Button type="button" size="sm" variant={inventoryFilter === "active" ? "default" : "outline"} onClick={() => setInventoryFilter("active")}>Actifs <span className="ml-1">{valuedStockData.filter(product => product.currentStock > 0).length}</span></Button>
          <Button type="button" size="sm" variant={inventoryFilter === "low" ? "default" : "outline"} onClick={() => setInventoryFilter("low")}>Stock bas <span className="ml-1">{detailValues.lowStock}</span></Button>
          <Button type="button" size="sm" variant={inventoryFilter === "all" ? "default" : "outline"} onClick={() => setInventoryFilter("all")}>Tous <span className="ml-1">{valuedStockData.length}</span></Button>
        </div>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Chercher un produit..." value={inventorySearch} onChange={event => setInventorySearch(event.target.value)} />
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Trier les produits" title="Trier les produits" onClick={() => setSortOrder(order => order === "asc" ? "desc" : "asc")}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        <section className="space-y-3" aria-label="Produits en stock">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Chargement du stock...</div>
          ) : inventoryRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Aucun produit dans cette vue.</div>
          ) : inventoryRows.map(product => (
            <button key={product.id} type="button" onClick={() => { setSelectedProduct(product.id); setMainView("details") }} className="flex w-full items-center gap-3 rounded-2xl border bg-background p-3 text-left shadow-sm transition-colors hover:bg-muted/40 sm:p-4">
              <img src={product.image} alt="" className="h-14 w-14 shrink-0 rounded-full bg-muted object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{product.name}</span>
                <span className="block text-sm text-muted-foreground">{formatVisibleMoney(product.displayPrice)} / {product.unitLabel || "unité"}</span>
                {product.currentStock > 0 && product.currentStock <= product.minStock && <span className="mt-1 block text-xs font-medium text-amber-600">Stock bas</span>}
              </span>
              <span className="shrink-0 text-right font-semibold">{formatStockQuantity(product)}</span>
            </button>
          ))}
        </section>
      </main>
    )
  }

  if (mainView === "counting") {
    if (inventoryStep === "intro") {
      return (
        <main className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col px-4 py-5 sm:px-6">
          <header className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label="Retour au stock" onClick={() => setMainView("inventory")}><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="text-xl font-bold">Inventaire</h1>
          </header>
          <section className="mt-10 rounded-3xl border bg-background px-6 py-9 text-center shadow-sm">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 text-amber-600"><Package className="h-9 w-9" /></span>
            <h2 className="mt-5 text-2xl font-semibold">Compter mon stock</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">Compte les produits un par un et saisis les quantités réellement présentes pour chaque format.</p>
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-amber-50 px-5 py-3 font-semibold text-amber-700">
              <span className="text-2xl">{countProducts.length}</span> produits à compter
            </div>
          </section>
          <div className="mt-auto border-t bg-background py-4">
            <Button type="button" className="h-14 w-full bg-amber-500 text-base hover:bg-amber-600" onClick={() => { setInventoryIndex(0); setInventoryStep(countProducts.length ? "count" : "summary") }}>
              Commencer le comptage <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </main>
      )
    }

    if (inventoryStep === "count" && countProduct) {
      const expectedDescription = formatStockQuantity(countProduct)
      const variance = countProductTotal - safeNumber(countProduct.currentStock)
      const hasDifference = countProductHasValues && Math.abs(variance) > 0.00000001

      return (
        <main className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col px-4 py-5 sm:px-6">
          <header className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label="Retour" onClick={() => inventoryIndex > 0 ? setInventoryIndex(index => index - 1) : setInventoryStep("intro")}><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="text-xl font-bold">Produit {inventoryIndex + 1}/{countProducts.length}</h1>
          </header>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${((inventoryIndex + 1) / Math.max(countProducts.length, 1)) * 100}%` }} />
          </div>

          <section className="mt-5 flex items-center gap-3 rounded-2xl bg-amber-50 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-white">{String(countProduct.name).slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{countProduct.name}</p>
              <p className="text-sm text-muted-foreground">Stock attendu : {expectedDescription}</p>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Quantité réelle comptée par format</h2>
            <div className="divide-y rounded-2xl border bg-background px-4">
              {countProductFormats.map(format => (
                <div key={format.id} className="flex items-center justify-between gap-4 py-4">
                  <label htmlFor={`count-${countProduct.id}-${format.id}`} className="font-medium">{format.label}</label>
                  <input
                    id={`count-${countProduct.id}-${format.id}`}
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    value={countProductValues[format.id] ?? ""}
                    onChange={event => setInventoryCounts(current => ({
                      ...current,
                      [countProduct.id]: { ...(current[countProduct.id] ?? {}), [format.id]: event.target.value },
                    }))}
                    className="h-12 w-32 rounded-xl border-2 border-amber-400 bg-background px-3 text-center text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                </div>
              ))}
            </div>
          </section>

          {countProductHasValues && (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-center font-semibold text-amber-700">
                Total compté : {formatStockQuantity({ ...countProduct, currentStock: countProductTotal })}
              </div>
              <div className={`rounded-xl px-4 py-3 text-center font-semibold ${hasDifference ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                {hasDifference ? `Écart : ${variance > 0 ? "+" : ""}${variance.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${countProduct.unitLabel}` : "Stock correct"}
              </div>
            </div>
          )}

          {inventorySaveError && <p role="alert" className="mt-3 text-sm text-destructive">{inventorySaveError}</p>}
          <footer className="mt-auto flex items-center gap-2 border-t bg-background py-4">
            {inventoryIndex > 0 && <Button type="button" variant="ghost" onClick={() => setInventoryIndex(index => index - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Précédent</Button>}
            <Button type="button" variant="ghost" className="ml-auto" onClick={skipCountProduct}>Passer <ChevronRight className="ml-1 h-4 w-4" /></Button>
            <Button type="button" className="h-12 min-w-36 bg-amber-500 hover:bg-amber-600" onClick={goToNextCountProduct} disabled={!countProductHasValues}>
              {inventoryIndex + 1 === countProducts.length ? "Voir le résumé" : "Suivant"}<ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </footer>
        </main>
      )
    }

    return (
      <main className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col px-4 py-5 sm:px-6">
        <header className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" aria-label="Retour au comptage" onClick={() => { setInventoryStep("count"); setInventoryIndex(Math.max(countProducts.length - 1, 0)) }}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">Résumé inventaire</h1>
        </header>

        <section className="mt-10 space-y-5">
          <h2 className="text-2xl font-semibold">Résumé de l'inventaire</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border bg-background p-4"><p className="text-2xl font-bold">{countedInventorySummary.length}</p><p className="text-sm text-muted-foreground">comptés</p></div>
            <div className="rounded-2xl border bg-background p-4"><p className="text-2xl font-bold">{inventoryDiscrepancyCount}</p><p className="text-sm text-muted-foreground">écarts</p></div>
            <div className="rounded-2xl border bg-background p-4"><p className="text-2xl font-bold">{inventorySkippedCount}</p><p className="text-sm text-muted-foreground">passés</p></div>
          </div>
          {inventoryDiscrepancyCount === 0 && inventorySkippedCount === 0 ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-5 text-center font-semibold text-emerald-700">✓ Tout est en ordre, aucune différence</div>
          ) : (
            <div className="space-y-2">
              {countedInventorySummary.filter(item => Math.abs(item.variance) > 0.00000001).map(({ product, variance }) => (
                <div key={product.id} className="flex justify-between gap-3 rounded-xl border bg-background p-3 text-sm"><span>{product.name}</span><strong className={variance < 0 ? "text-rose-700" : "text-emerald-700"}>{variance > 0 ? "+" : ""}{variance.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} {product.unitLabel}</strong></div>
              ))}
            </div>
          )}
        </section>

        {inventorySaveError && <p role="alert" className="mt-4 text-sm text-destructive">{inventorySaveError}</p>}
        <footer className="mt-auto border-t bg-background py-4">
          <Button type="button" className="h-14 w-full bg-amber-500 text-base hover:bg-amber-600" disabled={isSavingInventory || countedInventorySummary.length === 0} onClick={saveInventoryCount}>
            {isSavingInventory ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Sauvegarde...</> : "Sauvegarder l'inventaire"}
          </Button>
        </footer>
      </main>
    )
  }

  if (mainView === "history") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl space-y-5 px-4 py-5 pb-10 sm:px-6">
        <header className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" aria-label="Retour au stock" onClick={() => setMainView("inventory")}><ArrowLeft className="h-4 w-4" /></Button>
          <div><h1 className="text-xl font-bold">Historique du stock</h1><p className="text-sm text-muted-foreground">Réceptions et stock initial</p></div>
          <Button type="button" variant="ghost" size="icon" className="ml-auto" aria-label={showValues ? "Masquer les montants" : "Afficher les montants"} onClick={() => setShowValues(value => !value)}>
            {showValues ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </Button>
        </header>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Chercher un produit, un fournisseur..." value={historySearch} onChange={event => setHistorySearch(event.target.value)} />
        </div>

        <section className="space-y-3">
          {historyRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Aucun mouvement trouvé.</div>
          ) : historyRows.map((row, index) => (
            <article key={`${row.id}-${row.sku}-${index}`} className="flex items-center gap-3 rounded-2xl border bg-background p-4">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${row.type === "sortie" ? "bg-rose-50 text-rose-600" : row.type === "initial" ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-700"}`}>
                {row.type === "sortie" ? <TrendingDown className="h-5 w-5" /> : row.type === "initial" ? <Package className="h-5 w-5" /> : <Boxes className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{row.name}</p>
                <p className="truncate text-sm text-muted-foreground">{row.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium">{row.processedBy}</p>
                <p className="text-xs text-muted-foreground">{row.date}</p>
              </div>
            </article>
          ))}
        </section>
      </main>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-5xl space-y-4 px-1 sm:px-0">
        <header className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" aria-label="Retour au stock" onClick={() => setMainView("inventory")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">Valeur du stock</h1>
            <p className="text-sm text-muted-foreground">Inventaire actuel · {selectedCurrency?.nom ?? "Boutique"}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={showValues ? "Masquer les montants" : "Afficher les montants"} title={showValues ? "Masquer les montants" : "Afficher les montants"} onClick={() => setShowValues(value => !value)}>
            {showValues ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </Button>
        </header>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Afficher les montants en</span>
          <Select value={selectedCurrencyId ? String(selectedCurrencyId) : ""} onValueChange={value => setSelectedCurrencyId(Number(value))}>
            <SelectTrigger className="w-40" aria-label="Devise de valorisation"><SelectValue placeholder="Devise" /></SelectTrigger>
            <SelectContent>
              {currencyOptions.map(currency => <SelectItem key={currency.id} value={String(currency.id)}>{currency.code || currency.symbole || currency.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <section className="relative overflow-hidden rounded-2xl bg-indigo-600 px-5 py-5 text-white sm:px-7 sm:py-6">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">Valeur du stock</p>
          <p className="relative mt-2 text-3xl font-bold sm:text-4xl">{formatVisibleMoney(detailValues.currentRetail)}</p>
          <p className="relative mt-2 text-sm text-indigo-100">{detailValues.productCount} produits</p>
        </section>

        <section className="rounded-2xl border bg-background p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valorisation</h2>
          <div className="mt-3 divide-y">
            <div className="flex items-center justify-between gap-4 py-3"><span>Au prix de vente</span><strong>{formatVisibleMoney(detailValues.currentRetail)}</strong></div>
            <div className="flex items-center justify-between gap-4 py-3"><span>Au prix d'achat</span><strong>{formatVisibleMoney(detailValues.currentCost)}</strong></div>
            <div className="flex items-center justify-between gap-4 border-t py-3 text-emerald-700"><span className="font-semibold">Bénéfice potentiel</span><strong>{formatVisibleMoney(detailValues.currentPotentialProfit)}</strong></div>
          </div>
        </section>

        <section className="rounded-2xl border bg-background p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">État du stock</h2>
          <div className="mt-3 divide-y">
            <div className="flex items-center justify-between py-3"><span>Produits</span><strong>{detailValues.productCount}</strong></div>
            <div className="flex items-center justify-between py-3"><span>En rupture</span><strong>{detailValues.outOfStock}</strong></div>
            <div className="flex items-center justify-between py-3"><span>Stock bas</span><strong className="text-amber-600">{detailValues.lowStock}</strong></div>
            <div className="flex items-center justify-between py-3"><span>Sans prix d'achat</span><strong>{detailValues.noPurchasePrice}</strong></div>
          </div>
        </section>

        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Période d'activité">
          {[["7", "7 jours"], ["30", "30 jours"], ["month", "Ce mois"], ["year", "Cette année"]].map(([value, label]) => (
            <Button key={value} type="button" size="sm" className="px-2 text-xs sm:text-sm" variant={detailsPeriod === value ? "default" : "outline"} onClick={() => setDetailsPeriod(value)}>{label}</Button>
          ))}
        </div>

        <section className="rounded-2xl border bg-background p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activité</h2>
          <div className="mt-3 divide-y">
            <div className="flex items-center justify-between gap-4 py-3"><span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-emerald-600" />Ventes (CA)</span><strong>{formatVisibleMoney(detailValues.salesRevenue)}</strong></div>
            <div className="flex items-center justify-between gap-4 py-3"><span className="flex items-center gap-2"><Boxes className="h-4 w-4 text-amber-600" />Achats reçus</span><strong>{formatVisibleMoney(detailValues.purchases)}</strong></div>
            <div className="flex items-center justify-between gap-4 py-3"><span>Ventes − achats</span><strong>{formatVisibleMoney(detailValues.periodDifference)}</strong></div>
          </div>
          {detailValues.missingSalesRates > 0 && <p className="mt-2 text-xs text-amber-700">Taux manquant pour {detailValues.missingSalesRates} ligne(s) de vente.</p>}
        </section>

        <section className="rounded-2xl border bg-background p-4 sm:p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Produits les plus vendus</h2>
          <div className="mt-3 divide-y">
            {detailValues.topProducts.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Aucune vente sur cette période.</p>
            ) : detailValues.topProducts.map((product, index) => (
              <div key={product.id} className="flex items-center gap-3 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.quantity.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} vendus</p></div>
                <strong className="shrink-0 text-emerald-700">{formatVisibleMoney(product.revenue)}</strong>
              </div>
            ))}
          </div>
        </section>

        <Button type="button" variant="outline" className="w-full" onClick={() => setMainView("reports")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />Rapports FIFO et exports
        </Button>
      </div>

      {mainView === "reports" && !showValues && (
        <section className="mx-auto w-full max-w-5xl rounded-2xl border bg-background p-5 text-center">
          <p className="text-sm text-muted-foreground">Les chiffres sont masqués. Affiche-les pour consulter les rapports et exports détaillés.</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => setShowValues(true)}><Eye className="mr-2 h-4 w-4" />Afficher les montants</Button>
        </section>
      )}

      <div className={mainView === "reports" && showValues ? "space-y-6" : "hidden"}>
      <Button type="button" variant="ghost" className="print:hidden" onClick={() => setMainView("details")}>
        <ArrowLeft className="mr-2 h-4 w-4" />Retour aux détails du stock
      </Button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rapports de Stock</h1>
          <p className="text-muted-foreground">
            Fiches de stock complètes et rapports d'inventaire
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
          <Button size="sm" onClick={async () => await downloadPdf(`/rapports/ventes/pdf`, "ventes.pdf")}>
            <Download className="w-4 h-4 mr-2" /> Télécharger Ventes (PDF)
          </Button>
          <Button size="sm" onClick={async () => await downloadPdf(`/rapports/stock/pdf`, "stock.pdf")}> 
            <Download className="w-4 h-4 mr-2" /> Télécharger Stock (PDF)
          </Button>
          <Button size="sm" disabled={!selectedProduct} onClick={async () => {
            const query = selectedProduct ? `?produit_id=${selectedProduct}&devise_id=${selectedCurrencyId}` : ''
            const name = `stock_fifo_produit_${selectedProduct}.pdf`
            await downloadPdf(`/rapports/stock-fifo/pdf${query}`, name)
          }}>
            <Download className="w-4 h-4 mr-2" /> Télécharger fiche FIFO produit (PDF)
          </Button>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Chargement des stocks depuis le backend...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 print:hidden">
          <CardContent className="p-6 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      {missingRateCount > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 print:hidden">
          <CardContent className="p-6 text-sm text-amber-800 dark:text-amber-200">
            {missingRateCount} produit(s) n'ont pas encore de taux actif vers {selectedCurrencySymbol}. Les montants concernés restent affichés dans leur devise source.
          </CardContent>
        </Card>
      )}

      {/* Cartes de résumé */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs text-muted-foreground">Produits</p>
                <p className="text-xl font-bold text-foreground">{totals.totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs text-muted-foreground">Stock Total</p>
                <p className="text-xl font-bold text-foreground">{totals.totalStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-xs text-muted-foreground">Valeur Revient ({selectedCurrencySymbol})</p>
                <p className="text-xl font-bold text-foreground">{selectedCurrencySymbol} {totals.totalCostValue.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <div>
                <p className="text-xs text-muted-foreground">Valeur Vente ({selectedCurrencySymbol})</p>
                <p className="text-xl font-bold text-foreground">{selectedCurrencySymbol} {totals.totalRetailValue.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-xs text-muted-foreground">Stock Faible</p>
                <p className="text-xl font-bold text-foreground">{totals.lowStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-xs text-muted-foreground">Rupture</p>
                <p className="text-xl font-bold text-foreground">{totals.outOfStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets des rapports */}
      <Tabs value={selectedReport} onValueChange={setSelectedReport} className="space-y-4">
        <TabsList className="print:hidden">
          <TabsTrigger value="sheet">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Fiche de Stock
          </TabsTrigger>
          <TabsTrigger value="movements">
            <History className="h-4 w-4 mr-2" />
            Mouvements
          </TabsTrigger>
          <TabsTrigger value="lowstock">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alertes Stock Faible
          </TabsTrigger>
          <TabsTrigger value="valuation">
            <DollarSign className="h-4 w-4 mr-2" />
            Évaluation Stock
          </TabsTrigger>
          <TabsTrigger value="restock-history">
            <FileText className="h-4 w-4 mr-2" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Filtres - partagés entre les onglets */}
        <Card className="print:hidden">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes Catégories</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Niveau Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout Stock</SelectItem>
                  <SelectItem value="low">Stock Faible</SelectItem>
                  <SelectItem value="out">Rupture</SelectItem>
                  <SelectItem value="ok">En Stock</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Derniers Jours</SelectItem>
                  <SelectItem value="30">30 Derniers Jours</SelectItem>
                  <SelectItem value="90">90 Derniers Jours</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedCurrencyId ? String(selectedCurrencyId) : ""}
                onValueChange={(value) => setSelectedCurrencyId(Number(value))}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Devise" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((currency) => (
                    <SelectItem key={currency.id} value={String(currency.id)}>
                      {currency.code || currency.symbole || currency.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

                  <Select
                value={selectedProduct ? String(selectedProduct) : "all"}
                onValueChange={(value) => setSelectedProduct(value === "all" ? null : Number(value))}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Produit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Choisir un produit</SelectItem>
                  {stockData.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rapport Fiche de Stock */}
        <TabsContent value="sheet">
          <Card>
            <CardHeader>
              <CardTitle>Fiche de Stock</CardTitle>
              <CardDescription>
                Vue FIFO des entrées, sorties et stocks par lot
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fifoLoading ? (
                <div className="p-6 text-sm text-muted-foreground">Chargement de la fiche FIFO...</div>
              ) : fifoError ? (
                <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 print:hidden">
                  <CardContent className="p-6 text-sm text-amber-800 dark:text-amber-200">{fifoError}</CardContent>
                </Card>
              ) : fifoHtml ? (
                <>
                  <div className="overflow-x-auto">
                    <div dangerouslySetInnerHTML={{ __html: fifoHtml }} />
                  </div>
                  <div className="flex justify-end mt-4 print:hidden">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!selectedProduct}
                      onClick={async () => {
                        const query = selectedProduct ? `?produit_id=${selectedProduct}&devise_id=${selectedCurrencyId}` : ''
                        const name = `stock_fifo_produit_${selectedProduct}.pdf`
                        await downloadPdf(`/rapports/stock-fifo/pdf${query}`, name)
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exporter la fiche FIFO en PDF
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">
                  Sélectionnez un produit pour afficher sa fiche de stock FIFO et pouvoir l'exporter en PDF.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rapport Mouvements de Stock */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Mouvements de Stock</CardTitle>
              <CardDescription>Suivi des entrées et sorties d'inventaire</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredData.map((product) => (
                  <div key={product.id} className="border rounded-lg p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => handleSelectProduct(product.id)}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.sku}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Mouvements récents</p>
                          <div className="flex gap-2">
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              -{product.salesLast30Days} sorties
                            </Badge>
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              +{product.restocksLast30Days} lots
                            </Badge>
                          </div>
                        </div>
                        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    {selectedProduct === product.id && (
                      <div className="mt-4 border-t pt-4">
                        {selectedMovementsLoading ? (
                          <div className="py-4 text-sm text-muted-foreground">
                            Chargement des mouvements...
                          </div>
                        ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Quantité</TableHead>
                              <TableHead className="text-right">Solde</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleMovements.slice(0, 5).map((movement, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{movement.date}</TableCell>
                                <TableCell>
                                  <Badge
                                    className={
                                      movement.type === "sortie"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    }
                                  >
                                    {movement.type === "sortie"
                                      ? "Sortie"
                                      : movement.type === "retour"
                                        ? "Retour"
                                        : "Entrée"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {movement.type === "sortie" ? "-" : "+"}
                                  {movement.quantity}
                                </TableCell>
                                <TableCell className="text-right">{movement.balance}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alertes Stock Faible */}
        <TabsContent value="lowstock">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Alertes Stock Faible
              </CardTitle>
              <CardDescription>Produits nécessitant un réapprovisionnement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredData
                  .filter((p) => p.currentStock <= p.minStock)
                  .sort((a, b) => a.currentStock - b.currentStock)
                  .map((product) => (
                    <div
                      key={product.id}
                      className={`p-4 rounded-lg border-2 ${
                        product.currentStock === 0
                          ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
                          : "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <div>
                            <p className="font-semibold text-foreground">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {product.sku} | {product.supplier}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            product.currentStock === 0 ? "text-red-600" : "text-amber-600"
                          }`}>
                            {product.currentStock}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            sur {product.minStock} min
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Commande Suggérée</p>
                          <p className="text-lg font-bold text-foreground">
                            {product.maxStock - product.currentStock}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                {filteredData.filter((p) => p.currentStock <= p.minStock).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune alerte stock faible. Tous les produits sont bien approvisionnés.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rapport Évaluation des Stocks */}
        <TabsContent value="valuation">
          <Card>
            <CardHeader>
              <CardTitle>Évaluation des Stocks</CardTitle>
              <CardDescription>Valeur financière de l'inventaire actuel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-center">Quantité</TableHead>
                      <TableHead className="text-right">Prix Revient ({selectedCurrencySymbol})</TableHead>
                      <TableHead className="text-right">Prix Vente ({selectedCurrencySymbol})</TableHead>
                      <TableHead className="text-right">Valeur Revient ({selectedCurrencySymbol})</TableHead>
                      <TableHead className="text-right">Valeur Vente ({selectedCurrencySymbol})</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((product) => {
                      const margin = ((product.displayPrice - product.displayCostPrice) / product.displayPrice) * 100
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                          <TableCell className="font-medium text-foreground">{product.name}</TableCell>
                          <TableCell className="capitalize">{product.category}</TableCell>
                          <TableCell className="text-center">{product.currentStock}</TableCell>
                          <TableCell className="text-right">{selectedCurrencySymbol} {product.displayCostPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{selectedCurrencySymbol} {product.displayPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{selectedCurrencySymbol} {product.displayTotalValue.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">{selectedCurrencySymbol} {product.displayRetailValue.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                              {margin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Résumé de l'évaluation */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Valeur Totale Revient ({selectedCurrencySymbol})</p>
                    <p className="text-2xl font-bold text-foreground">
                        {selectedCurrencySymbol} {totals.totalCostValue.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Valeur Totale Vente ({selectedCurrencySymbol})</p>
                    <p className="text-2xl font-bold text-foreground">
                        {selectedCurrencySymbol} {totals.totalRetailValue.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Profit Potentiel</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {selectedCurrencySymbol} {(totals.totalRetailValue - totals.totalCostValue).toFixed(2)}
                      </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historique des Réapprovisionnements */}
        <TabsContent value="restock-history">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Réapprovisionnements</CardTitle>
              <CardDescription>Enregistrement de toutes les activités de réapprovisionnement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {valuedRestockHistory.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">Commande #{entry.id}</p>
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {entry.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          {entry.date} | {entry.supplier} | Traité par : {entry.processedBy}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Coût Total ({selectedCurrencySymbol})</p>
                        <p className="text-xl font-bold text-foreground">{selectedCurrencySymbol} {entry.displayTotalCost.toFixed(2)}</p>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Produit</TableHead>
                          <TableHead className="text-right">Quantité</TableHead>
                          <TableHead className="text-right">Prix Unitaire</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entry.products.map((product, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                            <TableCell>{product.name}</TableCell>
                            <TableCell className="text-right">{product.quantity} {product.unitLabel}</TableCell>
                            <TableCell className="text-right">{selectedCurrencySymbol} {product.displayCost.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {selectedCurrencySymbol} {(product.quantity * product.displayCost).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* En-tête d'impression - visible uniquement lors de l'impression */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">Rapport de Stock</h1>
        <p className="text-sm">Généré : {new Date().toLocaleString()}</p>
      </div>
      </div>
    </div>
  )
}

