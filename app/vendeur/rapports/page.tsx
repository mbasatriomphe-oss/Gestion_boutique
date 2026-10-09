"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CreditCard,
  Download,
  FileSpreadsheet,
  PackageSearch,
  RefreshCw,
  ReceiptText,
  Search,
  ShoppingBag,
  UserRound,
  UsersRound,
} from "lucide-react"

import { backendRequest, getBackendBaseUrl, getStoredToken } from "@/app/services/backend"
import { useAuth } from "@/app/context/auth-context"
import formatMoney from "@/lib/formatMoney"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Currency = {
  id?: number
  code?: string
  symbole?: string
}

type SalesReportLine = {
  id: number
  id_produit: number
  quantite: number | string
  prix_vente: number | string
  devise?: Currency | null
  unite?: { nom?: string | null; symbole?: string | null } | null
  produit?: { nom?: string; unite?: { nom?: string | null; symbole?: string | null } | null } | null
}

type ReportSale = {
  id: number
  code?: string | null
  date: string
  created_at?: string | null
  id_client: number
  id_vendeur: number
  montant_total?: number | string | null
  montant_paye?: number | string | null
  reste_a_payer?: number | string | null
  type_paiement?: string | null
  deviseVente?: Currency | null
  devise_vente?: Currency | null
  client?: { nom?: string | null; post_nom?: string | null; prenom?: string | null } | null
  vendeur?: { nom?: string | null; prenom?: string | null } | null
  lignes?: SalesReportLine[] | null
  transactionsCaisses?: ReportPayment[] | null
  transactions_caisses?: ReportPayment[] | null
}

type ReportPayment = {
  id: number
  type?: string | null
  montant?: number | string | null
  description?: string | null
  created_at?: string | null
  caisse?: { devise?: Currency | null } | null
  creator?: { nom?: string | null; prenom?: string | null } | null
}

type ReportType = "ventes" | "produits" | "clients" | "credits" | "encaissements" | "client_sales"

type ReportRow = {
  id: string
  cells: Array<string | number>
}

type CurrencySummary = {
  key: string
  label: string
  sales: number
  total: number
  paid: number
  due: number
}

type SellerReportAuth = {
  user: { role?: string } | null
  isLoading: boolean
}

function clientName(client?: ReportSale["client"]) {
  return [client?.prenom, client?.post_nom, client?.nom].filter(Boolean).join(" ") || "Client comptoir"
}

function saleDate(sale: ReportSale) {
  return sale.date?.slice(0, 10) ?? sale.created_at?.slice(0, 10) ?? ""
}

function displayDate(date: string) {
  const [year, month, day] = date.split("-")
  return year && month && day ? `${day}/${month}/${year}` : date
}

function todayValue() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
}

export default function SellerReportsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth() as SellerReportAuth
  const [sales, setSales] = useState<ReportSale[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [periodType, setPeriodType] = useState<"day" | "range" | "all">("day")
  const [selectedDate, setSelectedDate] = useState(todayValue())
  const [startDate, setStartDate] = useState(todayValue())
  const [endDate, setEndDate] = useState(todayValue())
  const [clientFilter, setClientFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [reportType, setReportType] = useState<ReportType>("ventes")
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv" | null>(null)

  const fetchSales = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    setError("")
    try {
      const response = await backendRequest<{ data?: ReportSale[] }>("/ventes?per_page=all&sort_by=created_at&sort_direction=desc")
      setSales((response.data ?? []).map((sale) => ({ ...sale, lignes: sale.lignes ?? [] })))
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Impossible de charger le rapport des ventes.")
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      router.replace("/admin/reports")
    }
  }, [authLoading, router, user])

  useEffect(() => {
    void fetchSales()
  }, [fetchSales])

  const clients = useMemo(() => {
    const byId = new Map<number, string>()
    for (const sale of sales) byId.set(sale.id_client, clientName(sale.client))
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "fr"))
  }, [sales])

  const filteredSales = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr")
    return sales.filter((sale) => {
      const date = saleDate(sale)
      const isInPeriod = periodType === "day"
        ? date === selectedDate
        : periodType === "range"
          ? (!startDate || date >= startDate) && (!endDate || date <= endDate)
          : true
      const isClient = reportType === "client_sales"
        ? clientFilter !== "all" && String(sale.id_client) === clientFilter
        : clientFilter === "all" || String(sale.id_client) === clientFilter
      const isSearchMatch = !query || [
        sale.code ?? "",
        clientName(sale.client),
        sale.vendeur?.nom ?? "",
        sale.vendeur?.prenom ?? "",
      ].join(" ").toLocaleLowerCase("fr").includes(query)
      return isInPeriod && isClient && isSearchMatch
    })
  }, [clientFilter, endDate, periodType, reportType, sales, search, selectedDate, startDate])

  const currencySummaries = useMemo(() => {
    const summary = new Map<string, CurrencySummary>()
    for (const sale of filteredSales) {
      const currency = sale.deviseVente ?? sale.devise_vente ?? sale.lignes?.[0]?.devise
      const key = String(currency?.id ?? currency?.code ?? currency?.symbole ?? "unknown")
      const value = summary.get(key) ?? {
        key,
        label: currency?.symbole || currency?.code || "Devise inconnue",
        sales: 0,
        total: 0,
        paid: 0,
        due: 0,
      }
      const total = Number(sale.montant_total ?? sale.lignes?.reduce((sum, line) => sum + Number(line.quantite) * Number(line.prix_vente), 0) ?? 0)
      value.sales += 1
      value.total += total
      value.paid += Number(sale.montant_paye ?? Math.max(total - Number(sale.reste_a_payer ?? 0), 0))
      value.due += Number(sale.reste_a_payer ?? 0)
      summary.set(key, value)
    }
    return Array.from(summary.values())
  }, [filteredSales])

  const reportRows = useMemo<ReportRow[]>(() => {
    if (reportType === "client_sales") {
      return filteredSales.flatMap((sale) => {
        const currency = sale.deviseVente ?? sale.devise_vente ?? sale.lignes?.[0]?.devise
        const total = Number(sale.montant_total ?? 0)
        const paid = Number(sale.montant_paye ?? Math.max(total - Number(sale.reste_a_payer ?? 0), 0))
        const lines = sale.lignes?.length ? sale.lignes : [null]

        return lines.map((line, index) => ({
          id: `sale-${sale.id}-line-${line?.id ?? index}`,
          cells: [
            displayDate(saleDate(sale)),
            sale.code || `#${sale.id}`,
            line?.produit?.nom ?? "—",
            line ? Number(line.quantite) : "—",
            line?.unite?.symbole || line?.unite?.nom || line?.produit?.unite?.symbole || line?.produit?.unite?.nom || "—",
            [sale.vendeur?.prenom, sale.vendeur?.nom].filter(Boolean).join(" ") || `#${sale.id_vendeur}`,
            currency?.symbole || currency?.code || "—",
            formatMoney(total, currency?.symbole || currency?.code || ""),
            formatMoney(paid, currency?.symbole || currency?.code || ""),
            formatMoney(sale.reste_a_payer ?? 0, currency?.symbole || currency?.code || ""),
            sale.type_paiement || "—",
          ],
        }))
      })
    }

    if (reportType === "ventes") {
      return filteredSales.map((sale) => {
        const currency = sale.deviseVente ?? sale.devise_vente ?? sale.lignes?.[0]?.devise
        const total = Number(sale.montant_total ?? 0)
        const paid = Number(sale.montant_paye ?? Math.max(total - Number(sale.reste_a_payer ?? 0), 0))
        return {
          id: `sale-${sale.id}`,
          cells: [
            saleDate(sale),
            sale.code || `#${sale.id}`,
            clientName(sale.client),
            [sale.vendeur?.prenom, sale.vendeur?.nom].filter(Boolean).join(" ") || `#${sale.id_vendeur}`,
            sale.lignes?.map((line) => `${line.produit?.nom ?? `Produit #${line.id_produit}`} × ${Number(line.quantite)}`).join(", ") || "—",
            formatMoney(total, currency?.symbole || currency?.code || ""),
            formatMoney(paid, currency?.symbole || currency?.code || ""),
            formatMoney(sale.reste_a_payer ?? 0, currency?.symbole || currency?.code || ""),
          ],
        }
      })
    }

    if (reportType === "credits") {
      return filteredSales
        .filter((sale) => Number(sale.reste_a_payer ?? 0) > 0)
        .map((sale) => {
          const currency = sale.deviseVente ?? sale.devise_vente ?? sale.lignes?.[0]?.devise
          return {
            id: `credit-${sale.id}`,
            cells: [
              saleDate(sale),
              sale.code || `#${sale.id}`,
              clientName(sale.client),
              sale.client?.nom ? "Client enregistré" : "Client comptoir",
              formatMoney(sale.montant_total ?? 0, currency?.symbole || currency?.code || ""),
              formatMoney(sale.montant_paye ?? 0, currency?.symbole || currency?.code || ""),
              formatMoney(sale.reste_a_payer ?? 0, currency?.symbole || currency?.code || ""),
              sale.type_paiement === "avance" ? "Avance" : "Crédit",
            ],
          }
        })
    }

    if (reportType === "produits") {
      const groups = new Map<string, { product: string; currency: Currency | null | undefined; quantity: number; total: number; lines: number }>()
      for (const sale of filteredSales) {
        for (const line of sale.lignes ?? []) {
          const currency = line.devise ?? sale.deviseVente ?? sale.devise_vente
          const key = `${line.id_produit}-${currency?.id ?? currency?.code ?? ""}`
          const group = groups.get(key) ?? {
            product: line.produit?.nom ?? `Produit #${line.id_produit}`,
            currency,
            quantity: 0,
            total: 0,
            lines: 0,
          }
          group.quantity += Number(line.quantite)
          group.total += Number(line.quantite) * Number(line.prix_vente)
          group.lines += 1
          groups.set(key, group)
        }
      }
      return Array.from(groups, ([id, group]) => ({
        id,
        cells: [
          group.product,
          group.currency?.symbole || group.currency?.code || "—",
          group.quantity,
          formatMoney(group.total, group.currency?.symbole || group.currency?.code || ""),
          group.lines,
        ],
      })).sort((a, b) => Number(b.cells[2]) - Number(a.cells[2]))
    }

    if (reportType === "clients") {
      const groups = new Map<string, { name: string; currency: Currency | null | undefined; count: number; total: number; paid: number; due: number }>()
      for (const sale of filteredSales) {
        const currency = sale.deviseVente ?? sale.devise_vente ?? sale.lignes?.[0]?.devise
        const key = `${sale.id_client}-${currency?.id ?? currency?.code ?? ""}`
        const group = groups.get(key) ?? {
          name: clientName(sale.client),
          currency,
          count: 0,
          total: 0,
          paid: 0,
          due: 0,
        }
        const total = Number(sale.montant_total ?? 0)
        group.count += 1
        group.total += total
        group.paid += Number(sale.montant_paye ?? Math.max(total - Number(sale.reste_a_payer ?? 0), 0))
        group.due += Number(sale.reste_a_payer ?? 0)
        groups.set(key, group)
      }
      return Array.from(groups, ([id, group]) => ({
        id,
        cells: [
          group.name,
          group.currency?.symbole || group.currency?.code || "—",
          group.count,
          formatMoney(group.total, group.currency?.symbole || group.currency?.code || ""),
          formatMoney(group.paid, group.currency?.symbole || group.currency?.code || ""),
          formatMoney(group.due, group.currency?.symbole || group.currency?.code || ""),
        ],
      })).sort((a, b) => Number(b.cells[2]) - Number(a.cells[2]))
    }

    return filteredSales.flatMap((sale) => {
      const payments = sale.transactionsCaisses ?? sale.transactions_caisses ?? []
      return payments.map((payment) => {
        const currency = payment.caisse?.devise ?? sale.deviseVente ?? sale.devise_vente
        return {
          id: `payment-${payment.id}`,
          cells: [
            payment.created_at?.replace("T", " ").slice(0, 16) ?? saleDate(sale),
            sale.code || `#${sale.id}`,
            clientName(sale.client),
            payment.type || "Encaissement",
            formatMoney(payment.montant ?? 0, currency?.symbole || currency?.code || ""),
            [payment.creator?.prenom, payment.creator?.nom].filter(Boolean).join(" ") || "—",
            payment.description || "—",
          ],
        }
      })
    })
  }, [filteredSales, reportType])

  const reportColumns: Record<ReportType, string[]> = {
    ventes: ["Date", "Référence", "Client", "Vendeur", "Articles", "Total", "Payé", "Reste dû"],
    produits: ["Produit", "Devise", "Quantité vendue", "Montant vendu", "Nombre de lignes"],
    clients: ["Client", "Devise", "Ventes", "Total acheté", "Payé", "Reste dû"],
    credits: ["Date", "Référence", "Client", "Compte", "Total", "Payé", "Reste dû", "Type"],
    encaissements: ["Date", "Vente", "Client", "Type", "Montant", "Enregistré par", "Description"],
    client_sales: ["Date", "Référence", "Produit", "Quantité", "Unité", "Vendeur", "Devise", "Total", "Payé", "Reste dû", "Type de paiement"],
  }

  const reportTitles: Record<ReportType, string> = {
    ventes: "Détail des ventes",
    produits: "Produits les plus vendus",
    clients: "Achats par client",
    credits: "Crédits à recouvrer",
    encaissements: "Encaissements",
    client_sales: "Ventes d’un client",
  }

  const selectedClientName = clients.find((client) => String(client.id) === clientFilter)?.name
  const reportHeading = reportType === "client_sales" && selectedClientName
    ? `Ventes de ${selectedClientName}`
    : reportTitles[reportType]

  const titlePeriod = periodType === "day"
    ? `Journée du ${displayDate(selectedDate)}`
    : periodType === "range"
      ? `Période du ${startDate ? displayDate(startDate) : "…"} au ${endDate ? displayDate(endDate) : "…"}`
      : "Toutes les périodes"

  const reportParams = useCallback((type: ReportType, format: "pdf" | "csv" | "json") => {
    const params = new URLSearchParams({ type, format })
    if (periodType === "day") {
      params.set("date_debut", selectedDate)
      params.set("date_fin", selectedDate)
    } else if (periodType === "range") {
      if (startDate) params.set("date_debut", startDate)
      if (endDate) params.set("date_fin", endDate)
    }
    if (clientFilter !== "all") params.set("id_client", clientFilter)
    if (search.trim()) params.set("search", search.trim())
    return params
  }, [clientFilter, endDate, periodType, search, selectedDate, startDate])

  const downloadReport = async (format: "pdf" | "csv") => {
    setExportFormat(format)
    setError("")
    const params = reportParams(reportType, format)

    try {
      const token = getStoredToken()
      const response = await fetch(`${getBackendBaseUrl()}/rapports/vendeur/export?${params}`, {
        headers: {
          Accept: format === "pdf" ? "application/pdf" : "text/csv",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!response.ok) {
        let message = `Échec de l’export (HTTP ${response.status}).`
        try {
          const body = await response.json() as { message?: string }
          message = body.message || message
        } catch {
          // Keep the explicit HTTP error when the server does not return JSON.
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `rapport-${reportType}-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Impossible d’exporter le rapport.")
    } finally {
      setExportFormat(null)
    }
  }

  if (authLoading || !user || user.role === "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-muted/30 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border bg-background p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-3" onClick={() => router.push("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />Retour au point de vente
            </Button>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Espace vendeur</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Rapports de ventes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Historique global, activité par période et achats par client.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void fetchSales()} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Actualiser
            </Button>
            <Button variant="outline" onClick={() => void downloadReport("csv")} disabled={isLoading || reportRows.length === 0 || exportFormat !== null || (reportType === "client_sales" && clientFilter === "all")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />{exportFormat === "csv" ? "Export CSV…" : "Exporter CSV"}
            </Button>
            <Button onClick={() => void downloadReport("pdf")} disabled={isLoading || reportRows.length === 0 || exportFormat !== null || (reportType === "client_sales" && clientFilter === "all")}>
              <Download className="mr-2 h-4 w-4" />{exportFormat === "pdf" ? "Export PDF…" : "Exporter PDF"}
            </Button>
          </div>
        </div>

        <div className="hidden print:block">
          <h1 className="text-2xl font-bold">{reportHeading}</h1>
          <p>{titlePeriod}</p>
          <p>Édité le {new Date().toLocaleString("fr-FR")}</p>
        </div>

        {error && (
          <Alert variant="destructive" className="print:hidden">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="print:hidden">
          <CardContent className="space-y-5 p-4 sm:p-5">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]" role="tablist" aria-label="Types de rapports">
              {([
                ["ventes", "Détail des ventes", ReceiptText, "Suivre chaque vente"],
                ["produits", "Produits les plus vendus", PackageSearch, "Classement des articles"],
                ["clients", "Achats par client", UsersRound, "Résumé des clients"],
                ["client_sales", "Ventes d’un client", UserRound, "Historique individuel"],
                ["credits", "Crédits à recouvrer", CreditCard, "Soldes restant dus"],
                ["encaissements", "Encaissements", ShoppingBag, "Paiements enregistrés"],
              ] as const).map(([type, label, Icon, description]) => (
                <Button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={reportType === type}
                  variant={reportType === type ? "default" : "outline"}
                  className={`h-auto min-h-[4.25rem] min-w-44 flex-none justify-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                    reportType === type
                      ? "shadow-md ring-2 ring-primary/20"
                      : "bg-background hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                  }`}
                  onClick={() => setReportType(type)}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    reportType === type ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block whitespace-normal text-xs font-semibold leading-tight sm:text-sm">{label}</span>
                    <span className={`mt-1 block text-[10px] font-normal leading-tight ${
                      reportType === type ? "text-primary-foreground/75" : "text-muted-foreground"
                    }`}>{description}</span>
                  </span>
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-b pb-4">
              <div>
                <p className="text-sm font-semibold">{reportHeading}</p>
                <p className="text-xs text-muted-foreground">
                  {reportType === "client_sales" && clientFilter === "all"
                    ? "Sélectionnez un client pour ouvrir son historique."
                    : "Choisissez une période et consultez les données enregistrées."}
                </p>
              </div>
              <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">{titlePeriod}</Badge>
            </div>
            <div className="grid gap-4 pt-1 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Période du rapport</Label>
              <Select value={periodType} onValueChange={(value) => setPeriodType(value as "day" | "range" | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Rapport journalier</SelectItem>
                  <SelectItem value="range">Période personnalisée</SelectItem>
                  <SelectItem value="all">Toutes les ventes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodType === "day" && (
              <div className="space-y-1.5">
                <Label htmlFor="report-day">Date</Label>
                <Input id="report-day" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </div>
            )}
            {periodType === "range" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="report-start">Du</Label>
                  <Input id="report-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-end">Au</Label>
                  <Input id="report-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label>Achats d’un client</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger><SelectValue placeholder="Tous les clients" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">Tous les clients</SelectItem>
                  {clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {reportType === "client_sales" && clientFilter === "all" && (
                <p className="text-xs text-amber-700">Choisissez un client pour afficher ses ventes individuelles.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-search">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="report-search" className="pl-9" placeholder="Code, client, vendeur…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground print:hidden">
          <CalendarDays className="h-4 w-4" />{titlePeriod}
          {clientFilter !== "all" && <Badge variant="secondary">{clients.find((client) => String(client.id) === clientFilter)?.name}</Badge>}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Chargement des ventes…</div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-blue-100 p-2 text-blue-700"><ShoppingBag className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Nombre de ventes</p><p className="text-2xl font-bold">{filteredSales.length}</p></div></CardContent></Card>
                {currencySummaries.map((summary) => (
                  <Card key={summary.key}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700"><BarChart3 className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Total des ventes ({summary.label})</p>
                        <p className="truncate text-xl font-bold">{formatMoney(summary.total, summary.label)}</p>
                        <p className="text-xs text-muted-foreground">Payé {formatMoney(summary.paid, summary.label)} · Dû {formatMoney(summary.due, summary.label)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </section>

            <Card className="report-table">
              <div className="border-b p-4">
                <h2 className="font-semibold">{reportHeading}</h2>
                <p className="text-sm text-muted-foreground">
                  {titlePeriod}{selectedClientName && reportType === "client_sales" ? ` · Client : ${selectedClientName}` : ""}
                  {" · "}{reportType === "ventes" || reportType === "client_sales" ? `${filteredSales.length} vente(s)` : `${reportRows.length} ligne(s)`} · Données chargées depuis la base de données
                </p>
              </div>
              {reportRows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {reportType === "client_sales" && clientFilter === "all"
                    ? "Choisissez un client pour consulter le détail de ses ventes."
                    : "Aucune donnée ne correspond aux filtres choisis."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {reportColumns[reportType].map((column) => <TableHead key={column}>{column}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportRows.map((row) => (
                        <TableRow key={row.id}>
                          {row.cells.map((cell, index) => (
                            <TableCell key={`${row.id}-${index}`} className={reportType === "ventes" && index === 4 ? "max-w-xs whitespace-normal text-sm" : ""}>
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground print:hidden">
          Les exports PDF et CSV sont générés par le serveur à partir des ventes, articles et encaissements enregistrés en base.
        </p>
        <p className="text-center text-xs text-muted-foreground print:hidden">
          Les rapports de bénéfices sont réservés à l’administration, dans Rapports &gt; Finances.
        </p>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: landscape; margin: 12mm; }
          body { background: #fff !important; }
          .report-table { break-inside: avoid; }
          table { width: 100% !important; }
        }
      `}</style>
    </main>
  )
}
