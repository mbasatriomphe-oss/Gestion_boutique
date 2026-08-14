"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Edit, Filter, Loader2, MoreHorizontal, Package, Plus, RefreshCw, Search, Trash2, Upload, Image as ImageIcon } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"

interface Category {
  id: number
  nom: string
}

interface Unite {
  id: number
  nom: string
  symbole: string
}

interface ProductRaw {
  id: number
  code: string
  nom: string
  description: string | null
  photo: string | null
  unite_id: number
  categorie_id: number
  unite?: Unite
  categorie?: Category
}

interface Product extends ProductRaw {
  unite: Unite | undefined
  categorie: Category | undefined
}

const EMPTY_FORM = {
  nom: "",
  description: "",
  unite_id: "",
  categorie_id: "",
}

function normalise(product: ProductRaw): Product {
  return {
    ...product,
    unite: product.unite,
    categorie: product.categorie,
  }
}

function getPhotoUrl(photo: string | null | undefined) {
  if (!photo) return "/placeholder.svg"
  if (photo.startsWith("http://") || photo.startsWith("https://") || photo.startsWith("blob:")) return photo
  return `/storage/${photo.replace(/^\/+/, "")}`
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [unites, setUnites] = useState<Unite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedUnite, setSelectedUnite] = useState("all")
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>("")

  const fetchLookups = useCallback(async () => {
    const [catRes, uniteRes] = await Promise.all([
      backendRequest<{ data: Category[] }>("/categories?per_page=all"),
      backendRequest<{ data: Unite[] }>("/unites/all"),
    ])
    setCategories(catRes.data ?? [])
    setUnites(uniteRes.data ?? [])
  }, [])

  const fetchProducts = useCallback(async (search = "", category = "all", unite = "all") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (search.trim()) params.set("search", search.trim())
      if (category !== "all") params.set("categorie_id", category)
      if (unite !== "all") params.set("unite_id", unite)
      const res = await backendRequest<{ data: ProductRaw[] }>(`/produits?${params.toString()}`)
      setProducts((res.data ?? []).map(normalise))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([fetchLookups(), fetchProducts()])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur de chargement")
      }
    })()
  }, [fetchLookups, fetchProducts])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(searchInput, selectedCategory, selectedUnite)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, selectedCategory, selectedUnite, fetchProducts])

  const openCreate = () => {
    setEditing(null)
    setFormData({ ...EMPTY_FORM })
    setPhotoFile(null)
    setPhotoPreview("")
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setFormData({
      nom: product.nom,
      description: product.description ?? "",
      unite_id: String(product.unite_id),
      categorie_id: String(product.categorie_id),
    })
    setPhotoFile(null)
    setPhotoPreview(getPhotoUrl(product.photo))
    setFormError("")
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditing(null)
    setPhotoFile(null)
    setPhotoPreview("")
    setFormError("")
  }

  const resetFilters = () => {
    setSearchInput("")
    setSelectedCategory("all")
    setSelectedUnite("all")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nom.trim() || !formData.unite_id || !formData.categorie_id) {
      setFormError("Le nom, l'unité et la catégorie sont obligatoires.")
      return
    }

    setIsSaving(true)
    setFormError("")

    try {
      const body = new FormData()
      body.append("nom", formData.nom.trim())
      body.append("description", formData.description.trim())
      body.append("unite_id", formData.unite_id)
      body.append("categorie_id", formData.categorie_id)
      if (photoFile) {
        body.append("photo_file", photoFile)
      }

      if (editing) {
        body.append("_method", "PUT")
        const res = await backendRequest<{ data: ProductRaw }>(`/produits/${editing.id}`, {
          method: "POST",
          body,
        })
        setProducts(prev => prev.map(p => p.id === editing.id ? normalise(res.data) : p))
      } else {
        const res = await backendRequest<{ data: ProductRaw }>("/produits", {
          method: "POST",
          body,
        })
        setProducts(prev => [normalise(res.data), ...prev])
      }

      closeDialog()
      fetchProducts(searchInput, selectedCategory, selectedUnite)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`Supprimer le produit "${product.nom}" ?`)) return
    try {
      await backendRequest(`/produits/${product.id}`, { method: "DELETE" })
      setProducts(prev => prev.filter(p => p.id !== product.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  const visibleCount = useMemo(() => products.length, [products.length])
  const previewImage = photoPreview || (editing ? getPhotoUrl(editing.photo) : "")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-r from-slate-50 via-white to-emerald-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Catalogue</p>
          <h1 className="text-2xl lg:text-3xl font-bold">Produits</h1>
          <p className="text-muted-foreground">Gestion complète reliée au backend Laravel.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchProducts(searchInput, selectedCategory, selectedUnite)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total produits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visibleCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Catégories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unités</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unites.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher un produit..."
                className="pl-9"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedUnite} onValueChange={setSelectedUnite}>
              <SelectTrigger>
                <SelectValue placeholder="Unité" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">Toutes les unités</SelectItem>
                {unites.map(unite => (
                  <SelectItem key={unite.id} value={String(unite.id)}>{unite.nom} ({unite.symbole})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={resetFilters}>Réinitialiser les filtres</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
              Aucun produit trouvé.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Unité</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(product => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">{product.code}</TableCell>
                    <TableCell className="font-medium">{product.nom}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{product.categorie?.nom ?? `#${product.categorie_id}`}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.unite ? `${product.unite.nom} (${product.unite.symbole})` : `#${product.unite_id}`}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {product.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(product)}>
                            <Edit className="mr-2 h-4 w-4" />Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(product)}>
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
            <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto flex-1 pr-1">
            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="space-y-4 rounded-2xl border bg-background p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={formData.nom}
                      onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                      placeholder="Nom du produit"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="categorie_id">Catégorie *</Label>
                    <Select value={formData.categorie_id} onValueChange={(value) => setFormData(prev => ({ ...prev, categorie_id: value }))}>
                      <SelectTrigger id="categorie_id">
                        <SelectValue placeholder="Choisir une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="unite_id">Unité *</Label>
                    <Select value={formData.unite_id} onValueChange={(value) => setFormData(prev => ({ ...prev, unite_id: value }))}>
                      <SelectTrigger id="unite_id">
                        <SelectValue placeholder="Choisir une unité" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {unites.map(unite => (
                          <SelectItem key={unite.id} value={String(unite.id)}>{unite.nom} ({unite.symbole})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Détails du produit, notes, ingrédients, etc."
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border bg-gradient-to-br from-slate-50 to-emerald-50 p-4">
                <div className="space-y-2">
                  <Label htmlFor="photo_file">Photo du produit</Label>
                  <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-white/70 p-4 text-center">
                    <div className="space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Choisir une image depuis la machine</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, JPEG, WebP jusqu’à 4 Mo</p>
                      </div>
                      <Input
                        id="photo_file"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setPhotoFile(file)
                          setPhotoPreview(file ? URL.createObjectURL(file) : (editing ? getPhotoUrl(editing.photo) : ""))
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <Label>Aperçu</Label>
                  </div>
                  <div className="overflow-hidden rounded-2xl border bg-background">
                    {previewImage ? (
                      <img src={previewImage} alt="Aperçu produit" className="h-48 w-full object-cover" />
                    ) : (
                      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                        Aucune photo sélectionnée
                      </div>
                    )}
                  </div>
                  {photoFile && (
                    <p className="text-xs text-muted-foreground">
                      Fichier sélectionné : {photoFile.name}
                    </p>
                  )}
                </div>
              </div>
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
