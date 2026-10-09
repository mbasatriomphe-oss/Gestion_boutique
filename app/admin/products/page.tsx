"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Boxes, Check, ChevronLeft, ChevronRight, Edit, Filter, Loader2, MoreHorizontal, Package, Plus, RefreshCw, Search, Trash2, Truck, Upload, Image as ImageIcon } from "lucide-react"
import { backendRequest } from "@/app/services/backend"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

interface Devise {
  id: number
  code: string
  nom: string
  symbole: string
}

interface SaleUnitForm {
  id_unite: string
  facteur: string
  prix: string
  id_devise: string
}

interface OpeningStockForm {
  id_unite: string
  quantite: string
}

interface ProductUnitConversion {
  id: number
  id_unite: number
  facteur: string
  prix?: string | null
  id_devise?: number | null
  devise?: Pick<Devise, "id" | "code" | "symbole">
  unite?: Unite
}

interface ProductRaw {
  id: number
  code: string
  nom: string
  description: string | null
  photo: string | null
  unite_id: number
  categorie_id: number
  seuil_alerte?: string | number
  unite?: Unite
  categorie?: Category
  unitesAchat?: ProductUnitConversion[]
  unitesVente?: ProductUnitConversion[]
  unites_achat?: ProductUnitConversion[]
  unites_vente?: ProductUnitConversion[]
}

interface Product extends ProductRaw {
  unite: Unite | undefined
  categorie: Category | undefined
}

interface ProductStockRow {
  id: number
  stock_actuel: number | string
}

interface LatestProcurementLine {
  quantite: number | string
  prix_unitaire: number | string
  prix_vente: number | string | null
  facteur_conversion?: number | string
  prix_unitaire_stock?: number | string | null
  prix_vente_stock?: number | string | null
}

interface ProductLot {
  id: number
  id_produit: number
  ligneApprovisionnement?: LatestProcurementLine
  ligne_approvisionnement?: LatestProcurementLine
  devise?: { symbole?: string; code?: string }
}

const EMPTY_FORM = {
  nom: "",
  description: "",
  unite_id: "",
  unite_achat_id: "",
  facteur_achat: "1",
  prix_achat: "",
  devise_achat_id: "",
  unites_vente: [] as SaleUnitForm[],
  stock_initial: [] as OpeningStockForm[],
  seuil_alerte: "0",
  seuil_alerte_unite_id: "",
  categorie_id: "",
}

const SETUP_STEPS = ["Achat", "Vente", "Stock"]

function normalise(product: ProductRaw): Product {
  return {
    ...product,
    unite: product.unite,
    categorie: product.categorie,
    unitesAchat: product.unitesAchat ?? product.unites_achat ?? [],
    unitesVente: product.unitesVente ?? product.unites_vente ?? [],
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
  const [devises, setDevises] = useState<Devise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formStep, setFormStep] = useState(1)
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [detailStock, setDetailStock] = useState<number | null>(null)
  const [latestProcurementLine, setLatestProcurementLine] = useState<LatestProcurementLine | null>(null)
  const [detailCurrency, setDetailCurrency] = useState("$")
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  const fetchLookups = useCallback(async () => {
    const [catRes, uniteRes, deviseRes] = await Promise.all([
      backendRequest<{ data: Category[] }>("/categories?per_page=all"),
      backendRequest<{ data: Unite[] }>("/unites/all"),
      backendRequest<{ data: Devise[] }>("/devises?per_page=all"),
    ])
    setCategories(catRes.data ?? [])
    setUnites(uniteRes.data ?? [])
    setDevises(deviseRes.data ?? [])
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
    const baseUnitId = unites[0] ? String(unites[0].id) : ""
    const defaultCurrencyId = devises[0] ? String(devises[0].id) : ""
    setFormData({
      ...EMPTY_FORM,
      unite_id: baseUnitId,
      unite_achat_id: baseUnitId,
      devise_achat_id: defaultCurrencyId,
      unites_vente: baseUnitId ? [{ id_unite: baseUnitId, facteur: "1", prix: "", id_devise: defaultCurrencyId }] : [],
      stock_initial: baseUnitId ? [{ id_unite: baseUnitId, quantite: "0" }] : [],
      seuil_alerte_unite_id: baseUnitId,
    })
    setFormStep(1)
    setPhotoFile(null)
    setPhotoPreview("")
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    const defaultCurrencyId = devises[0] ? String(devises[0].id) : ""
    setFormData({
      nom: product.nom,
      description: product.description ?? "",
      unite_id: String(product.unite_id),
      unite_achat_id: String(product.unitesAchat?.[0]?.id_unite ?? product.unite_id),
      facteur_achat: String(product.unitesAchat?.[0]?.facteur ?? "1"),
      prix_achat: String(product.unitesAchat?.[0]?.prix ?? ""),
      devise_achat_id: String(product.unitesAchat?.[0]?.id_devise ?? defaultCurrencyId),
      unites_vente: product.unitesVente?.length
        ? product.unitesVente.map(unit => ({ id_unite: String(unit.id_unite), facteur: String(unit.facteur), prix: String(unit.prix ?? ""), id_devise: String(unit.id_devise ?? defaultCurrencyId) }))
        : [{ id_unite: String(product.unite_id), facteur: "1", prix: "", id_devise: defaultCurrencyId }],
      stock_initial: [],
      seuil_alerte: String(product.seuil_alerte ?? "0"),
      seuil_alerte_unite_id: String(product.unite_id),
      categorie_id: String(product.categorie_id),
    })
    setFormStep(1)
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
    setFormStep(1)
  }

  const resetFilters = () => {
    setSearchInput("")
    setSelectedCategory("all")
    setSelectedUnite("all")
  }

  const openDetails = async (product: Product) => {
    setSelectedProduct(product)
    setDetailStock(null)
    setLatestProcurementLine(null)
    setIsLoadingDetails(true)

    try {
      const [stockResponse, lotResponse] = await Promise.all([
        backendRequest<{ data: ProductStockRow[] }>("/stocks/disponible"),
        backendRequest<{ data: ProductLot[] }>(`/lots?per_page=all&id_produit=${product.id}`),
      ])
      const stock = stockResponse.data?.find(row => Number(row.id) === product.id)
      const latestLot = lotResponse.data?.[0]
      setDetailStock(Number(stock?.stock_actuel ?? 0))
      setLatestProcurementLine(latestLot?.ligneApprovisionnement ?? latestLot?.ligne_approvisionnement ?? null)
      setDetailCurrency(latestLot?.devise?.symbole ?? latestLot?.devise?.code ?? "$")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Impossible de charger les détails du produit.")
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const getStockBreakdown = (product: Product, stock: number) => {
    const purchaseUnit = product.unitesAchat?.[0]
    const factor = Number(purchaseUnit?.facteur ?? 1)
    const purchaseLabel = purchaseUnit?.unite?.symbole ?? purchaseUnit?.unite?.nom ?? "unité"
    const stockLabel = product.unite?.symbole ?? product.unite?.nom ?? "unité"

    if (factor <= 1) {
      return `${stock.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${stockLabel}`
    }

    const packages = Math.floor((stock + 0.00000001) / factor)
    const remainder = Number((stock - packages * factor).toFixed(8))
    const parts = [`${packages} ${packages === 1 ? purchaseLabel : `${purchaseLabel}s`}`]
    if (remainder > 0) parts.push(`${remainder.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} ${stockLabel}`)
    return parts.join(" + ")
  }

  const getPriceForSaleUnit = (unit: ProductUnitConversion) => {
    if (unit.prix !== null && unit.prix !== undefined) return Number(unit.prix)
    const purchaseFactor = Number(latestProcurementLine?.facteur_conversion ?? 1)
    const normalizedPrice = latestProcurementLine?.prix_vente_stock ?? latestProcurementLine?.prix_unitaire_stock
    const enteredPrice = Number(latestProcurementLine?.prix_vente ?? latestProcurementLine?.prix_unitaire ?? 0)
    const pricePerStockUnit = Number(normalizedPrice ?? (purchaseFactor > 0 ? enteredPrice / purchaseFactor : enteredPrice))
    return pricePerStockUnit * Number(unit.facteur)
  }

  const getFormUnitFactor = (unitId: string) => {
    if (unitId === formData.unite_achat_id) return Number(formData.facteur_achat) || 1
    return Number(formData.unites_vente.find(unit => unit.id_unite === unitId)?.facteur ?? (unitId === formData.unite_id ? 1 : 0))
  }

  const openingStockUnits = useMemo(() => {
    const unitsById = new Map<string, { id: string; label: string }>()
    const purchase = unites.find(unit => String(unit.id) === formData.unite_achat_id)
    if (purchase) unitsById.set(String(purchase.id), { id: String(purchase.id), label: purchase.nom })
    for (const saleUnit of formData.unites_vente) {
      const unit = unites.find(option => String(option.id) === saleUnit.id_unite)
      if (unit && !unitsById.has(saleUnit.id_unite)) unitsById.set(saleUnit.id_unite, { id: saleUnit.id_unite, label: unit.nom })
    }
    const base = unites.find(unit => String(unit.id) === formData.unite_id)
    if (base && !unitsById.has(String(base.id))) unitsById.set(String(base.id), { id: String(base.id), label: base.nom })
    return Array.from(unitsById.values())
  }, [formData.unite_achat_id, formData.unite_id, formData.unites_vente, unites])

  const initialStockTotal = formData.stock_initial.reduce((total, line) => (
    total + (Number(line.quantite) || 0) * getFormUnitFactor(line.id_unite)
  ), 0)

  const validateStep = (step: number) => {
    setFormError("")

    if (step === 1) {
      if (!formData.nom.trim() || !formData.categorie_id || !formData.unite_id || !formData.unite_achat_id) {
        setFormError("Renseigne le nom, la catégorie et les unités d'achat et de stock.")
        return false
      }
      if (!Number.isFinite(Number(formData.facteur_achat)) || Number(formData.facteur_achat) <= 0) {
        setFormError("La conversion de l'unité d'achat doit être supérieure à zéro.")
        return false
      }
      if (formData.unite_achat_id === formData.unite_id && Number(formData.facteur_achat) !== 1) {
        setFormError("L'unité d'achat doit avoir un facteur de 1 lorsqu'elle est aussi l'unité de stock.")
        return false
      }
      if (formData.prix_achat !== "" && (!Number.isFinite(Number(formData.prix_achat)) || Number(formData.prix_achat) < 0)) {
        setFormError("Le prix d'achat doit être un montant positif ou nul.")
        return false
      }
      if (formData.prix_achat !== "" && !formData.devise_achat_id) {
        setFormError("Choisis une devise pour le prix d'achat.")
        return false
      }
    }

    if (step === 2) {
      if (formData.unites_vente.length === 0 || formData.unites_vente.some(unit => !unit.id_unite || !Number.isFinite(Number(unit.facteur)) || Number(unit.facteur) <= 0)) {
        setFormError("Ajoute au moins une unité de vente avec une conversion supérieure à zéro.")
        return false
      }
      if (new Set(formData.unites_vente.map(unit => unit.id_unite)).size !== formData.unites_vente.length) {
        setFormError("Chaque unité de vente doit être sélectionnée une seule fois.")
        return false
      }
      const baseSaleUnit = formData.unites_vente.find(unit => unit.id_unite === formData.unite_id)
      if (!baseSaleUnit || Number(baseSaleUnit.facteur) !== 1) {
        setFormError("L'unité de stock doit aussi être proposée à la vente avec un facteur de 1.")
        return false
      }
      const purchaseSaleUnit = formData.unites_vente.find(unit => unit.id_unite === formData.unite_achat_id)
      if (purchaseSaleUnit && Math.abs(Number(purchaseSaleUnit.facteur) - Number(formData.facteur_achat)) > 0.00000001) {
        setFormError("La conversion de l'unité d'achat doit être identique si elle est aussi vendue.")
        return false
      }
      if (formData.unites_vente.some(unit => unit.prix !== "" && (!Number.isFinite(Number(unit.prix)) || Number(unit.prix) < 0 || !unit.id_devise))) {
        setFormError("Chaque prix de vente doit avoir une valeur positive ou nulle et une devise.")
        return false
      }
    }

    if (step === 3) {
      if (formData.stock_initial.some(line => !Number.isFinite(Number(line.quantite)) || Number(line.quantite) < 0)) {
        setFormError("Les quantités initiales doivent être positives ou nulles.")
        return false
      }
      if (!Number.isFinite(Number(formData.seuil_alerte)) || Number(formData.seuil_alerte) < 0) {
        setFormError("Le seuil d'alerte doit être positif ou nul.")
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateStep(formStep)) return
    if (formStep < 3) {
      setFormStep(current => current + 1)
      return
    }

    setIsSaving(true)
    setFormError("")

    try {
      const body = new FormData()
      body.append("nom", formData.nom.trim())
      body.append("description", formData.description.trim())
      body.append("unite_id", formData.unite_id)
      body.append("unite_achat_id", formData.unite_achat_id)
      body.append("facteur_achat", formData.facteur_achat)
      body.append("prix_achat", formData.prix_achat)
      if (formData.devise_achat_id) body.append("devise_achat_id", formData.devise_achat_id)
      body.append("seuil_alerte", String(Number(formData.seuil_alerte || 0) * getFormUnitFactor(formData.seuil_alerte_unite_id || formData.unite_id)))
      formData.unites_vente.forEach((unit, index) => {
        body.append(`unites_vente[${index}][id_unite]`, unit.id_unite)
        body.append(`unites_vente[${index}][facteur]`, unit.facteur)
        body.append(`unites_vente[${index}][prix]`, unit.prix)
        if (unit.id_devise) body.append(`unites_vente[${index}][id_devise]`, unit.id_devise)
      })
      if (!editing) {
        formData.stock_initial.forEach((line, index) => {
          body.append(`stock_initial[${index}][id_unite]`, line.id_unite)
          body.append(`stock_initial[${index}][quantite]`, line.quantite)
        })
      }
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
                    <TableCell className="font-medium">
                      <button type="button" className="text-left hover:text-primary hover:underline" onClick={() => void openDetails(product)}>
                        {product.nom}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{product.categorie?.nom ?? `#${product.categorie_id}`}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.unite ? `${product.unite.nom} (${product.unite.symbole})` : `#${product.unite_id}`}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Achat : {product.unitesAchat?.[0]?.unite?.symbole ?? product.unite?.symbole ?? "—"} × {product.unitesAchat?.[0]?.facteur ?? "1"}
                      </p>
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

      <Dialog open={Boolean(selectedProduct)} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Package className="h-5 w-5" />
                  </span>
                  <span>{selectedProduct.nom}</span>
                </DialogTitle>
                <DialogDescription>{selectedProduct.code} · {selectedProduct.categorie?.nom ?? "Sans catégorie"}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Stock disponible</p>
                      {isLoadingDetails ? (
                        <Loader2 className="mt-2 h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <p className="mt-1 text-xl font-semibold">
                          {detailStock === null ? "—" : getStockBreakdown(selectedProduct, detailStock)}
                        </p>
                      )}
                    </div>
                    <Boxes className="h-6 w-6 text-primary" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Référence : {selectedProduct.unite?.nom ?? "Unité"} ({selectedProduct.unite?.symbole ?? "—"})
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Seuil d'alerte : {Number(selectedProduct.seuil_alerte ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 4 })} {selectedProduct.unite?.symbole ?? "unités"}
                  </p>
                </div>

                <section className="space-y-3">
                  <div>
                    <h3 className="font-semibold">Unités d'achat</h3>
                    <p className="text-sm text-muted-foreground">Conversions enregistrées pour les réceptions.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedProduct.unitesAchat ?? []).map(unit => (
                      <Badge key={unit.id} variant="outline">
                        {unit.unite?.nom ?? "Unité"} · 1 = {unit.facteur} {selectedProduct.unite?.symbole ?? "réf."}
                      </Badge>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <div>
                    <h3 className="font-semibold">Prix par unité de vente</h3>
                    <p className="text-sm text-muted-foreground">Prix enregistrés pour chaque format de vente.</p>
                  </div>
                  <div className="divide-y rounded-xl border px-4">
                    {(selectedProduct.unitesVente ?? []).map(unit => (
                      <div key={unit.id} className="flex items-center justify-between gap-4 py-3">
                        <span className="font-medium">
                          {unit.unite?.nom ?? "Unité"}{unit.id_unite === selectedProduct.unite_id ? " · base" : ""}
                        </span>
                        <span className="font-semibold">
                          {unit.prix !== null && unit.prix !== undefined || latestProcurementLine
                            ? `${getPriceForSaleUnit(unit).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${unit.devise?.symbole ?? unit.devise?.code ?? detailCurrency}`
                            : "Aucun prix enregistré"}
                        </span>
                      </div>
                    ))}
                    {(selectedProduct.unitesVente ?? []).length === 0 && (
                      <p className="py-3 text-sm text-muted-foreground">Aucune unité de vente configurée.</p>
                    )}
                  </div>
                </section>

                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => { setSelectedProduct(null); openEdit(selectedProduct) }}>
                    <Edit className="mr-2 h-4 w-4" />Modifier
                  </Button>
                  <Button asChild>
                    <Link href={`/admin/approvisionnements?produit=${selectedProduct.id}`}>
                      <Truck className="mr-2 h-4 w-4" />Recevoir du stock
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="flex h-[90dvh] max-h-[90dvh] max-w-2xl flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] sm:p-6">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
            <DialogDescription>
              {formStep === 1 ? "Achat" : formStep === 2 ? "Vente" : "Stock initial"} · Étape {formStep} sur 3
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-2 border-y px-4 py-3 sm:border-0 sm:px-0 sm:py-1">
            {SETUP_STEPS.map((label, index) => {
              const step = index + 1
              const active = formStep === step
              const completed = formStep > step
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => step < formStep && setFormStep(step)}
                  disabled={step > formStep}
                  className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${active ? "bg-primary text-primary-foreground" : completed ? "text-foreground" : "text-muted-foreground"}`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${active ? "bg-primary-foreground/20" : completed ? "bg-emerald-100 text-emerald-700" : "bg-muted"}`}>
                    {completed ? <Check className="h-3.5 w-3.5" /> : step}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4 sm:px-0 sm:py-1 lg:grid-cols-[1fr_0.7fr]">
              <div className="space-y-4">
                {formStep === 1 && (
                  <>
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
                    <Label htmlFor="unite_id">Unité de base du stock *</Label>
                    <Select value={formData.unite_id} onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      unite_id: value,
                      unite_achat_id: prev.unite_achat_id === prev.unite_id ? value : prev.unite_achat_id,
                      unites_vente: [
                        { id_unite: value, facteur: "1", prix: "", id_devise: formData.devise_achat_id || String(devises[0]?.id ?? "") },
                        ...prev.unites_vente.filter(unit => unit.id_unite !== prev.unite_id && unit.id_unite !== value),
                      ],
                      stock_initial: prev.stock_initial.filter(line => line.id_unite !== prev.unite_id),
                      seuil_alerte_unite_id: prev.seuil_alerte_unite_id === prev.unite_id ? value : prev.seuil_alerte_unite_id,
                    }))}>
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

                <div className="space-y-3 rounded-xl border p-4">
                  <div>
                    <h3 className="font-medium">Unité d'achat</h3>
                    <p className="text-sm text-muted-foreground">Définis combien d'unités de stock contient un achat.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                    <Select value={formData.unite_achat_id} onValueChange={(value) => setFormData(prev => ({ ...prev, unite_achat_id: value }))}>
                      <SelectTrigger><SelectValue placeholder="Choisir l'unité d'achat" /></SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {unites.map(unite => <SelectItem key={unite.id} value={String(unite.id)}>{unite.nom} ({unite.symbole})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0.00000001"
                      step="any"
                      value={formData.facteur_achat}
                      onChange={(event) => setFormData(prev => ({ ...prev, facteur_achat: event.target.value }))}
                      aria-label="Unités de référence par unité d'achat"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">1 {unites.find(unit => String(unit.id) === formData.unite_achat_id)?.symbole ?? "unité d'achat"} = {formData.facteur_achat || "0"} {unites.find(unit => String(unit.id) === formData.unite_id)?.symbole ?? "unité de référence"}</p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                    <div className="space-y-1">
                      <Label htmlFor="prix_achat">Prix d'achat ({unites.find(unit => String(unit.id) === formData.unite_achat_id)?.symbole ?? "unité"})</Label>
                      <Input id="prix_achat" type="number" min="0" step="any" inputMode="decimal" value={formData.prix_achat} onChange={event => setFormData(prev => ({ ...prev, prix_achat: event.target.value }))} placeholder="Facultatif" />
                    </div>
                    <div className="space-y-1">
                      <Label>Devise</Label>
                      <Select value={formData.devise_achat_id} onValueChange={value => setFormData(prev => ({ ...prev, devise_achat_id: value }))}>
                        <SelectTrigger><SelectValue placeholder="Devise" /></SelectTrigger>
                        <SelectContent>{devises.map(devise => <SelectItem key={devise.id} value={String(devise.id)}>{devise.symbole} · {devise.code}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                  </>
                )}

                {formStep === 2 && (
                  <section className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">Tu vends en</h3>
                        <p className="text-sm text-muted-foreground">Ajoute les formats et indique combien d'unités de stock contient chacun.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, unites_vente: [...prev.unites_vente, { id_unite: "", facteur: "1", prix: "", id_devise: prev.devise_achat_id }] }))}
                      >
                        <Plus className="mr-2 h-4 w-4" />Ajouter
                      </Button>
                    </div>

                    {formData.unites_vente.map((unit, index) => {
                      const isBaseUnit = unit.id_unite === formData.unite_id
                      const unitLabel = unites.find(option => String(option.id) === unit.id_unite)?.symbole ?? "unité"
                      const purchaseCost = Number(formData.prix_achat) / Math.max(Number(formData.facteur_achat), 0.00000001) * Number(unit.facteur || 1)
                      const salePrice = Number(unit.prix)
                      const margin = salePrice - purchaseCost
                      const marginPercent = salePrice > 0 ? margin / salePrice * 100 : 0
                      const sameCurrency = unit.id_devise === formData.devise_achat_id

                      return (
                        <div key={`${index}-${unit.id_unite}`} className="space-y-3 rounded-xl border bg-background p-4">
                          <div className="grid items-center gap-3 sm:grid-cols-[1fr_150px_auto]">
                            <Select
                              value={unit.id_unite}
                              onValueChange={(value) => setFormData(prev => ({
                                ...prev,
                                unites_vente: prev.unites_vente.map((entry, entryIndex) => entryIndex === index
                                  ? { ...entry, id_unite: value, facteur: value === prev.unite_id ? "1" : value === prev.unite_achat_id ? prev.facteur_achat : entry.facteur, id_devise: entry.id_devise || prev.devise_achat_id }
                                  : entry),
                              }))}
                            >
                              <SelectTrigger><SelectValue placeholder="Choisir l'unité de vente" /></SelectTrigger>
                              <SelectContent className="max-h-60 overflow-y-auto">
                                {unites.map(unite => <SelectItem key={unite.id} value={String(unite.id)}>{unite.nom} ({unite.symbole})</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0.00000001"
                              step="any"
                              value={isBaseUnit ? "1" : unit.facteur}
                              disabled={isBaseUnit}
                              onChange={event => setFormData(prev => ({ ...prev, unites_vente: prev.unites_vente.map((entry, entryIndex) => entryIndex === index ? { ...entry, facteur: event.target.value } : entry) }))}
                              aria-label="Quantité de référence par unité vendue"
                              required
                            />
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">{unites.find(option => String(option.id) === formData.unite_id)?.symbole ?? "réf."} / {unitLabel}</span>
                              {!isBaseUnit && <Button type="button" variant="ghost" size="icon" aria-label="Retirer cette unité" onClick={() => setFormData(prev => ({ ...prev, unites_vente: prev.unites_vente.filter((_, entryIndex) => entryIndex !== index) }))}><Trash2 className="h-4 w-4" /></Button>}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                            <div className="space-y-1">
                              <Label htmlFor={`prix-vente-${index}`}>Prix de vente (par {unitLabel})</Label>
                              <Input
                                id={`prix-vente-${index}`}
                                type="number"
                                min="0"
                                step="any"
                                inputMode="decimal"
                                value={unit.prix}
                                onChange={event => setFormData(prev => ({ ...prev, unites_vente: prev.unites_vente.map((entry, entryIndex) => entryIndex === index ? { ...entry, prix: event.target.value } : entry) }))}
                                placeholder="Facultatif"
                              />
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {devises.map(devise => (
                                <Button key={devise.id} type="button" size="sm" variant={unit.id_devise === String(devise.id) ? "default" : "outline"} onClick={() => setFormData(prev => ({ ...prev, unites_vente: prev.unites_vente.map((entry, entryIndex) => entryIndex === index ? { ...entry, id_devise: String(devise.id) } : entry) }))}>
                                  {devise.symbole}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {unit.prix !== "" && formData.prix_achat !== "" && (
                            <div className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${sameCurrency && margin >= 0 ? "bg-emerald-50 text-emerald-700" : sameCurrency ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                              {sameCurrency
                                ? `Marge : ${margin >= 0 ? "+" : ""}${margin.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${devises.find(devise => String(devise.id) === unit.id_devise)?.symbole ?? ""} (${marginPercent.toFixed(1)}%)`
                                : "Choisis la même devise pour comparer la marge."}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </section>
                )}

                {formStep === 1 && <div className="space-y-1">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Détails du produit, notes, ingrédients, etc."
                  />
                </div>}

                {formStep === 3 && (
                  <section className="space-y-5">
                    <div>
                      <h3 className="font-semibold">Quantité initiale par format</h3>
                      <p className="text-sm text-muted-foreground">Saisis les quantités que tu as déjà en stock.</p>
                    </div>
                    {!editing ? (
                      <div className="divide-y rounded-xl border bg-background px-4">
                        {openingStockUnits.map(unit => {
                          const quantity = formData.stock_initial.find(line => line.id_unite === unit.id)?.quantite ?? "0"
                          return (
                            <div key={unit.id} className="flex items-center justify-between gap-4 py-3">
                              <Label htmlFor={`stock-initial-${unit.id}`} className="font-medium">{unit.label}</Label>
                              <Input
                                id={`stock-initial-${unit.id}`}
                                type="number"
                                min="0"
                                step="any"
                                inputMode="decimal"
                                className="w-32 text-center"
                                value={quantity}
                                onChange={event => setFormData(prev => {
                                  const exists = prev.stock_initial.some(line => line.id_unite === unit.id)
                                  const stock = exists
                                    ? prev.stock_initial.map(line => line.id_unite === unit.id ? { ...line, quantite: event.target.value } : line)
                                    : [...prev.stock_initial, { id_unite: unit.id, quantite: event.target.value }]
                                  return { ...prev, stock_initial: stock }
                                })}
                              />
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                        La modification du produit ne change pas le stock existant. Utilise « Recevoir du stock » depuis sa fiche pour ajouter des quantités.
                      </div>
                    )}
                    <div className="rounded-lg bg-primary/10 px-4 py-3 text-center font-semibold text-primary">
                      Stock initial total : {initialStockTotal.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} {unites.find(unit => String(unit.id) === formData.unite_id)?.symbole ?? "unités"}
                    </div>
                    <div className="space-y-2 rounded-xl border p-4">
                      <Label>Seuil d'alerte stock bas</Label>
                      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                        <Select value={formData.seuil_alerte_unite_id} onValueChange={value => setFormData(prev => ({ ...prev, seuil_alerte_unite_id: value }))}>
                          <SelectTrigger><SelectValue placeholder="Unité du seuil" /></SelectTrigger>
                          <SelectContent>{openingStockUnits.map(unit => <SelectItem key={unit.id} value={unit.id}>{unit.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" min="0" step="any" inputMode="decimal" value={formData.seuil_alerte} onChange={event => setFormData(prev => ({ ...prev, seuil_alerte: event.target.value }))} aria-label="Seuil d'alerte" />
                      </div>
                      <p className="text-xs text-muted-foreground">Le seuil sera enregistré en {unites.find(unit => String(unit.id) === formData.unite_id)?.symbole ?? "unité de référence"}.</p>
                    </div>
                  </section>
                )}
              </div>

              {formStep === 1 && <div className="space-y-4 rounded-2xl border bg-gradient-to-br from-slate-50 to-emerald-50 p-4">
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
              </div>}
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between gap-3 border-t bg-background px-4 py-3 sm:px-0 sm:pt-4">
              <Button type="button" variant="ghost" onClick={() => formStep > 1 ? setFormStep(step => step - 1) : closeDialog()}>
                <ChevronLeft className="mr-1 h-4 w-4" />{formStep > 1 ? "Retour" : "Annuler"}
              </Button>
              <span className="text-xs text-muted-foreground">{formStep} / 3</span>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : formStep < 3 ? null : <Check className="mr-2 h-4 w-4" />}
                {formStep < 3 ? "Continuer" : editing ? "Enregistrer le produit" : "Enregistrer le produit"}
                {formStep < 3 && <ChevronRight className="ml-1 h-4 w-4" />}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
