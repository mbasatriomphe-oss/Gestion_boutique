"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Loader2, Package, RefreshCw, Search, CalendarDays } from "lucide-react"
import { backendRequest } from "@/app/services/backend"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Devise {
  id: number
  code: string
  symbole: string
}

interface Produit {
  id: number
  nom: string
  code: string
}

interface Approvisionnement {
  id: number
  code: string
}

interface LotRaw {
  id: number
  numero_lot: string
  id_produit: number
  id_approvisionnement: number
  id_ligne_approvisionnement: number
  quantite_initial: number
  date_reception: string
  date_expiration: string | null
  id_devise: number
  produit?: Produit
  approvisionnement?: Approvisionnement
  devise?: Devise
}

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("fr-FR") : "—"

export default function LotsPage() {
  const [lots, setLots] = useState<LotRaw[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [approvisionnements, setApprovisionnements] = useState<Approvisionnement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [selectedProduit, setSelectedProduit] = useState("all")
  const [selectedApprovisionnement, setSelectedApprovisionnement] = useState("all")

  const fetchLookups = useCallback(async () => {
    const [produitsRes, approRes] = await Promise.all([
      backendRequest<{ data: Produit[] }>("/produits?per_page=all"),
      backendRequest<{ data: Approvisionnement[] }>("/approvisionnements?per_page=all"),
    ])
    setProduits(produitsRes.data ?? [])
    setApprovisionnements(approRes.data ?? [])
  }, [])

  const fetchLots = useCallback(async (search = "", produit = "all", appro = "all") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (search.trim()) params.set("search", search.trim())
      if (produit !== "all") params.set("id_produit", produit)
      if (appro !== "all") params.set("id_approvisionnement", appro)
      const res = await backendRequest<{ data: LotRaw[] }>(`/lots?${params.toString()}`)
      setLots(res.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([fetchLookups(), fetchLots()])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur de chargement")
      }
    })()
  }, [fetchLookups, fetchLots])

  useEffect(() => {
    const timer = setTimeout(() => fetchLots(searchInput, selectedProduit, selectedApprovisionnement), 300)
    return () => clearTimeout(timer)
  }, [searchInput, selectedProduit, selectedApprovisionnement, fetchLots])

  const totalQuantity = lots.reduce((acc, lot) => acc + (lot.quantite_initial || 0), 0)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-r from-slate-50 via-white to-cyan-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stock FIFO</p>
            <h1 className="text-2xl lg:text-3xl font-bold">Lots</h1>
            <p className="text-muted-foreground">Suivi automatique des lots créés après les approvisionnements.</p>
          </div>
          <Button variant="outline" onClick={() => fetchLots(searchInput, selectedProduit, selectedApprovisionnement)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Lots</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{lots.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Quantité totale</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalQuantity}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Produits</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{produits.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Rechercher un lot..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            <Select value={selectedProduit} onValueChange={setSelectedProduit}>
              <SelectTrigger>
                <SelectValue placeholder="Produit" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">Tous les produits</SelectItem>
                {produits.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nom} ({p.code})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedApprovisionnement} onValueChange={setSelectedApprovisionnement}>
              <SelectTrigger>
                <SelectValue placeholder="Approvisionnement" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">Tous les approvisionnements</SelectItem>
                {approvisionnements.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lots.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              Aucun lot trouvé.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Approvisionnement</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Réception</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Devise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map(lot => (
                  <TableRow key={lot.id}>
                    <TableCell className="font-mono text-xs">{lot.numero_lot}</TableCell>
                    <TableCell>{lot.produit?.nom ?? `#${lot.id_produit}`}</TableCell>
                    <TableCell>{lot.approvisionnement?.code ?? `#${lot.id_approvisionnement}`}</TableCell>
                    <TableCell><Badge variant="secondary">{lot.quantite_initial}</Badge></TableCell>
                    <TableCell><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" />{formatDate(lot.date_reception)}</span></TableCell>
                    <TableCell>{formatDate(lot.date_expiration)}</TableCell>
                    <TableCell>{lot.devise ? `${lot.devise.symbole} (${lot.devise.code})` : `#${lot.id_devise}`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
