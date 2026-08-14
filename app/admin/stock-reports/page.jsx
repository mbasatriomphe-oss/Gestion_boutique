"use client"

import { useEffect, useMemo, useState } from "react"
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
    const costPrice = safeNumber(latestLine?.prix_unitaire, totalReceived > 0 ? totalReceived / Math.max(productLots.length, 1) : 0)
    const retailPrice = safeNumber(latestLine?.prix_vente, costPrice)
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
      minStock,
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

function buildRestockHistory(lots) {
  const grouped = new Map()

  lots.forEach((lot) => {
    const approvisionnement = getRelation(lot, "approvisionnement")
    const fournisseur = approvisionnement?.fournisseur
    const lotCost = safeNumber(getRelation(lot, "ligneApprovisionnement")?.prix_unitaire)
    const quantity = safeNumber(lot.quantite_initial)
    const groupKey = approvisionnement?.id ?? lot.id

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        id: approvisionnement?.code || lot.numero_lot || `RS-${lot.id}`,
        date: formatDate(lot.date_reception),
        products: [],
        totalCost: 0,
        supplier: fournisseur?.nom || "—",
        status: "terminé",
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
      cost: lotCost,
      sourceCurrencyId: getRelation(lot, "devise")?.id ?? lot.id_devise ?? null,
    })
    entry.totalCost += quantity * lotCost
  })

  return Array.from(grouped.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export default function StockReportsPage() {
  const [stockData, setStockData] = useState([])
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
    let cancelled = false

    const loadStockReports = async () => {
      setLoading(true)
      setError(null)

      try {
        const [productsResponse, stocksResponse, lotsResponse, devisesResponse] = await Promise.all([
          backendRequest("/produits?per_page=all"),
          backendRequest("/stocks/disponible"),
          backendRequest("/lots?per_page=all"),
          backendRequest("/devises?per_page=0"),
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
        const sourceCurrencyIds = new Set(
          stockData
            .map((product) => Number(product.sourceCurrencyId))
            .filter((currencyId) => Number.isFinite(currencyId) && currencyId > 0),
        )

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
  }, [selectedCurrencyId, stockData])

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

  return (
    <div className="space-y-6">
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
            Historique Réappro
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
                            <TableCell className="text-right">{product.quantity}</TableCell>
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
  )
}