"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import {
  Plus, Edit, Trash2, MoreHorizontal, RefreshCw, Loader2,
  AlertCircle, Users, ShoppingCart, Eye, ArrowLeft, Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { backendRequest } from "@/app/services/backend"

interface Vendeur {
  id: number
  code: string
  nom: string
  prenom: string
  email: string
  telephone: string | null
  adresse: string | null
  ventes_count: number
}

interface Vente {
  id: number
  code: string
  date: string
  id_vendeur: number
  id_client: number
  client?: { id: number; nom: string; prenom?: string }
}

const EMPTY_FORM = { nom: "", prenom: "", email: "", password: "", telephone: "", adresse: "" }

export default function VendeursPage() {
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Vendeur | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState("")

  // Detail view
  const [selectedVendeur, setSelectedVendeur] = useState<Vendeur | null>(null)
  const [ventes, setVentes] = useState<Vente[]>([])
  const [ventesLoading, setVentesLoading] = useState(false)

  const fetchVendeurs = useCallback(async (q = "") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (q) params.set("search", q)
      const res = await backendRequest<{ data: Vendeur[] }>(`/vendeurs?${params}`)
      setVendeurs(res.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchVendeurs() }, [fetchVendeurs])

  useEffect(() => {
    const t = setTimeout(() => fetchVendeurs(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput, fetchVendeurs])

  const fetchVentes = useCallback(async (vendeurId: number) => {
    setVentesLoading(true)
    try {
      const res = await backendRequest<{ data: Vente[] }>(`/ventes?id_vendeur=${vendeurId}&per_page=all`)
      setVentes(res.data ?? [])
    } catch {
      setVentes([])
    } finally {
      setVentesLoading(false)
    }
  }, [])

  const openDetail = (v: Vendeur) => {
    setSelectedVendeur(v)
    fetchVentes(v.id)
  }

  const closeDetail = () => { setSelectedVendeur(null); setVentes([]) }

  const openCreate = () => {
    setEditing(null)
    setFormData(EMPTY_FORM)
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (v: Vendeur) => {
    setEditing(v)
    setFormData({ nom: v.nom, prenom: v.prenom, email: v.email, password: "", telephone: v.telephone ?? "", adresse: v.adresse ?? "" })
    setFormError("")
    setShowDialog(true)
  }

  const closeDialog = () => { setShowDialog(false); setEditing(null); setFormError("") }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nom.trim() || !formData.prenom.trim() || !formData.email.trim()) {
      setFormError("Nom, prénom et email sont obligatoires.")
      return
    }
    if (!editing && !formData.password.trim()) {
      setFormError("Le mot de passe est obligatoire pour un nouveau vendeur.")
      return
    }
    setIsSaving(true)
    setFormError("")
    try {
      const body: Record<string, string> = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        email: formData.email.trim(),
        telephone: formData.telephone.trim(),
        adresse: formData.adresse.trim(),
      }
      if (formData.password.trim()) body.password = formData.password

      if (editing) {
        const res = await backendRequest<{ data: Vendeur }>(`/vendeurs/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
        setVendeurs(prev => prev.map(v => v.id === editing.id ? { ...res.data, ventes_count: editing.ventes_count } : v))
      } else {
        const res = await backendRequest<{ data: Vendeur }>("/vendeurs", { method: "POST", body: JSON.stringify(body) })
        setVendeurs(prev => [...prev, res.data])
      }
      closeDialog()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (v: Vendeur) => {
    if (!confirm(`Supprimer le vendeur "${v.prenom} ${v.nom}" ?`)) return
    try {
      await backendRequest(`/vendeurs/${v.id}`, { method: "DELETE" })
      setVendeurs(prev => prev.filter(x => x.id !== v.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  // ─── Detail view ─────────────────────────────────────────────────────────────
  if (selectedVendeur) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={closeDetail}>
            <ArrowLeft className="h-4 w-4 mr-2" />Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedVendeur.prenom} {selectedVendeur.nom}</h1>
            <p className="text-muted-foreground">Code : <span className="font-mono font-semibold">{selectedVendeur.code}</span></p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total ventes</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{selectedVendeur.ventes_count}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Email</CardTitle></CardHeader>
            <CardContent><p className="text-sm font-medium truncate">{selectedVendeur.email}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Téléphone</CardTitle></CardHeader>
            <CardContent><p className="text-sm font-medium">{selectedVendeur.telephone ?? "—"}</p></CardContent>
          </Card>
        </div>

        {/* Ventes table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Historique des ventes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventesLoading && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 3 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 rounded bg-muted animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))}
                {!ventesLoading && ventes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      Aucune vente enregistrée
                    </TableCell>
                  </TableRow>
                )}
                {!ventesLoading && ventes.map(vente => (
                  <TableRow key={vente.id}>
                    <TableCell className="font-mono text-sm">{vente.code}</TableCell>
                    <TableCell>{new Date(vente.date).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell>
                      {vente.client
                        ? `${vente.client.prenom ?? ""} ${vente.client.nom}`.trim()
                        : `Client #${vente.id_client}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Vendeurs</h1>
          <p className="text-muted-foreground">
            {isLoading ? "Chargement…" : `${vendeurs.length} vendeur${vendeurs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchVendeurs(searchInput)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={showDialog} onOpenChange={open => { if (!open) closeDialog() }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau vendeur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Modifier le vendeur" : "Nouveau vendeur"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input id="prenom" value={formData.prenom} onChange={e => setFormData({ ...formData, prenom: e.target.value })} required />
                  </div>
                  <div>
                    <Label htmlFor="nom">Nom *</Label>
                    <Input id="nom" value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="password">{editing ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe *"}</Label>
                  <Input id="password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder={editing ? "Laisser vide" : "Min. 6 caractères"} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="telephone">Téléphone</Label>
                    <Input id="telephone" value={formData.telephone} onChange={e => setFormData({ ...formData, telephone: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="adresse">Adresse</Label>
                    <Input id="adresse" value={formData.adresse} onChange={e => setFormData({ ...formData, adresse: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editing ? "Mettre à jour" : "Créer le vendeur"}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>Annuler</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher un vendeur…" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Grid */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && vendeurs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendeurs.map(v => (
            <Card key={v.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {v.prenom[0]}{v.nom[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{v.prenom} {v.nom}</p>
                      <p className="text-sm text-muted-foreground truncate">{v.email}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{v.code}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDetail(v)}>
                        <Eye className="h-4 w-4 mr-2" />Voir les ventes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(v)}>
                        <Edit className="h-4 w-4 mr-2" />Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(v)} className="text-red-600 focus:text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Badge variant="secondary" className="cursor-pointer" onClick={() => openDetail(v)}>
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    {v.ventes_count ?? 0} vente{(v.ventes_count ?? 0) !== 1 ? "s" : ""}
                  </Badge>
                  {v.telephone && <span className="text-xs text-muted-foreground">{v.telephone}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && vendeurs.length === 0 && !error && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">{searchInput ? "Aucun résultat" : "Aucun vendeur"}</h3>
            <p className="text-muted-foreground mb-4">
              {searchInput ? `Aucun vendeur trouvé pour « ${searchInput} »` : "Commencez par créer votre premier vendeur"}
            </p>
            {!searchInput && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />Nouveau vendeur
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
