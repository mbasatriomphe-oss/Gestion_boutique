"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Edit, Loader2, MoreHorizontal, Plus, RefreshCw, Search, Trash2, Truck, MapPin, Phone } from "lucide-react"
import { backendRequest } from "@/app/services/backend"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Fournisseur {
  id: number
  nom: string
  adresse: string
  ville: string
  pays: string
  contact: string
}

const EMPTY_FORM = {
  nom: "",
  adresse: "",
  ville: "",
  pays: "",
  contact: "",
}

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Fournisseur | null>(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState("")

  const fetchFournisseurs = useCallback(async (search = "") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (search.trim()) params.set("search", search.trim())
      const res = await backendRequest<{ data: Fournisseur[] }>(`/fournisseurs?${params.toString()}`)
      setFournisseurs(res.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFournisseurs()
  }, [fetchFournisseurs])

  useEffect(() => {
    const timer = setTimeout(() => fetchFournisseurs(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput, fetchFournisseurs])

  const openCreate = () => {
    setEditing(null)
    setFormData({ ...EMPTY_FORM })
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (fournisseur: Fournisseur) => {
    setEditing(fournisseur)
    setFormData({
      nom: fournisseur.nom,
      adresse: fournisseur.adresse,
      ville: fournisseur.ville,
      pays: fournisseur.pays,
      contact: fournisseur.contact,
    })
    setFormError("")
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditing(null)
    setFormError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nom.trim() || !formData.adresse.trim() || !formData.ville.trim() || !formData.pays.trim() || !formData.contact.trim()) {
      setFormError("Tous les champs sont obligatoires.")
      return
    }

    setIsSaving(true)
    setFormError("")

    try {
      const body = {
        nom: formData.nom.trim(),
        adresse: formData.adresse.trim(),
        ville: formData.ville.trim(),
        pays: formData.pays.trim(),
        contact: formData.contact.trim(),
      }

      if (editing) {
        const res = await backendRequest<{ data: Fournisseur }>(`/fournisseurs/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
        setFournisseurs(prev => prev.map(f => f.id === editing.id ? res.data : f))
      } else {
        const res = await backendRequest<{ data: Fournisseur }>("/fournisseurs", {
          method: "POST",
          body: JSON.stringify(body),
        })
        setFournisseurs(prev => [res.data, ...prev])
      }

      closeDialog()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (fournisseur: Fournisseur) => {
    if (!confirm(`Supprimer le fournisseur "${fournisseur.nom}" ?`)) return
    try {
      await backendRequest(`/fournisseurs/${fournisseur.id}`, { method: "DELETE" })
      setFournisseurs(prev => prev.filter(f => f.id !== fournisseur.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-r from-slate-50 via-white to-amber-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Achats</p>
            <h1 className="text-2xl lg:text-3xl font-bold">Fournisseurs</h1>
            <p className="text-muted-foreground">CRUD relié au backend Laravel.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchFournisseurs(searchInput)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau fournisseur
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher un fournisseur..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
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
          ) : fournisseurs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-40" />
              Aucun fournisseur trouvé.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fournisseurs.map(fournisseur => (
                  <TableRow key={fournisseur.id}>
                    <TableCell className="font-medium">{fournisseur.nom}</TableCell>
                    <TableCell>{fournisseur.adresse}</TableCell>
                    <TableCell>{fournisseur.ville}</TableCell>
                    <TableCell>{fournisseur.pays}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {fournisseur.contact}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(fournisseur)}>
                            <Edit className="mr-2 h-4 w-4" />Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(fournisseur)}>
                            <Trash2 className="mr-2 h-4 w-4" />Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="nom">Nom *</Label>
                <Input id="nom" value={formData.nom} onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))} placeholder="Nom du fournisseur" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact">Contact *</Label>
                <Input id="contact" value={formData.contact} onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))} placeholder="Téléphone ou email" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ville">Ville *</Label>
                <Input id="ville" value={formData.ville} onChange={(e) => setFormData(prev => ({ ...prev, ville: e.target.value }))} placeholder="Ville" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pays">Pays *</Label>
                <Input id="pays" value={formData.pays} onChange={(e) => setFormData(prev => ({ ...prev, pays: e.target.value }))} placeholder="Pays" />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="adresse">Adresse *</Label>
              <Input id="adresse" value={formData.adresse} onChange={(e) => setFormData(prev => ({ ...prev, adresse: e.target.value }))} placeholder="Adresse complète" />
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
