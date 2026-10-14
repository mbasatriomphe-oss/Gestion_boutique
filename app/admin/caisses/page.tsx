"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Download, Printer, RefreshCw, TrendingDown, Wallet } from "lucide-react"

import { backendRequest } from "@/app/services/backend"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Currency = {
  id: number
  code?: string
  nom?: string
  symbole?: string
}

type CashAccount = {
  id: number
  id_devise: number
  solde: number | string
}

type CashMovement = {
  id?: number
  id_caisse?: number
  type?: string
  montant?: number | string
  reference_type?: string
  reference_id?: number | string | null
  description?: string | null
  date_mouvement?: string | null
  solde_avant?: number | string
  solde_apres?: number | string
  devise_code?: string | null
  utilisateur_nom?: string | null
  utilisateur_prenom?: string | null
}

type ApiEnvelope<T> = {
  data?: T
}

function todayValue() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
}

function monthStartValue() {
  return `${todayValue().slice(0, 8)}01`
}

function money(value: number | string | undefined, currency?: Pick<Currency, "code" | "symbole">) {
  const symbol = currency?.symbole || currency?.code || ""
  return `${symbol}${Number(value ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`
}

function csvCell(value: unknown) {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

export default function AdminCashPage() {
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [dateStart, setDateStart] = useState(monthStartValue())
  const [dateEnd, setDateEnd] = useState(todayValue())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const fetchAccounts = useCallback(async () => {
    const [accountResponse, currencyResponse] = await Promise.all([
      backendRequest<ApiEnvelope<CashAccount[]>>("/caisses?per_page=all"),
      backendRequest<ApiEnvelope<Currency[]>>("/devises?per_page=all"),
    ])
    const loadedAccounts = accountResponse.data ?? []
    setAccounts(loadedAccounts)
    setCurrencies(currencyResponse.data ?? [])
    setAccountId((current) => current || String(loadedAccounts[0]?.id ?? ""))
  }, [])

  const fetchMovements = useCallback(async () => {
    const params = new URLSearchParams({ type: "sortie" })
    if (dateStart) params.set("date_debut", dateStart)
    if (dateEnd) params.set("date_fin", dateEnd)
    const response = await backendRequest<ApiEnvelope<CashMovement[]>>(`/rapports/mouvements-caisse?${params}`)
    setMovements(response.data ?? [])
  }, [dateEnd, dateStart])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      await Promise.all([fetchAccounts(), fetchMovements()])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Impossible de charger les caisses et leurs mouvements.")
    } finally {
      setIsLoading(false)
    }
  }, [fetchAccounts, fetchMovements])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectedAccount = accounts.find((account) => String(account.id) === accountId)
  const selectedCurrency = currencies.find((currency) => currency.id === selectedAccount?.id_devise)
  const cashTotals = useMemo(() => {
    const totals = new Map<string, { label: string; amount: number; count: number }>()
    for (const movement of movements) {
      const code = movement.devise_code || "Devise"
      const total = totals.get(code) ?? { label: code, amount: 0, count: 0 }
      total.amount += Number(movement.montant ?? 0)
      total.count += 1
      totals.set(code, total)
    }
    return Array.from(totals.values())
  }, [movements])

  const submitWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!selectedAccount || !Number.isFinite(numericAmount) || numericAmount <= 0 || !description.trim()) {
      setError("Choisissez une caisse et saisissez un montant positif ainsi que le motif de la sortie.")
      return
    }
    if (numericAmount > Number(selectedAccount.solde)) {
      setError("Le montant de la sortie dépasse le solde disponible dans cette caisse.")
      return
    }

    setIsSaving(true)
    setError("")
    setSuccess("")
    try {
      await backendRequest(`/caisses/${selectedAccount.id}/debit`, {
        method: "POST",
        body: JSON.stringify({
          montant: numericAmount,
          reference_type: "sortie_caisse",
          reference_id: 1,
          description: description.trim(),
        }),
      })
      setAmount("")
      setDescription("")
      setSuccess("La sortie a été enregistrée et le solde de la caisse a été mis à jour.")
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d’enregistrer la sortie de caisse.")
    } finally {
      setIsSaving(false)
    }
  }

  const exportCsv = () => {
    const header = ["Date", "Référence", "Motif", "Devise", "Montant", "Solde avant", "Solde après", "Enregistré par"]
    const rows = movements.map((movement) => [
      movement.date_mouvement,
      movement.reference_id,
      movement.description,
      movement.devise_code,
      movement.montant,
      movement.solde_avant,
      movement.solde_apres,
      [movement.utilisateur_prenom, movement.utilisateur_nom].filter(Boolean).join(" "),
    ])
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `sorties-caisse-${dateStart}-${dateEnd}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-background via-background to-rose-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Gestion financière</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Caisses et sorties</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enregistrez une dépense et consultez les sorties déjà inscrites au journal de caisse.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Actualiser
          </Button>
          <Button variant="outline" onClick={() => window.print()} disabled={movements.length === 0}>
            <Printer className="mr-2 h-4 w-4" />Imprimer le rapport
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={movements.length === 0}>
            <Download className="mr-2 h-4 w-4" />Exporter CSV
          </Button>
        </div>
      </header>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><AlertDescription>{success}</AlertDescription></Alert>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accounts.map((account) => {
          const currency = currencies.find((item) => item.id === account.id_devise)
          return (
            <Card key={account.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="rounded-xl bg-primary/10 p-3 text-primary"><Wallet className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm text-muted-foreground">Solde caisse · {currency?.code || currency?.nom || `#${account.id_devise}`}</p>
                  <p className="text-xl font-bold">{money(account.solde, currency)}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={submitWithdrawal} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.5fr_auto] xl:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="cash-account">Caisse</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="cash-account"><SelectValue placeholder="Choisir une caisse" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => {
                    const currency = currencies.find((item) => item.id === account.id_devise)
                    return <SelectItem key={account.id} value={String(account.id)}>{currency?.symbole || currency?.code || "Devise"} · Solde {money(account.solde, currency)}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cash-amount">Montant de la sortie</Label>
              <Input id="cash-amount" type="number" min="0.01" step="0.01" max={Number(selectedAccount?.solde ?? 0)} value={amount} onChange={(event) => setAmount(event.target.value)} required />
              {selectedAccount && <p className="text-xs text-muted-foreground">Disponible : {money(selectedAccount.solde, selectedCurrency)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cash-description">Motif / bénéficiaire</Label>
              <Input id="cash-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Ex. transport, fournitures, loyer…" required />
            </div>
            <Button type="submit" disabled={isSaving || isLoading || accounts.length === 0}>
              <TrendingDown className="mr-2 h-4 w-4" />{isSaving ? "Enregistrement…" : "Enregistrer la sortie"}
            </Button>
          </form>
          {accounts.length === 0 && !isLoading && <p className="mt-3 text-sm text-amber-700">Aucune caisse n’est configurée. Ajoutez une caisse avant de faire une sortie.</p>}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Rapport des sorties</h2>
            <p className="text-sm text-muted-foreground">Journal issu des mouvements enregistrés en base de données.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cash-date-start">Du</Label>
              <Input id="cash-date-start" type="date" value={dateStart} max={dateEnd} onChange={(event) => setDateStart(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cash-date-end">Au</Label>
              <Input id="cash-date-end" type="date" value={dateEnd} min={dateStart} onChange={(event) => setDateEnd(event.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cashTotals.map((total) => (
            <Card key={total.label}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total des sorties · {total.label}</p>
                <p className="text-2xl font-bold text-rose-700">{money(total.amount, { code: total.label })}</p>
                <p className="text-xs text-muted-foreground">{total.count} mouvement(s)</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Enregistré par</TableHead>
                  <TableHead>Devise</TableHead>
                  <TableHead className="text-right">Montant sorti</TableHead>
                  <TableHead className="text-right">Solde après</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement, index) => (
                  <TableRow key={movement.id ?? `${movement.date_mouvement}-${index}`}>
                    <TableCell>{movement.date_mouvement ? new Date(movement.date_mouvement).toLocaleString("fr-FR") : "—"}</TableCell>
                    <TableCell>{movement.reference_id ?? "—"}</TableCell>
                    <TableCell className="min-w-48">{movement.description || "Sortie de caisse"}</TableCell>
                    <TableCell>{[movement.utilisateur_prenom, movement.utilisateur_nom].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell>{movement.devise_code || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-rose-700">{money(movement.montant, { code: movement.devise_code || "" })}</TableCell>
                    <TableCell className="text-right">{money(movement.solde_apres, { code: movement.devise_code || "" })}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && movements.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Aucune sortie sur la période choisie.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
