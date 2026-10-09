"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Printer, RefreshCw, Wallet } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { backendRequest } from "@/app/services/backend"

interface Currency {
  code?: string
  nom?: string
  symbole?: string
}

interface CreditSale {
  id: number
  code?: string
  date?: string
  type_paiement?: "credit" | "avance" | "total" | null
  montant_total?: number | string
  montant_paye?: number | string
  reste_a_payer?: number | string
  deviseVente?: Currency | null
  devise_vente?: Currency | null
  client?: {
    nom?: string
    post_nom?: string | null
    prenom?: string | null
    contact?: string | null
    email?: string | null
  } | null
  vendeur?: {
    nom?: string
    prenom?: string | null
  } | null
}

interface CreditTotalsByCurrency {
  devise?: Currency | null
  nombre_ventes: number
  total_restant: number | string
}

interface CreditReport {
  ventes: CreditSale[]
  nombre_clients: number
  nombre_ventes: number
  totaux_par_devise: CreditTotalsByCurrency[]
}

interface BackendEnvelope<T> {
  status?: string
  message?: string
  data?: T
}

function displayMoney(value: number | string | undefined, currency?: Currency | null) {
  const amount = Number(value ?? 0)
  const symbol = currency?.symbole || currency?.code || ""
  return `${symbol}${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`
}

function customerName(client: CreditSale["client"]) {
  return [client?.nom, client?.post_nom, client?.prenom].filter(Boolean).join(" ") || "Client sans nom"
}

export default function AdminCreditsPage() {
  const [report, setReport] = useState<CreditReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const response = await backendRequest<BackendEnvelope<CreditReport>>("/rapports/credits")
      setReport(response.data ?? { ventes: [], nombre_clients: 0, nombre_ventes: 0, totaux_par_devise: [] })
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Impossible de charger le rapport des crédits.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rapports</p>
          <h1 className="text-2xl font-bold lg:text-3xl">Crédits clients</h1>
          <p className="text-muted-foreground">Suivi des avances et des ventes restant à payer.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchReport()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button onClick={() => window.print()} disabled={!report || report.ventes.length === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </Button>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Rapport des crédits clients</h1>
        <p>Édité le {new Date().toLocaleDateString("fr-FR")}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-700"><Wallet className="h-5 w-5" /></div>
                <div><p className="text-sm text-muted-foreground">Clients endettés</p><p className="text-2xl font-bold">{report.nombre_clients}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-700"><Wallet className="h-5 w-5" /></div>
                <div><p className="text-sm text-muted-foreground">Ventes ouvertes</p><p className="text-2xl font-bold">{report.nombre_ventes}</p></div>
              </CardContent>
            </Card>
            {report.totaux_par_devise.map((summary, index) => (
              <Card key={`${summary.devise?.code ?? "devise"}-${index}`}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Reste dû ({summary.devise?.code ?? summary.devise?.nom ?? "Devise"})</p>
                  <p className="text-2xl font-bold">{displayMoney(summary.total_restant, summary.devise)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Soldes ouverts par client et par vente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground">Chargement du rapport…</div>
              ) : report.ventes.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">Aucun crédit ou solde restant à payer.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[58rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Vente / Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Déjà payé</TableHead>
                        <TableHead className="text-right">Reste dû</TableHead>
                        <TableHead>Vendeur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.ventes.map((sale) => {
                        const currency = sale.deviseVente ?? sale.devise_vente
                        const type = sale.type_paiement ?? (Number(sale.montant_paye ?? 0) > 0 ? "avance" : "credit")
                        return (
                          <TableRow key={sale.id}>
                            <TableCell className="font-medium">{customerName(sale.client)}</TableCell>
                            <TableCell>{sale.client?.contact || sale.client?.email || "—"}</TableCell>
                            <TableCell>
                              <p>{sale.code || `#${sale.id}`}</p>
                              <p className="text-xs text-muted-foreground">{sale.date ? new Date(sale.date).toLocaleDateString("fr-FR") : "—"}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant={type === "credit" ? "destructive" : "secondary"}>
                                {type === "credit" ? "Crédit" : type === "avance" ? "Avance" : "Total"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{displayMoney(sale.montant_total, currency)}</TableCell>
                            <TableCell className="text-right">{displayMoney(sale.montant_paye, currency)}</TableCell>
                            <TableCell className="text-right font-semibold">{displayMoney(sale.reste_a_payer, currency)}</TableCell>
                            <TableCell>{[sale.vendeur?.nom, sale.vendeur?.prenom].filter(Boolean).join(" ") || "—"}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
