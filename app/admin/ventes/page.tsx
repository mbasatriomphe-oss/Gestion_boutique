"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle, Boxes, CalendarDays, CheckCircle2, DollarSign,
  Edit, Eye, Filter, History, Layers, Loader2, MoreHorizontal,
  Package, Plus, RefreshCw, Search, ShoppingCart, Trash2,
  TrendingUp, Truck, X
} from "lucide-react"
import { backendRequest } from "@/app/services/backend"
import formatMoney from "@/lib/formatMoney"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Client { id: number; nom: string; post_nom: string; prenom: string }
interface Vendeur { id: number; nom: string; prenom: string; code: string }
interface Devise { id: number; code: string; symbole: string }
interface StockProduit { id: number; code: string; nom: string; stock: number }

interface LigneVente {
  id: number
  id_produit: number
  quantite: number
  prix_vente: string
  id_devise: number
  produit?: { id: number; nom: string; code: string }
  devise?: Devise
}

interface Vente {
  id: number
  code: string
  date: string
  id_vendeur: number
  id_client: number
  devise_vente_id?: number | null
  deviseVente?: Devise | null
  montant_total?: number | string | null
  montant_paye?: number | string | null
  reste_a_payer?: number | string | null
  statut_paiement?: string | null
  vendeur?: Vendeur
  client?: Client
  lignes: LigneVente[]
}

interface ProductSel {
  selected: boolean
  quantite: string
  prix_vente: string
  id_devise: string
}

const getToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fmt(v: string | number | null | undefined) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : "—"
}

function clientName(c?: Client) {
  if (!c) return "—"
  return `${c.prenom} ${c.post_nom} ${c.nom}`.trim()
}

function createSel(): ProductSel {
  return { selected: false, quantite: "", prix_vente: "", id_devise: "" }
}

export default function VentesPage() {
  const [ventes, setVentes] = useState<Vente[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([])
  const [devises, setDevises] = useState<Devise[]>([])
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
      const directResponse = await backendRequest(`/taux/actif?devise_source=${sourceCurrencyId}&devise_but=${targetCurrencyId}${dateParam}`)
      const direct = Number(directResponse.data?.valeur)
      if (Number.isFinite(direct) && direct > 0) return direct
      throw new Error('Taux invalide')
    } catch {
      const reverseResponse = await backendRequest(`/taux/actif?devise_source=${targetCurrencyId}&devise_but=${sourceCurrencyId}${dateParam}`)
      const reverse = Number(reverseResponse.data?.valeur)
      if (!Number.isFinite(reverse) || reverse <= 0) throw new Error('Taux introuvable')
      return 1 / reverse
    }
  }
  const [stocks, setStocks] = useState<StockProduit[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [histSearch, setHistSearch] = useState("")
  const [paymentCurrency, setPaymentCurrency] = useState("all")
  const [filterClient, setFilterClient] = useState("all")
  const [filterVendeur, setFilterVendeur] = useState("all")
  const [filterDate, setFilterDate] = useState("")
  const [filterStartDate, setFilterStartDate] = useState("")
  const [filterEndDate, setFilterEndDate] = useState("")
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null)
  const [storeInfo, setStoreInfo] = useState<any>(null)
  const [prodSearch, setProdSearch] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Vente | null>(null)
  const [selected, setSelected] = useState<Vente | null>(null)
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [paymentsToMake, setPaymentsToMake] = useState<Array<{ devise_id: string; montant: string }>>([])

  const saleCurrencySymbol = (v: Vente) => {
    return v.deviseVente?.symbole ?? v.lignes?.[0]?.devise?.symbole ?? "$"
  }
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [formError, setFormError] = useState("")

  const [formDate, setFormDate] = useState(getToday())
  const [formClient, setFormClient] = useState("")
  const [formVendeur, setFormVendeur] = useState("")
  const [selections, setSelections] = useState<Record<number, ProductSel>>({})

  const fetchLookups = useCallback(async () => {
    const [cRes, vRes, dRes, sRes] = await Promise.all([
      backendRequest<{ data: Client[] }>("/clients?per_page=all"),
      backendRequest<{ data: Vendeur[] }>("/vendeurs?per_page=all"),
      backendRequest<{ data: Devise[] }>("/devises?per_page=all"),
      backendRequest<{ data: Array<{ id: number; code: string; nom: string; stock_actuel?: number | string }> }>("/stocks/disponible"),
      backendRequest('/parametres/facturation').catch(() => ({ data: null })),
      backendRequest('/parametres/boutique').catch(() => ({ data: null })),
    ])
    setClients(cRes.data ?? [])
    setVendeurs(vRes.data ?? [])
    setDevises(dRes.data ?? [])
    setStocks((sRes.data ?? []).map((row) => ({
      id: Number(row.id),
      code: row.code,
      nom: row.nom,
      stock: Number(row.stock_actuel ?? 0),
    })))
    // last two may be invoice/store
    try { const inv = await backendRequest('/parametres/facturation'); setInvoiceSettings(inv.data ?? null) } catch {};
    try { const st = await backendRequest('/parametres/boutique'); setStoreInfo(st.data ?? null) } catch {};
  }, [])

  const fetchVentes = useCallback(async (q = "", paymentFilter = "", clientFilter = "", dateFilter = "", vendeurFilter = "", start = "", end = "") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (q.trim()) params.set("search", q.trim())
      if (paymentFilter && paymentFilter !== 'all') params.set('payment_currency', paymentFilter)
      if (clientFilter && clientFilter !== 'all') params.set('id_client', clientFilter)
      if (vendeurFilter && vendeurFilter !== 'all') params.set('id_vendeur', vendeurFilter)
      if (dateFilter) params.set('date', dateFilter)
      if (start) params.set('date_debut', start)
      if (end) params.set('date_fin', end)
      const res = await backendRequest<{ data: Vente[] }>(`/ventes?${params}`)
      setVentes((res.data ?? []).map(v => ({ ...v, lignes: v.lignes ?? [] })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchLookups(), fetchVentes("", paymentCurrency, filterClient, filterDate, filterVendeur, filterStartDate, filterEndDate)])
  }, [fetchLookups, fetchVentes, paymentCurrency, filterClient, filterDate, filterVendeur, filterStartDate, filterEndDate])

  useEffect(() => {
    const t = setTimeout(() => fetchVentes(histSearch, paymentCurrency, filterClient, filterDate, filterVendeur, filterStartDate, filterEndDate), 300)
    return () => clearTimeout(t)
  }, [histSearch, fetchVentes, paymentCurrency, filterClient, filterDate, filterVendeur])

  useEffect(() => {
    let cancelled = false
    const loadRates = async () => {
      if (!showPayDialog || !selected) return
      const saleDevId = Number(selected.deviseVente?.id ?? selected.lignes?.[0]?.devise?.id ?? 0)
      const needed: Array<[number, number]> = []
      for (const p of paymentsToMake) {
        const payDevId = Number(p.devise_id)
        if (!payDevId || !saleDevId) continue
        const key = makeRateKey(payDevId, saleDevId)
        if (rateByPair[key] === undefined) needed.push([payDevId, saleDevId])
      }
      if (needed.length === 0) return
      const next: Record<string, number> = {}
      const nextInfo: Record<string, string> = {}
      for (const [src, tgt] of needed) {
        try {
          const dateParam = selected?.date ? `&date=${encodeURIComponent(selected.date)}` : ''
          const directResp = await backendRequest(`/taux/actif?devise_source=${src}&devise_but=${tgt}${dateParam}`)
          const directVal = Number(directResp.data?.valeur)
          const key = makeRateKey(src, tgt)
          if (Number.isFinite(directVal) && directVal > 0) {
            next[key] = directVal
            nextInfo[key] = `1 ${devises.find(d => d.id === src)?.code ?? src} = ${directVal} ${devises.find(d => d.id === tgt)?.code ?? tgt}`
            continue
          }

          const reverseResp = await backendRequest(`/taux/actif?devise_source=${tgt}&devise_but=${src}${dateParam}`)
          const reverseVal = Number(reverseResp.data?.valeur)
          if (Number.isFinite(reverseVal) && reverseVal > 0) {
            next[key] = 1 / reverseVal
            nextInfo[key] = `1 ${devises.find(d => d.id === src)?.code ?? src} = ${ (1 / reverseVal).toFixed(8) } ${devises.find(d => d.id === tgt)?.code ?? tgt } (inverse)`
          }
        } catch (e) {
          // leave undefined
        }
      }

      if (!cancelled) {
        if (Object.keys(next).length > 0) setRateByPair(prev => ({ ...prev, ...next }))
        if (Object.keys(nextInfo).length > 0) setRateInfoByPair(prev => ({ ...prev, ...nextInfo }))
      }
    }

    void loadRates()
    return () => { cancelled = true }
  }, [showPayDialog, selected, paymentsToMake])

  // When user changes payment devise, auto-convert the amount to the new currency
  const handlePaymentDeviseChange = async (idx: number, newDeviseId: string) => {
    const newPayDevId = Number(newDeviseId)
    const saleDevId = Number(selected?.deviseVente?.id ?? selected?.lignes?.[0]?.devise?.id ?? 0)

    // Look up or fetch rate: newPayDev → saleDev
    let rate: number | undefined = rateByPair[makeRateKey(newPayDevId, saleDevId)]

    if (rate === undefined && newPayDevId && saleDevId && newPayDevId !== saleDevId) {
      try {
        const dateParam = selected?.date ? `&date=${encodeURIComponent(selected.date)}` : ''
        const directResp = await backendRequest(`/taux/actif?devise_source=${newPayDevId}&devise_but=${saleDevId}${dateParam}`)
        const directVal = Number(directResp.data?.valeur)
        const key = makeRateKey(newPayDevId, saleDevId)
        if (Number.isFinite(directVal) && directVal > 0) {
          rate = directVal
          setRateByPair(prev => ({ ...prev, [key]: rate! }))
          setRateInfoByPair(prev => ({ ...prev, [key]: `1 ${devises.find(d => d.id === newPayDevId)?.code ?? newPayDevId} = ${directVal} ${devises.find(d => d.id === saleDevId)?.code ?? saleDevId}` }))
        } else {
          const reverseResp = await backendRequest(`/taux/actif?devise_source=${saleDevId}&devise_but=${newPayDevId}${dateParam}`)
          const reverseVal = Number(reverseResp.data?.valeur)
          if (Number.isFinite(reverseVal) && reverseVal > 0) {
            rate = 1 / reverseVal
            setRateByPair(prev => ({ ...prev, [key]: rate! }))
            setRateInfoByPair(prev => ({ ...prev, [key]: `1 ${devises.find(d => d.id === newPayDevId)?.code ?? newPayDevId} = ${(1 / reverseVal).toFixed(8)} ${devises.find(d => d.id === saleDevId)?.code ?? saleDevId} (inverse)` }))
          }
        }
      } catch { /* leave undefined */ }
    }

    // Compute suggested amount in the new payment currency:
    // montant_payment × rate(payment→sale) = reste_a_payer  →  montant_payment = reste_a_payer / rate(payment→sale)
    const resteAPayer = Number(selected?.reste_a_payer ?? 0)
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

  const openCreate = () => {
    setEditing(null)
    setFormDate(getToday())
    setFormClient("")
    setFormVendeur("")
    setSelections({})
    setProdSearch("")
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (v: Vente) => {
    setEditing(v)
    setFormDate(v.date)
    setFormClient(String(v.id_client))
    setFormVendeur(String(v.id_vendeur))
    setSelections({})
    setFormError("")
    setShowDialog(true)
  }

  const toggle = (productId: number) => {
    setSelections(prev => {
      const cur = prev[productId] ?? createSel()
      return { ...prev, [productId]: { ...cur, selected: !cur.selected, id_devise: cur.id_devise || (devises[0] ? String(devises[0].id) : "") } }
    })
  }

  const upd = <K extends keyof ProductSel>(productId: number, key: K, val: ProductSel[K]) => {
    setSelections(prev => {
      const cur = prev[productId] ?? createSel()
      return { ...prev, [productId]: { ...cur, [key]: val } }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formClient || !formVendeur) { setFormError("Choisir un client et un vendeur."); return }

    if (!editing) {
      const lignes = stocks
        .map(p => {
          const s = selections[p.id]
          if (!s?.selected) return null
          return { id_produit: p.id, quantite: Number(s.quantite), prix_vente: Number(s.prix_vente), id_devise: Number(s.id_devise) }
        })
        .filter((l): l is { id_produit: number; quantite: number; prix_vente: number; id_devise: number } => l !== null)

      if (lignes.length === 0) { setFormError("Coche au moins un produit."); return }
      const bad = lignes.some(l => !l.quantite || l.quantite <= 0 || !l.prix_vente || l.prix_vente < 0 || !l.id_devise)
      if (bad) { setFormError("Renseigne la quantité, le prix de vente et la devise pour chaque produit coché."); return }

      const stockErr = lignes.find(l => {
        const sp = stocks.find(s => s.id === l.id_produit)
        return sp && Number(sp.stock) < l.quantite
      })
      if (stockErr) {
        const sp = stocks.find(s => s.id === stockErr.id_produit)
        setFormError(`Stock insuffisant pour "${sp?.nom}". Stock disponible: ${sp?.stock}`)
        return
      }

      setIsSaving(true)
      setFormError("")
      try {
        const res = await backendRequest<{ data: Vente }>("/ventes", {
          method: "POST",
          body: JSON.stringify({ date: formDate, id_client: Number(formClient), id_vendeur: Number(formVendeur), lignes }),
        })
        setVentes(prev => [{ ...res.data, lignes: res.data.lignes ?? [] }, ...prev])
        setShowDialog(false)
        fetchVentes("", paymentCurrency, filterClient, filterDate, filterVendeur)
      } catch (ex: unknown) {
        setFormError(ex instanceof Error ? ex.message : "Erreur lors de la création")
      } finally {
        setIsSaving(false)
      }
    } else {
      setIsSaving(true)
      setFormError("")
      try {
        const res = await backendRequest<{ data: Vente }>(`/ventes/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ date: formDate, id_client: Number(formClient), id_vendeur: Number(formVendeur) }),
        })
        setVentes(prev => prev.map(v => v.id === editing.id ? { ...res.data, lignes: res.data.lignes ?? [] } : v))
        setShowDialog(false)
      } catch (ex: unknown) {
        setFormError(ex instanceof Error ? ex.message : "Erreur lors de la modification")
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleDelete = async (v: Vente) => {
    if (!confirm(`Supprimer la vente ${v.code} ?`)) return
    try {
      await backendRequest(`/ventes/${v.id}`, { method: "DELETE" })
      setVentes(prev => prev.filter(x => x.id !== v.id))
      if (selected?.id === v.id) setSelected(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  const filtered = useMemo(() => {
    if (!histSearch.trim()) return ventes
    const q = histSearch.toLowerCase()
    return ventes.filter(v =>
      v.code.toLowerCase().includes(q) ||
      clientName(v.client).toLowerCase().includes(q) ||
      ((`${v.vendeur?.prenom ?? ''} ${v.vendeur?.nom ?? ''}`).toLowerCase().includes(q))
    )
  }, [ventes, histSearch])

  const printSelectedSale = (s: Vente) => {
    const header = storeInfo?.nom || 'Mukingi Accessoir'
    const symbol = invoiceSettings?.symbole_devise || (s.deviseVente?.symbole ?? (s.lignes?.[0]?.devise?.symbole ?? (typeof window !== 'undefined' ? localStorage.getItem('pos_currency_symbol') || '$' : '$')))
    const title = `Facture ${s.code ?? s.id}`
    const rows = (s.lignes ?? []).map(l => `<tr><td>${l.produit?.nom ?? `#${l.id_produit}`}</td><td>${l.quantite}</td><td style="text-align:right">${formatMoney(l.prix_vente, symbol)}</td><td style="text-align:right">${formatMoney(Number(l.quantite) * Number(l.prix_vente), symbol)}</td></tr>`).join('')
    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style>
        </head>
        <body>
          <h2>${header}</h2>
          <p>${invoiceSettings?.adresse || ''}</p>
          <p>Facture N° ${invoiceSettings?.prefixe_facture || ''}-${s.code ?? s.id}</p>
          <p>Date: ${s.date}</p>
          <p>Client: ${clientName(s.client)}</p>
          <table>
            <thead><tr><th>Produit</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <h3>Total: ${formatMoney(s.montant_total ?? s.reste_a_payer ?? 0, symbol)}</h3>
        </body>
      </html>
    `
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      w.print()
    }
  }

  const filteredProds = useMemo(() => {
    if (!prodSearch.trim()) return stocks
    const q = prodSearch.toLowerCase()
    return stocks.filter(p => p.nom.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
  }, [stocks, prodSearch])

  const selectedCount = useMemo(() => stocks.filter(p => selections[p.id]?.selected).length, [stocks, selections])

  const stats = useMemo(() => {
    const totalVentes = ventes.length
    const totalClients = new Set(ventes.map(v => v.id_client)).size
    const totalProduits = ventes.reduce((s, v) => s + (v.lignes?.length ?? 0), 0)
    const totalMontant = ventes.reduce((s, v) => s + (v.lignes ?? []).reduce((ls, l) => ls + Number(l.quantite) * Number(l.prix_vente), 0), 0)
    const totalDette = ventes.reduce((s, v) => s + Number(v.reste_a_payer ?? 0), 0)
    const ventesEnDette = ventes.filter(v => Number(v.reste_a_payer ?? 0) > 0).length
    return { totalVentes, totalClients, totalProduits, totalMontant, totalDette, ventesEnDette }
  }, [ventes])

  const debtByClient = useMemo(() => {
    const grouped = new Map<string, { client: string; amount: number; count: number }>()

    for (const vente of ventes.filter((item) => Number(item.reste_a_payer ?? 0) > 0)) {
      const key = String(vente.id_client)
      const current = grouped.get(key) ?? { client: clientName(vente.client), amount: 0, count: 0 }
      current.amount += Number(vente.reste_a_payer ?? 0)
      current.count += 1
      grouped.set(key, current)
    }

    return Array.from(grouped.values()).sort((left, right) => right.amount - left.amount)
  }, [ventes])

  return (
    <div className="space-y-6 pb-24">
      <div className="rounded-2xl border bg-gradient-to-r from-slate-50 via-white to-green-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Commerce</p>
            <h1 className="text-2xl lg:text-3xl font-bold">Ventes</h1>
            <p className="text-muted-foreground">Enregistrez les ventes et gérez le stock FIFO automatiquement.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fetchVentes(histSearch, paymentCurrency, filterClient, filterDate, filterVendeur)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Actualiser
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />Nouvelle vente
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: ShoppingCart, label: "Ventes", value: stats.totalVentes, bg: "bg-blue-100", text: "text-blue-600" },
          { icon: Truck, label: "Clients actifs", value: stats.totalClients, bg: "bg-amber-100", text: "text-amber-600" },
          { icon: Layers, label: "Lignes produits", value: stats.totalProduits, bg: "bg-emerald-100", text: "text-emerald-600" },
          { icon: DollarSign, label: "Montant total", value: formatMoney(stats.totalMontant), bg: "bg-violet-100", text: "text-violet-600" },
          { icon: DollarSign, label: "Dettes", value: formatMoney(stats.totalDette), bg: "bg-rose-100", text: "text-rose-600" },
          { icon: ShoppingCart, label: "Commandes à crédit", value: stats.ventesEnDette, bg: "bg-orange-100", text: "text-orange-600" },
        ].map(({ icon: Icon, label, value, bg, text }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bg}`}><Icon className={`h-5 w-5 ${text}`} /></div>
                <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="debts">Dettes</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative flex items-center gap-3">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Rechercher par code, client, vendeur..." value={histSearch} onChange={e => setHistSearch(e.target.value)} />
                <div className="ml-auto flex items-center gap-3">
                  <div className="w-40">
                    <Label className="text-xs mb-1 block">Devise paiement</Label>
                    <Select value={paymentCurrency} onValueChange={v => { setPaymentCurrency(v); fetchVentes(histSearch, v, filterClient, filterDate, filterVendeur) }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="franc">Franc</SelectItem>
                      <SelectItem value="dollar">Dollar</SelectItem>
                      <SelectItem value="both">Les deux</SelectItem>
                    </SelectContent>
                    </Select>
                  </div>
                  <div className="w-56">
                    <Label className="text-xs mb-1 block">Client</Label>
                    <Select value={filterClient} onValueChange={v => { setFilterClient(v); fetchVentes(histSearch, paymentCurrency, v, filterDate, filterVendeur) }}>
                      <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="all">Tous</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{clientName(c)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-56">
                    <Label className="text-xs mb-1 block">Vendeur</Label>
                    <Select value={filterVendeur} onValueChange={v => { setFilterVendeur(v); fetchVentes(histSearch, paymentCurrency, filterClient, filterDate, v) }}>
                      <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        <SelectItem value="all">Tous</SelectItem>
                        {vendeurs.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.prenom} {v.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Date début</Label>
                    <Input type="date" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); fetchVentes(histSearch, paymentCurrency, filterClient, filterDate, filterVendeur, e.target.value, filterEndDate) }} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Date fin</Label>
                    <Input type="date" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); fetchVentes(histSearch, paymentCurrency, filterClient, filterDate, filterVendeur, filterStartDate, e.target.value) }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />Aucune vente trouvée.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Vendeur</TableHead>
                      <TableHead>Produits</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Payé</TableHead>
                      <TableHead>Reste</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(v => {
                      const montant = Number(v.montant_total ?? (v.lignes ?? []).reduce((s, l) => s + Number(l.quantite) * Number(l.prix_vente), 0))
                      const montantPaye = Number(v.montant_paye ?? 0)
                      const reste = Number(v.reste_a_payer ?? Math.max(montant - montantPaye, 0))
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs">{v.code}</TableCell>
                          <TableCell>{v.date}</TableCell>
                          <TableCell>{clientName(v.client)}</TableCell>
                          <TableCell>{v.vendeur ? `${v.vendeur.prenom} ${v.vendeur.nom}` : `#${v.id_vendeur}`}</TableCell>
                          <TableCell><Badge variant="secondary">{v.lignes?.length ?? 0}</Badge></TableCell>
                          <TableCell className="font-semibold text-emerald-600">{formatMoney(montant, saleCurrencySymbol(v))}</TableCell>
                          <TableCell className="font-semibold text-blue-600">{formatMoney(montantPaye, saleCurrencySymbol(v))}</TableCell>
                          <TableCell className={reste > 0 ? "font-semibold text-rose-600" : "font-semibold text-emerald-600"}>{formatMoney(reste, saleCurrencySymbol(v))}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelected(v); setShowDetailsDialog(true) }}><Eye className="mr-2 h-4 w-4" />Détails</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(v)}><Edit className="mr-2 h-4 w-4" />Modifier</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(v)}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          {selected ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Détails — {selected.code}</CardTitle>
                  <Badge variant="secondary">{selected.lignes?.length ?? 0} ligne(s)</Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1 pt-1">
                  <p>Client: <span className="font-medium text-foreground">{clientName(selected.client)}</span></p>
                  <p>Vendeur: <span className="font-medium text-foreground">{selected.vendeur ? `${selected.vendeur.prenom} ${selected.vendeur.nom}` : "—"}</span></p>
                  <p>Date: <span className="font-medium text-foreground">{selected.date}</span></p>
                  <p>Payé: <span className="font-medium text-foreground">{formatMoney(selected.montant_paye ?? 0, saleCurrencySymbol(selected))}</span></p>
                  <p>Reste à payer: <span className={`font-medium ${Number(selected.reste_a_payer ?? 0) > 0 ? "text-rose-600" : "text-foreground"}`}>{formatMoney(selected.reste_a_payer ?? 0, saleCurrencySymbol(selected))}</span></p>
                </div>
                {Number(selected.reste_a_payer ?? 0) > 0 && (
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => {
                      const defaultDev = String(selected.deviseVente?.id ?? devises[0]?.id ?? "")
                      setRateByPair({})
                      setRateInfoByPair({})
                      setFormError("")
                      setPaymentsToMake([{ devise_id: defaultDev, montant: String(Number(selected.reste_a_payer ?? 0).toFixed(2)) }])
                      setShowPayDialog(true)
                    }} variant="secondary">Payer dette</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Prix vente</TableHead>
                      <TableHead>Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selected.lignes ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune ligne</TableCell></TableRow>
                    ) : (selected.lignes ?? []).map(l => (
                      <TableRow key={l.id}>
                        <TableCell>{l.produit?.nom ?? `#${l.id_produit}`}</TableCell>
                        <TableCell>{l.quantite}</TableCell>
                          <TableCell>{formatMoney(l.prix_vente, l.devise?.symbole ?? saleCurrencySymbol(selected))}</TableCell>
                          <TableCell className="font-semibold text-emerald-600">{formatMoney(Number(l.quantite) * Number(l.prix_vente), l.devise?.symbole ?? saleCurrencySymbol(selected))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Layers className="h-12 w-12 mx-auto mb-3 opacity-40" />Sélectionne une vente dans l'onglet Historique.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="debts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ventes avec dette</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {debtByClient.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">Aucune dette enregistrée.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Nombre de ventes</TableHead>
                      <TableHead>Dette totale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debtByClient.map((entry) => (
                      <TableRow key={entry.client}>
                        <TableCell>{entry.client}</TableCell>
                        <TableCell><Badge variant="secondary">{entry.count}</Badge></TableCell>
                        <TableCell className="font-semibold text-rose-600">{formatMoney(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={o => !o && setShowDialog(false)}>
        <DialogContent className="max-h-[90vh] flex w-[calc(100vw-1rem)] max-w-4xl flex-col p-4 sm:w-[calc(100vw-2rem)] sm:p-6">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la vente" : "Nouvelle vente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto flex-1 pr-1">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Client *</Label>
                <Select value={formClient} onValueChange={setFormClient}>
                  <SelectTrigger><SelectValue placeholder="Choisir un client" /></SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{clientName(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Vendeur *</Label>
                <Select value={formVendeur} onValueChange={setFormVendeur}>
                  <SelectTrigger><SelectValue placeholder="Choisir un vendeur" /></SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {vendeurs.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.prenom} {v.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editing && (
              <div className="rounded-3xl border bg-gradient-to-br from-muted/50 via-background to-green-50/40 p-4 space-y-4 shadow-sm">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Produits à vendre</p>
                    <Badge variant="secondary">{selectedCount} sélectionné(s)</Badge>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9 rounded-2xl" placeholder="Rechercher un produit..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                </div>
                <div className="overflow-hidden rounded-3xl border bg-background/90">
                  <div className="grid grid-cols-[auto_minmax(0,1.4fr)_minmax(4rem,.7fr)_minmax(5rem,.9fr)_minmax(6rem,.9fr)] gap-3 border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid-cols-[auto_1.4fr_.7fr_.9fr_.9fr]">
                    <span></span>
                    <span>Produit</span>
                    <span>Stock</span>
                    <span>Qté</span>
                    <span>Prix vente</span>
                  </div>
                  <div className="max-h-[42vh] overflow-y-auto">
                    {filteredProds.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">Aucun produit trouvé.</div>
                    ) : filteredProds.map(p => {
                      const sel = selections[p.id] ?? createSel()
                      const stockN = Number(p.stock) || 0
                      const stockOk = !sel.selected || Number(sel.quantite) <= stockN

                      return (
                        <div key={p.id} className={`grid grid-cols-[auto_minmax(0,1.4fr)_minmax(4rem,.7fr)_minmax(5rem,.9fr)_minmax(6rem,.9fr)] items-center gap-3 border-b px-4 py-4 transition-colors last:border-b-0 md:grid-cols-[auto_1.4fr_.7fr_.9fr_.9fr] ${sel.selected ? "bg-green-50/70" : "hover:bg-muted/40"}`}>
                          <Checkbox checked={sel.selected} onCheckedChange={() => toggle(p.id)} disabled={stockN === 0} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.nom}</p>
                            <p className="text-xs font-mono text-muted-foreground">{p.code}</p>
                          </div>
                          <div>
                            <Badge variant={stockN > 5 ? "secondary" : stockN > 0 ? "outline" : "destructive"} className="text-xs">
                              {stockN}
                            </Badge>
                          </div>
                          <Input
                            type="number" min="1" max={stockN} inputMode="numeric"
                            disabled={!sel.selected}
                            value={sel.quantite}
                            onChange={e => upd(p.id, "quantite", e.target.value)}
                            placeholder="0"
                            className={`h-10 rounded-xl ${!stockOk ? "border-destructive" : ""}`}
                          />
                          <Input
                            type="number" min="0" step="0.01" inputMode="decimal"
                            disabled={!sel.selected}
                            value={sel.prix_vente}
                            onChange={e => upd(p.id, "prix_vente", e.target.value)}
                            placeholder="0.00"
                            className="h-10 rounded-xl"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border bg-white/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Le stock FIFO et la caisse sont mis à jour automatiquement à l'enregistrement.</p>
                  <Badge variant="outline" className="rounded-full px-3">Prix décimal</Badge>
                </div>
              </div>
            )}

            {formError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{formError}</AlertDescription></Alert>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Enregistrer" : "Créer la vente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayDialog} onOpenChange={o => !o && setShowPayDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payer la dette — {selected?.code ?? ''}</DialogTitle>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            if (!selected) return
            const saleDevId = Number(selected.deviseVente?.id ?? selected.lignes?.[0]?.devise?.id ?? 0)

            const payloadPayments = paymentsToMake
              .map(p => ({ devise_id: Number(p.devise_id), montant: Number(p.montant) }))
              .filter(p => Number.isFinite(p.devise_id) && !Number.isNaN(p.montant) && p.montant > 0)

            if (payloadPayments.length === 0) { setFormError('Saisis au moins un paiement valide'); return }

            // Validate conversion availability and total converted <= reste_a_payer
            let convertedTotal = 0
            for (const p of payloadPayments) {
              const key = makeRateKey(p.devise_id, saleDevId)
              const rate = rateByPair[key]
              if (rate === undefined) { setFormError(`Taux introuvable pour la paire devise ${p.devise_id} → ${saleDevId}`); return }
              convertedTotal += p.montant * rate
            }

            const reste = Number(selected.reste_a_payer ?? 0)
            if (convertedTotal - reste > 0.01) { setFormError('Le total des paiements convertis dépasse le reste à payer'); return }

            setIsSaving(true)
            try {
              await backendRequest(`/ventes/${selected.id}/paiements`, { method: 'POST', body: JSON.stringify({ paiements: payloadPayments }) })
              // refresh
              fetchVentes(histSearch, paymentCurrency, filterClient, filterDate, filterVendeur)
              setShowPayDialog(false)
              setSelected(null)
              setPaymentsToMake([])
            } catch (ex: unknown) {
              setFormError(ex instanceof Error ? ex.message : 'Erreur lors du paiement')
            } finally { setIsSaving(false) }
          }} className="space-y-4">
            {(paymentsToMake.length === 0 ? [{ devise_id: String(devises[0]?.id ?? ''), montant: '' }] : paymentsToMake).map((p, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2">
                  <Label>Devise</Label>
                  <Select value={p.devise_id} onValueChange={v => { void handlePaymentDeviseChange(idx, v) }}>
                    <SelectTrigger><SelectValue placeholder="Choisir une devise" /></SelectTrigger>
                    <SelectContent>
                      {devises.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.symbole} {d.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Montant</Label>
                  <Input type="number" step="0.01" value={p.montant} onChange={e => setPaymentsToMake(prev => prev.map((r, i) => i === idx ? { ...r, montant: e.target.value } : r))} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {
                      (() => {
                        const saleDevId = Number(selected?.deviseVente?.id ?? selected?.lignes?.[0]?.devise?.id ?? 0)
                        const payDevId = Number(p.devise_id)
                        if (!saleDevId || !payDevId) return ''
                        const key = makeRateKey(payDevId, saleDevId)
                        const rate = rateByPair[key]
                        const info = rateInfoByPair[key]
                        if (rate === undefined) return 'Taux: ...'
                        const amt = Number(p.montant) || 0
                        const converted = amt * rate
                        return `${converted.toFixed(2)} ${selected?.deviseVente?.symbole ?? ''}${info ? ' — ' + info : ''}`
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
                      <Button className="ml-2" onClick={() => setPaymentsToMake(prev => [...prev, { devise_id: String(devises[0]?.id ?? ''), montant: '' }])}>Ajouter paiement</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {formError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{formError}</AlertDescription></Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowPayDialog(false); setPaymentsToMake([]) }}>Annuler</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'En cours...' : 'Payer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailsDialog} onOpenChange={o => { if (!o) { setShowDetailsDialog(false); setSelected(null) } }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl">
          <DialogHeader>
            <DialogTitle>Détails de la vente {selected?.code ?? ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selected ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">{clientName(selected.client)}</p>
                    <p className="text-sm text-muted-foreground mt-2">Vendeur</p>
                    <p className="font-medium">{selected.vendeur ? `${selected.vendeur.prenom} ${selected.vendeur.nom}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{selected.date}</p>
                    <p className="text-sm text-muted-foreground mt-2">Reste à payer</p>
                    <p className={`font-medium ${Number(selected.reste_a_payer ?? 0) > 0 ? 'text-rose-600' : ''}`}>{fmt(selected.reste_a_payer ?? 0)}</p>
                  </div>
                </div>

                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Prix vente</TableHead>
                        <TableHead>Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selected.lignes ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune ligne</TableCell></TableRow>
                      ) : (selected.lignes ?? []).map(l => (
                        <TableRow key={l.id}>
                          <TableCell>{l.produit?.nom ?? `#${l.id_produit}`}</TableCell>
                          <TableCell>{l.quantite}</TableCell>
                          <TableCell>{fmt(l.prix_vente)}</TableCell>
                          <TableCell className="font-semibold text-emerald-600">{(Number(l.quantite) * Number(l.prix_vente)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2">
                  {Number(selected.reste_a_payer ?? 0) > 0 && (
                    <Button onClick={() => {
                      const defaultDev = String(selected.deviseVente?.id ?? devises[0]?.id ?? "")
                      setRateByPair({})
                      setRateInfoByPair({})
                      setFormError("")
                      setPaymentsToMake([{ devise_id: defaultDev, montant: String(Number(selected.reste_a_payer ?? 0).toFixed(2)) }])
                      setShowPayDialog(true);
                      setShowDetailsDialog(false);
                    }}>Payer dette</Button>
                  )}
                  <Button variant="outline" onClick={() => { printSelectedSale(selected); }}>Imprimer</Button>
                  <Button variant="outline" onClick={() => { setShowDetailsDialog(false); setSelected(null) }}>Fermer</Button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">Aucune vente sélectionnée.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
