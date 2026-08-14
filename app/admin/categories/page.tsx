"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Plus, Edit, Trash2, Package, MoreHorizontal, Search, RefreshCw, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { backendRequest } from "../../services/backend"

// Palette de couleurs assignée selon l'index
const CARD_COLORS = [
  "#6366f1", "#ef4444", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f97316", "#84cc16",
]

interface Category {
  id: number
  nom: string
  description: string | null
  photo: string | null
  produits_count: number
}

interface FormData {
  nom: string
  description: string
  photo: string
}

const EMPTY_FORM: FormData = { nom: "", description: "", photo: "📦" }

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [formError, setFormError] = useState("")

  // ─── Fetch ───────────────────────────────────────────────────────────────────
  const fetchCategories = useCallback(async (q = "") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (q) params.set("search", q)
      const res = await backendRequest<{ data: Category[] }>(`/categories?${params}`)
      setCategories(res.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors du chargement des catégories")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // ─── Search (debounced) ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      fetchCategories(searchInput)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput, fetchCategories])

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setFormData(EMPTY_FORM)
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setFormData({
      nom: cat.nom,
      description: cat.description ?? "",
      photo: cat.photo ?? "📦",
    })
    setFormError("")
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditing(null)
    setFormError("")
  }

  // ─── Create / Update ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nom.trim()) {
      setFormError("Le nom est obligatoire.")
      return
    }
    setIsSaving(true)
    setFormError("")
    try {
      const body = {
        nom: formData.nom.trim(),
        description: formData.description.trim() || null,
        photo: formData.photo.trim() || null,
      }
      if (editing) {
        const res = await backendRequest<{ data: Category }>(`/categories/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
        setCategories((prev) => prev.map((c) => (c.id === editing.id ? res.data : c)))
      } else {
        const res = await backendRequest<{ data: Category }>("/categories", {
          method: "POST",
          body: JSON.stringify(body),
        })
        setCategories((prev) => [...prev, res.data])
      }
      closeDialog()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (cat: Category) => {
    if (!confirm(`Supprimer la catégorie "${cat.nom}" ?`)) return
    try {
      await backendRequest(`/categories/${cat.id}`, { method: "DELETE" })
      setCategories((prev) => prev.filter((c) => c.id !== cat.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Catégories</h1>
          <p className="text-muted-foreground">
            {isLoading ? "Chargement…" : `${categories.length} catégorie${categories.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchCategories(search)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog() }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle catégorie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <div>
                  <Label htmlFor="nom">Nom *</Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    placeholder="Ex: Électronique"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Description optionnelle…"
                  />
                </div>
                <div>
                  <Label htmlFor="photo">Icône (emoji)</Label>
                  <Input
                    id="photo"
                    value={formData.photo}
                    onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                    placeholder="📦"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editing ? "Mettre à jour" : "Ajouter"}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>
                    Annuler
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher une catégorie…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-3 w-16 rounded bg-muted" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Categories grid */}
      {!isLoading && categories.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((cat, i) => (
            <Card key={cat.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0"
                      style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                    >
                      {cat.photo || "📦"}
                    </div>
                    <div>
                      <CardTitle className="text-base leading-tight">{cat.nom}</CardTitle>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {cat.produits_count ?? 0} produit{(cat.produits_count ?? 0) !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(cat)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(cat)}
                        className="text-red-600 focus:text-red-600"
                        disabled={(cat.produits_count ?? 0) > 0}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {(cat.produits_count ?? 0) > 0 ? "Supprimer (produits liés)" : "Supprimer"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {cat.description || <span className="italic">Pas de description</span>}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && categories.length === 0 && !error && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">
              {searchInput ? "Aucune catégorie trouvée" : "Aucune catégorie"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchInput
                ? `Aucun résultat pour « ${searchInput} »`
                : "Commencez par créer votre première catégorie"}
            </p>
            {!searchInput && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle catégorie
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
