"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle, ArrowLeftRight, Boxes, CalendarDays, DollarSign,
  Edit, Eye, Layers, Loader2, MoreHorizontal, Package, Plus,
  RefreshCw, Search, Trash2, X
} from "lucide-react"
import { backendRequest } from "@/app/services/backend"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface Client { id: number; nom: string; post_nom: string; prenom: string }
interface Vendeur { id: number; nom: string; prenom: string }
interface Devise { id: number; code: string; symbole: string }
interface Produit { id: number; code: string; nom: string }

interface LigneVente {
  id: number
  id_vente: number
  id_produit: number
  quantite: number
  prix_vente: string
  id_devise: number
  produit?: Produit
}

interface Lot { id: number; numero_lot: string; id_produit: number; quantite_initial: number; prix_unitaire?: string; id_devise: number }

interface VenteLotMovement {
  id: number
  id_lot: number
  id_ligne_vente: number | null
  id_produit: number
  numero_lot: string
  produit_nom: string
  quantite: number
  type_mouvement: string
}

interface Vente {
  id: number
  code: string
  date: string
  id_client: number
  id_vendeur: number
  client?: Client
  vendeur?: Vendeur
  lignes?: LigneVente[]
}

interface LigneRetourForm {
  id_produit: number
  id_ligne_vente: number
  id_lot: number
  quantite_retournee: string
  prix_vente_original: string
  prix_remboursement: string
  montant_penalite: string
  prix_unitaire_lot: string
  raison_difference: string
  justification_difference: string
  etat_produit: string
  reintegre_stock: boolean
  id_devise: number
  produit_nom: string
}

interface LigneRetour {
  id: number
  id_produit: number
  id_ligne_vente: number
  id_lot: number
  quantite_retournee: number
  prix_vente_original: string
  prix_remboursement: string
  montant_penalite: string
  prix_unitaire_lot: string
  raison_difference: string
  etat_produit: string
  reintegre_stock: boolean
  id_devise: number
  produit?: Produit
  devise?: Devise
}

interface Retour {
  id: number
  code: string
  date_retour: string
  id_vente: number
  id_client: number
  id_vendeur: number
  motif: string | null
  commentaire: string | null
  client?: Client
  vendeur?: Vendeur
  vente?: Vente
  lignes: LigneRetour[]
}

const ETATS = ["bon", "lege_usage", "endommage", "defectueux", "usage", "emballage_ouvert"] as const
const RAISONS = ["aucune", "usage_client", "deballage", "decote_naturelle", "promotion_remplacement", "penalite_contrat", "autre"] as const

function clientName(c?: Client) {
  if (!c) return "—"
  return `${c.prenom} ${c.post_nom} ${c.nom}`.trim()
}

function fmt(v: string | number | null | undefined) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : "—"
}

function etatLabel(e: string) {
  const map: Record<string, string> = {
    bon: "Bon état", lege_usage: "Légèrement usé", endommage: "Endommagé",
    defectueux: "Défectueux", usage: "Usé", emballage_ouvert: "Emballage ouvert"
  }
  return map[e] ?? e
}

function saleDateKey(value?: string) {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

export default function RetoursPage() {
  const [retours, setRetours] = useState<Retour[]>([])
  const [ventes, setVentes] = useState<Vente[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([])
  const [devises, setDevises] = useState<Devise[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [histSearch, setHistSearch] = useState("")
  const [venteCodeSearch, setVenteCodeSearch] = useState("")
  const [venteDateSearch, setVenteDateSearch] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Retour | null>(null)
  const [selected, setSelected] = useState<Retour | null>(null)
  const [formError, setFormError] = useState("")

  const [formDate, setFormDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [formVente, setFormVente] = useState("")
  const [formMotif, setFormMotif] = useState("")
  const [formCommentaire, setFormCommentaire] = useState("")

  const [venteLines, setVenteLines] = useState<LigneVente[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [venteLotMovements, setVenteLotMovements] = useState<VenteLotMovement[]>([])
  const [retourLines, setRetourLines] = useState<LigneRetourForm[]>([])

  const fetchLookups = useCallback(async () => {
    const [vRes, cRes, veRes, dRes] = await Promise.all([
      backendRequest<{ data: Vente[] }>("/ventes?per_page=all"),
      backendRequest<{ data: Client[] }>("/clients?per_page=all"),
      backendRequest<{ data: Vendeur[] }>("/vendeurs?per_page=all"),
      backendRequest<{ data: Devise[] }>("/devises?per_page=all"),
    ])
    setVentes(vRes.data ?? [])
    setClients(cRes.data ?? [])
    setVendeurs(veRes.data ?? [])
    setDevises(dRes.data ?? [])

    backendRequest<{ data: Lot[] }>("/lots?per_page=all")
      .then(res => setLots(res.data ?? []))
      .catch(() => setLots([]))
  }, [])

  const fetchRetours = useCallback(async (q = "") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (q.trim()) params.set("search", q.trim())
      const res = await backendRequest<{ data: Retour[] }>(`/retours?${params}`)
      setRetours((res.data ?? []).map(r => ({ ...r, lignes: r.lignes ?? [] })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchLookups(), fetchRetours()])
  }, [fetchLookups, fetchRetours])

  useEffect(() => {
    const t = setTimeout(() => fetchRetours(histSearch), 300)
    return () => clearTimeout(t)
  }, [histSearch, fetchRetours])

  // Quand on sélectionne une vente, charger ses lignes et les lots associés
  useEffect(() => {
    if (!formVente) {
      setVenteLines([])
      setVenteLotMovements([])
      setRetourLines([])
      return
    }

    const vente = ventes.find(v => String(v.id) === formVente)
    const lignes = vente?.lignes ?? []
    setVenteLines(lignes)

    backendRequest<{ data: VenteLotMovement[] }>(`/mouvements-stock-fifos/vente/${formVente}`)
      .then((res) => {
        const movements = res.data ?? []
        setVenteLotMovements(movements)

        const lotsByLine = new Map<number, VenteLotMovement[]>()
        for (const movement of movements) {
          if (movement.id_ligne_vente == null) {
            continue
          }

          const current = lotsByLine.get(movement.id_ligne_vente) ?? []
          current.push(movement)
          lotsByLine.set(movement.id_ligne_vente, current)
        }

        const lines: LigneRetourForm[] = lignes.map((line) => ({
          id_produit: line.id_produit,
          id_ligne_vente: line.id,
          id_lot: lotsByLine.get(line.id)?.[0]?.id_lot ?? 0,
          quantite_retournee: "",
          prix_vente_original: line.prix_vente,
          prix_remboursement: line.prix_vente,
          montant_penalite: "0",
          prix_unitaire_lot: "0",
          raison_difference: "aucune",
          justification_difference: "",
          etat_produit: "bon",
          reintegre_stock: true,
          id_devise: line.id_devise,
          produit_nom: line.produit?.nom ?? `#${line.id_produit}`,
        }))

        setRetourLines(lines)
      })
      .catch(() => {
        setVenteLotMovements([])
        const lines: LigneRetourForm[] = lignes.map((line) => ({
          id_produit: line.id_produit,
          id_ligne_vente: line.id,
          id_lot: 0,
          quantite_retournee: "",
          prix_vente_original: line.prix_vente,
          prix_remboursement: line.prix_vente,
          montant_penalite: "0",
          prix_unitaire_lot: "0",
          raison_difference: "aucune",
          justification_difference: "",
          etat_produit: "bon",
          reintegre_stock: true,
          id_devise: line.id_devise,
          produit_nom: line.produit?.nom ?? `#${line.id_produit}`,
        }))

        setRetourLines(lines)
      })
  }, [formVente, ventes])

  const openCreate = () => {
    setEditing(null)
    setFormDate(new Date().toISOString().substring(0, 10))
    setFormVente("")
    setVenteCodeSearch("")
    setVenteDateSearch("")
    setFormMotif("")
    setFormCommentaire("")
    setVenteLines([])
    setRetourLines([])
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (r: Retour) => {
    setEditing(r)
    setFormDate(r.date_retour)
    setFormVente(String(r.id_vente))
    setVenteCodeSearch("")
    setVenteDateSearch("")
    setFormMotif(r.motif ?? "")
    setFormCommentaire(r.commentaire ?? "")
    setFormError("")
    setShowDialog(true)
  }

  const updLine = <K extends keyof LigneRetourForm>(idx: number, key: K, val: LigneRetourForm[K]) => {
    setRetourLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formVente) { setFormError("Sélectionne une vente."); return }
    const vente = ventes.find(v => String(v.id) === formVente)
    if (!vente) { setFormError("Vente introuvable."); return }

    if (!editing) {
      const activeLines = retourLines.filter(l => Number(l.quantite_retournee) > 0)
      if (activeLines.length === 0) { setFormError("Indique la quantité retournée pour au moins un produit."); return }
      const bad = activeLines.find(l => !l.id_lot)
      if (bad) { setFormError(`Choisis un lot pour ${bad.produit_nom}.`); return }

      const body = {
        date_retour: formDate,
        id_vente: vente.id,
        id_client: vente.id_client,
        id_vendeur: vente.id_vendeur,
        motif: formMotif || null,
        commentaire: formCommentaire || null,
        lignes: activeLines.map(l => ({
          id_produit: l.id_produit,
          id_ligne_vente: l.id_ligne_vente,
          id_lot: l.id_lot,
          quantite_retournee: Number(l.quantite_retournee),
          prix_vente_original: Number(l.prix_vente_original),
          prix_remboursement: Number(l.prix_remboursement),
          montant_penalite: Number(l.montant_penalite) || 0,
          prix_unitaire_lot: Number(l.prix_unitaire_lot) || 0,
          raison_difference: l.raison_difference,
          justification_difference: l.justification_difference || null,
          etat_produit: l.etat_produit,
          reintegre_stock: l.reintegre_stock,
          id_devise: l.id_devise,
        })),
      }

      setIsSaving(true)
      setFormError("")
      try {
        const res = await backendRequest<{ data: Retour }>("/retours", { method: "POST", body: JSON.stringify(body) })
        setRetours(prev => [{ ...res.data, lignes: res.data.lignes ?? [] }, ...prev])
        setShowDialog(false)
        fetchRetours()
      } catch (ex: unknown) {
        setFormError(ex instanceof Error ? ex.message : "Erreur lors de la création")
      } finally {
        setIsSaving(false)
      }
    } else {
      setIsSaving(true)
      setFormError("")
      try {
        const res = await backendRequest<{ data: Retour }>(`/retours/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ date_retour: formDate, motif: formMotif || null, commentaire: formCommentaire || null }),
        })
        setRetours(prev => prev.map(r => r.id === editing.id ? { ...res.data, lignes: res.data.lignes ?? [] } : r))
        setShowDialog(false)
      } catch (ex: unknown) {
        setFormError(ex instanceof Error ? ex.message : "Erreur lors de la modification")
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleDelete = async (r: Retour) => {
    if (!confirm(`Supprimer le retour ${r.code} ?`)) return
    try {
      await backendRequest(`/retours/${r.id}`, { method: "DELETE" })
      setRetours(prev => prev.filter(x => x.id !== r.id))
      if (selected?.id === r.id) setSelected(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  const filtered = useMemo(() => {
    if (!histSearch.trim()) return retours
    const q = histSearch.toLowerCase()
    return retours.filter(r =>
      r.code.toLowerCase().includes(q) ||
      clientName(r.client).toLowerCase().includes(q) ||
      r.vente?.code?.toLowerCase().includes(q)
    )
  }, [retours, histSearch])

  const stats = useMemo(() => ({
    total: retours.length,
    clients: new Set(retours.map(r => r.id_client)).size,
    montant: retours.reduce((s, r) => s + (r.lignes ?? []).reduce((ls, l) => ls + Number(l.quantite_retournee) * Number(l.prix_remboursement), 0), 0),
  }), [retours])

  const selectedVente = useMemo(
    () => ventes.find(v => String(v.id) === formVente) ?? null,
    [ventes, formVente],
  )

  const lotIdsForSelectedSale = useMemo(() => new Set(venteLotMovements.map((movement) => movement.id_lot)), [venteLotMovements])

  const filteredVentesForReturn = useMemo(() => {
    return ventes.filter(v => {
      const matchesCode = venteCodeSearch.trim()
        ? v.code.toLowerCase().includes(venteCodeSearch.trim().toLowerCase())
        : true
      const matchesDate = venteDateSearch ? saleDateKey(v.date) === venteDateSearch : true
      return matchesCode && matchesDate
    })
  }, [ventes, venteCodeSearch, venteDateSearch])

  return (
    <div className="space-y-6 pb-24">
      <div className="rounded-2xl border bg-gradient-to-r from-slate-50 via-white to-red-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Commerce</p>
            <h1 className="text-2xl lg:text-3xl font-bold">Retours</h1>
            <p className="text-muted-foreground">Gérez les retours de produits avec remboursement et réintégration FIFO.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fetchRetours(histSearch)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Actualiser
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />Nouveau retour
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: ArrowLeftRight, label: "Retours", value: stats.total, bg: "bg-red-100", text: "text-red-600" },
          { icon: Boxes, label: "Clients retournants", value: stats.clients, bg: "bg-amber-100", text: "text-amber-600" },
          { icon: DollarSign, label: "Montant remboursé", value: stats.montant.toFixed(2), bg: "bg-violet-100", text: "text-violet-600" },
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
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Rechercher par code, client ou vente..." value={histSearch} onChange={e => setHistSearch(e.target.value)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 opacity-40" />Aucun retour trouvé.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Vente d'origine</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Lignes</TableHead>
                      <TableHead>Remboursé</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => {
                      const montant = (r.lignes ?? []).reduce((s, l) => s + Number(l.quantite_retournee) * Number(l.prix_remboursement), 0)
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.code}</TableCell>
                          <TableCell>{r.date_retour}</TableCell>
                          <TableCell className="font-mono text-xs">{r.vente?.code ?? `#${r.id_vente}`}</TableCell>
                          <TableCell>{clientName(r.client)}</TableCell>
                          <TableCell><Badge variant="secondary">{r.lignes?.length ?? 0}</Badge></TableCell>
                          <TableCell className="font-semibold text-red-600">{montant.toFixed(2)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelected(r)}><Eye className="mr-2 h-4 w-4" />Détails</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(r)}><Edit className="mr-2 h-4 w-4" />Modifier</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(r)}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
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
                  <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" />Retour — {selected.code}</CardTitle>
                  <Badge variant="secondary">{selected.lignes?.length ?? 0} ligne(s)</Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1 pt-1">
                  <p>Client: <span className="font-medium text-foreground">{clientName(selected.client)}</span></p>
                  <p>Vente d'origine: <span className="font-mono font-medium text-foreground">{selected.vente?.code ?? `#${selected.id_vente}`}</span></p>
                  {selected.motif && <p>Motif: <span className="font-medium text-foreground">{selected.motif}</span></p>}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Qté retournée</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead>Prix remboursé</TableHead>
                      <TableHead>Pénalité</TableHead>
                      <TableHead>Stock réintégré</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selected.lignes ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune ligne</TableCell></TableRow>
                    ) : (selected.lignes ?? []).map(l => (
                      <TableRow key={l.id}>
                        <TableCell>{l.produit?.nom ?? `#${l.id_produit}`}</TableCell>
                        <TableCell>{l.quantite_retournee}</TableCell>
                        <TableCell><Badge variant="outline">{etatLabel(l.etat_produit)}</Badge></TableCell>
                        <TableCell className="font-semibold text-red-600">{fmt(l.prix_remboursement)}</TableCell>
                        <TableCell>{fmt(l.montant_penalite)}</TableCell>
                        <TableCell>{l.reintegre_stock ? <Badge className="bg-emerald-100 text-emerald-700">Oui</Badge> : <Badge variant="secondary">Non</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground"><Layers className="h-12 w-12 mx-auto mb-3 opacity-40" />Sélectionne un retour dans l'onglet Historique.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={o => !o && setShowDialog(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le retour" : "Nouveau retour"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto flex-1 pr-1">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Recherche vente par code</Label>
                <Input
                  value={venteCodeSearch}
                  onChange={e => setVenteCodeSearch(e.target.value)}
                  placeholder="Ex: VEN-001"
                />
              </div>
              <div className="space-y-1">
                <Label>Recherche vente par date</Label>
                <Input
                  type="date"
                  value={venteDateSearch}
                  onChange={e => setVenteDateSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Vente d'origine *</Label>
                <Select value={formVente} onValueChange={setFormVente} disabled={!!editing}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une vente" /></SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {filteredVentesForReturn.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.code} — {saleDateKey(v.date)} — {clientName(v.client)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedVente && (
              <div className="rounded-3xl border bg-muted/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Vente sélectionnée</p>
                    <p className="text-xs text-muted-foreground">{selectedVente.code} - {saleDateKey(selectedVente.date)} - {clientName(selectedVente.client)}</p>
                  </div>
                  <Badge variant="secondary">{selectedVente.lignes?.length ?? 0} produit(s)</Badge>
                </div>

                <div className="overflow-hidden rounded-2xl border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Qté vendue</TableHead>
                        <TableHead>Prix vente</TableHead>
                        <TableHead>Lots disponibles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedVente.lignes ?? []).map((line) => {
                          const lotsForProduct = lots.filter(l => l.id_produit === line.id_produit && lotIdsForSelectedSale.has(l.id))
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="font-medium">{line.produit?.nom ?? `#${line.id_produit}`}</TableCell>
                            <TableCell>{line.quantite}</TableCell>
                            <TableCell>{fmt(line.prix_vente)}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {lotsForProduct.length > 0 ? lotsForProduct.map(lot => (
                                  <Badge key={lot.id} variant="outline">{lot.numero_lot}</Badge>
                                )) : <span className="text-sm text-muted-foreground">Aucun lot</span>}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Motif</Label>
                <Input value={formMotif} onChange={e => setFormMotif(e.target.value)} placeholder="Raison du retour..." />
              </div>
              <div className="space-y-1">
                <Label>Commentaire</Label>
                <Input value={formCommentaire} onChange={e => setFormCommentaire(e.target.value)} placeholder="Détails supplémentaires..." />
              </div>
            </div>

            {!editing && retourLines.length > 0 && (
              <div className="rounded-3xl border bg-gradient-to-br from-muted/50 via-background to-red-50/40 p-4 space-y-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Produits à retourner</p>
                  <p className="text-xs text-muted-foreground">(Saisir 0 pour ne pas retourner)</p>
                </div>

                {retourLines.map((line, idx) => {
                  const lotsForProduct = lots.filter(l => l.id_produit === line.id_produit && lotIdsForSelectedSale.has(l.id))
                  return (
                    <div key={idx} className="rounded-2xl border bg-background p-4 space-y-4">
                      <p className="font-semibold text-sm">{line.produit_nom}</p>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Quantité retournée</Label>
                          <Input type="number" min="0" value={line.quantite_retournee} onChange={e => updLine(idx, "quantite_retournee", e.target.value)} placeholder="0" />
                        </div>
                        <div className="space-y-1">
                          <Label>Prix remboursé</Label>
                          <Input type="number" min="0" step="0.01" inputMode="decimal" value={line.prix_remboursement} onChange={e => updLine(idx, "prix_remboursement", e.target.value)} placeholder="0.00" />
                        </div>
                        <div className="space-y-1">
                          <Label>Pénalité</Label>
                          <Input type="number" min="0" step="0.01" inputMode="decimal" value={line.montant_penalite} onChange={e => updLine(idx, "montant_penalite", e.target.value)} placeholder="0.00" />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Lot *</Label>
                          <Select value={line.id_lot ? String(line.id_lot) : ""} onValueChange={v => updLine(idx, "id_lot", Number(v))}>
                            <SelectTrigger><SelectValue placeholder="Choisir le lot" /></SelectTrigger>
                            <SelectContent>
                              {lotsForProduct.length === 0 ? <SelectItem value="0" disabled>Aucun lot</SelectItem> : lotsForProduct.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.numero_lot}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>État du produit</Label>
                          <Select value={line.etat_produit} onValueChange={v => updLine(idx, "etat_produit", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ETATS.map(e => <SelectItem key={e} value={e}>{etatLabel(e)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Raison différence</Label>
                          <Select value={line.raison_difference} onValueChange={v => updLine(idx, "raison_difference", v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {RAISONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" id={`reintegre-${idx}`} checked={line.reintegre_stock} onChange={e => updLine(idx, "reintegre_stock", e.target.checked)} />
                        <Label htmlFor={`reintegre-${idx}`} className="cursor-pointer">Réintégrer au stock</Label>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {formError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{formError}</AlertDescription></Alert>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Enregistrer" : "Créer le retour"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
