"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarDays, Edit, Loader2, MoreHorizontal, Package, Plus, RefreshCw, Search, Trash2, Boxes, Truck, X, Eye, Filter, ArrowUpDown, Layers, TrendingUp, DollarSign, History, Save } from "lucide-react"
import { backendRequest } from "@/app/services/backend"
import formatMoney from "@/lib/formatMoney"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Fournisseur {
  id: number
  nom: string
}

interface UserLite {
  id: number
  name?: string
  nom?: string
  email?: string
}

interface Devise {
  id: number
  code: string
  nom: string
  symbole: string
}

interface Produit {
  id: number
  code: string
  nom: string
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
}

interface LigneRaw {
  id: number
  id_approvisionnement: number
  id_produit: number
  quantite: number
  prix_unitaire: string
  prix_vente: string | null
  id_devise: number
  produit?: Produit
  devise?: Devise
  lots?: LotRaw[]
}

interface ApprovisionnementRaw {
  id: number
  code: string
  date: string
  id_user: number
  id_fournisseur: number
  fournisseur?: Fournisseur
  user?: UserLite
  lignes?: LigneRaw[]
}

interface Approvisionnement extends ApprovisionnementRaw {
  fournisseur: Fournisseur | undefined
  user: UserLite | undefined
  lignes: LigneRaw[]
}

interface ProductSelection {
  selected: boolean
  quantite: string
  prix_unitaire: string
  prix_vente: string
  id_devise: string
  paye_par_caisse: boolean
}

// Composant pour modifier la devise d'une ligne individuelle
function EditSingleLigneDialog({ 
  ligne, 
  devises, 
  open, 
  onClose, 
  onSave 
}: { 
  ligne: LigneRaw | null
  devises: Devise[]
  open: boolean
  onClose: () => void
  onSave: (id: number, id_devise: number) => Promise<void>
}) {
  const [selectedDevise, setSelectedDevise] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (ligne) {
      setSelectedDevise(String(ligne.id_devise))
    }
  }, [ligne])

  const handleSave = async () => {
    if (!ligne) return
    setIsSaving(true)
    try {
      await onSave(ligne.id, Number(selectedDevise))
      onClose()
    } catch (error) {
      console.error("Erreur lors de la modification", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la devise - {ligne?.produit?.nom}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 rounded-lg bg-muted/50 p-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Produit:</span>
              <span className="font-medium">{ligne?.produit?.nom ?? `#${ligne?.id_produit}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Quantité:</span>
              <span className="font-medium">{ligne?.quantite}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Prix unitaire:</span>
              <span className="font-medium">{ligne?.prix_unitaire}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Prix vente:</span>
              <span className="font-medium">{ligne?.prix_vente ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Devise actuelle:</span>
              <Badge variant="outline">{ligne?.devise?.code || `#${ligne?.id_devise}`}</Badge>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Nouvelle devise *</Label>
            <Select value={selectedDevise} onValueChange={setSelectedDevise}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une devise" />
              </SelectTrigger>
              <SelectContent>
                {devises.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.symbole} - {d.code} - {d.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Composant pour modifier la devise de plusieurs produits
function EditMultipleLignesDialog({ 
  lignes, 
  devises, 
  open, 
  onClose, 
  onSaveMultiple 
}: { 
  lignes: LigneRaw[]
  devises: Devise[]
  open: boolean
  onClose: () => void
  onSaveMultiple: (updates: { id: number; id_devise: number }[]) => Promise<void>
}) {
  const [selectedDevise, setSelectedDevise] = useState<string>("")
  const [selectedLignes, setSelectedLignes] = useState<Set<number>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    // Par défaut, sélectionner toutes les lignes
    if (lignes.length > 0) {
      setSelectedLignes(new Set(lignes.map(l => l.id)))
    }
  }, [lignes])

  const toggleLigne = (ligneId: number) => {
    const newSelected = new Set(selectedLignes)
    if (newSelected.has(ligneId)) {
      newSelected.delete(ligneId)
    } else {
      newSelected.add(ligneId)
    }
    setSelectedLignes(newSelected)
  }

  const toggleAll = () => {
    if (selectedLignes.size === lignes.length) {
      setSelectedLignes(new Set())
    } else {
      setSelectedLignes(new Set(lignes.map(l => l.id)))
    }
  }

  const handleSave = async () => {
    if (selectedLignes.size === 0) {
      alert("Veuillez sélectionner au moins un produit")
      return
    }
    if (!selectedDevise) {
      alert("Veuillez sélectionner une devise")
      return
    }

    setIsSaving(true)
    try {
      const updates = Array.from(selectedLignes).map(id => ({
        id,
        id_devise: Number(selectedDevise)
      }))
      await onSaveMultiple(updates)
      onClose()
    } catch (error) {
      console.error("Erreur lors de la modification", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Modifier la devise pour plusieurs produits</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label>Nouvelle devise pour les produits sélectionnés *</Label>
            <Select value={selectedDevise} onValueChange={setSelectedDevise}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une devise" />
              </SelectTrigger>
              <SelectContent>
                {devises.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.symbole} - {d.code} - {d.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedLignes.size === lignes.length}
                  onCheckedChange={toggleAll}
                />
                <span className="font-medium">Sélectionner tout</span>
              </div>
              <Badge variant="secondary">{selectedLignes.size} produit(s) sélectionné(s)</Badge>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Prix unitaire</TableHead>
                    <TableHead>Prix vente</TableHead>
                    <TableHead>Devise actuelle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map(ligne => (
                    <TableRow key={ligne.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLignes.has(ligne.id)}
                          onCheckedChange={() => toggleLigne(ligne.id)}
                        />
                      </TableCell>
                      <TableCell>{ligne.produit?.nom ?? `#${ligne.id_produit}`}</TableCell>
                      <TableCell>{ligne.quantite}</TableCell>
                      <TableCell>{ligne.prix_unitaire}</TableCell>
                      <TableCell>{ligne.prix_vente ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ligne.devise?.code || `#${ligne.id_devise}`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedDevise}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Appliquer la devise à {selectedLignes.size} produit(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const getLocalDateValue = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const TODAY = getLocalDateValue()

const EMPTY_FORM = {
  date: TODAY,
  id_fournisseur: "",
}

function normalizeAppro(raw: ApprovisionnementRaw): Approvisionnement {
  return {
    ...raw,
    fournisseur: raw.fournisseur,
    user: raw.user,
    lignes: raw.lignes ?? [],
  }
}

// use centralized formatMoney util

function createEmptySelection(): ProductSelection {
  return {
    selected: false,
    quantite: "",
    prix_unitaire: "",
    prix_vente: "",
    id_devise: "",
    paye_par_caisse: false,
  }
}

export default function ApprovisionnementsPage() {
  const [approvisionnements, setApprovisionnements] = useState<Approvisionnement[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [devises, setDevises] = useState<Devise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Approvisionnement | null>(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState("")
  const [productSelections, setProductSelections] = useState<Record<number, ProductSelection>>({})
  const [productSearch, setProductSearch] = useState("")
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [selectedApprovisionnement, setSelectedApprovisionnement] = useState<Approvisionnement | null>(null)
  const [historySearch, setHistorySearch] = useState("")
  const [showOnlyWithLines, setShowOnlyWithLines] = useState(false)
  
  // Nouveaux états pour l'édition de devise
  const [editingLigne, setEditingLigne] = useState<LigneRaw | null>(null)
  const [showMultipleEditDialog, setShowMultipleEditDialog] = useState(false)
  const [isUpdatingDevise, setIsUpdatingDevise] = useState(false)

  const fetchLookups = useCallback(async () => {
    const [fournisseursRes, produitsRes, devisesRes, currentUserRes] = await Promise.all([
      backendRequest<{ data: Fournisseur[] }>("/fournisseurs?per_page=all"),
      backendRequest<{ data: Produit[] }>("/produits?per_page=all"),
      backendRequest<{ data: Devise[] }>("/devises?per_page=all"),
      backendRequest<UserLite>("/user"),
    ])
    setFournisseurs(fournisseursRes.data ?? [])
    setProduits(produitsRes.data ?? [])
    setDevises(devisesRes.data ?? [])
    setCurrentUserId(currentUserRes.id)
  }, [])

  const fetchApprovisionnements = useCallback(async (q = "") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (q.trim()) params.set("search", q.trim())
      const res = await backendRequest<{ data: ApprovisionnementRaw[] }>(`/approvisionnements?${params.toString()}`)
      setApprovisionnements((res.data ?? []).map(normalizeAppro))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fonction pour mettre à jour la devise d'une seule ligne
  const handleUpdateSingleLigneDevise = async (ligneId: number, id_devise: number) => {
    setIsUpdatingDevise(true)
    try {
      const response = await backendRequest<{ data: LigneRaw }>(`/lignes-approvisionnements/${ligneId}`, {
        method: "PUT",
        body: JSON.stringify({ id_devise }),
      })
      
      // Mettre à jour l'affichage local
      if (selectedApprovisionnement) {
        const updatedLignes = selectedApprovisionnement.lignes.map(ligne =>
          ligne.id === ligneId ? { 
            ...ligne, 
            id_devise, 
            devise: devises.find(d => d.id === id_devise)
          } : ligne
        )
        setSelectedApprovisionnement({
          ...selectedApprovisionnement,
          lignes: updatedLignes
        })
      }
      
      // Mettre à jour dans la liste principale
      setApprovisionnements(prev => prev.map(appro => {
        if (appro.id === selectedApprovisionnement?.id) {
          return {
            ...appro,
            lignes: appro.lignes.map(ligne =>
              ligne.id === ligneId ? { 
                ...ligne, 
                id_devise, 
                devise: devises.find(d => d.id === id_devise)
              } : ligne
            )
          }
        }
        return appro
      }))
      
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la devise", error)
      throw error
    } finally {
      setIsUpdatingDevise(false)
    }
  }

  // Fonction pour mettre à jour la devise de plusieurs lignes
  const handleUpdateMultipleLignesDevise = async (updates: { id: number; id_devise: number }[]) => {
    setIsUpdatingDevise(true)
    try {
      // Appel API pour chaque mise à jour (ou un endpoint batch)
      for (const update of updates) {
        await backendRequest<{ data: LigneRaw }>(`/lignes-approvisionnements/${update.id}`, {
          method: "PUT",
          body: JSON.stringify({ id_devise: update.id_devise }),
        })
      }
      
      // Mettre à jour l'affichage local
      if (selectedApprovisionnement) {
        const updatedLignes = selectedApprovisionnement.lignes.map(ligne => {
          const update = updates.find(u => u.id === ligne.id)
          if (update) {
            return {
              ...ligne,
              id_devise: update.id_devise,
              devise: devises.find(d => d.id === update.id_devise)
            }
          }
          return ligne
        })
        setSelectedApprovisionnement({
          ...selectedApprovisionnement,
          lignes: updatedLignes
        })
      }
      
      // Mettre à jour dans la liste principale
      setApprovisionnements(prev => prev.map(appro => {
        if (appro.id === selectedApprovisionnement?.id) {
          return {
            ...appro,
            lignes: appro.lignes.map(ligne => {
              const update = updates.find(u => u.id === ligne.id)
              if (update) {
                return {
                  ...ligne,
                  id_devise: update.id_devise,
                  devise: devises.find(d => d.id === update.id_devise)
                }
              }
              return ligne
            })
          }
        }
        return appro
      }))
      
    } catch (error) {
      console.error("Erreur lors de la mise à jour des devises", error)
      throw error
    } finally {
      setIsUpdatingDevise(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([fetchLookups(), fetchApprovisionnements()])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur de chargement")
      }
    })()
  }, [fetchLookups, fetchApprovisionnements])

  useEffect(() => {
    const timer = setTimeout(() => fetchApprovisionnements(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput, fetchApprovisionnements])

  const openCreate = () => {
    setEditing(null)
    setFormData({ ...EMPTY_FORM })
    setProductSelections({})
    setProductSearch("")
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (approvisionnement: Approvisionnement) => {
    setEditing(approvisionnement)
    setFormData({
      date: approvisionnement.date,
      id_fournisseur: String(approvisionnement.id_fournisseur),
    })
    setProductSelections({})
    setProductSearch("")
    setFormError("")
    setShowDialog(true)
  }

  const openDetails = (approvisionnement: Approvisionnement) => {
    setSelectedApprovisionnement(approvisionnement)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditing(null)
    setFormError("")
  }

  const toggleProduct = (productId: number) => {
    setProductSelections(prev => {
      const current = prev[productId] ?? createEmptySelection()
      const defaultDeviseId = devises[0] ? String(devises[0].id) : ""
      return {
        ...prev,
        [productId]: {
          ...current,
          selected: !current.selected,
          id_devise: current.id_devise || defaultDeviseId,
        },
      }
    })
  }

  function updateProductSelection<K extends keyof ProductSelection>(productId: number, key: K, value: ProductSelection[K]) {
    setProductSelections(prev => {
      const current = prev[productId] ?? createEmptySelection()
      return {
        ...prev,
        [productId]: {
          ...current,
          [key]: value,
        },
      }
    })
  }

  const selectAllVisibleProducts = () => {
    const filteredIds = filteredProducts.map(product => product.id)
    setProductSelections(prev => {
      const next = { ...prev }
      for (const product of produits) {
        if (filteredIds.includes(product.id)) {
          const current = next[product.id] ?? createEmptySelection()
          next[product.id] = {
            ...current,
            selected: true,
          }
        }
      }
      return next
    })
  }

  const clearVisibleProducts = () => {
    const filteredIds = filteredProducts.map(product => product.id)
    setProductSelections(prev => {
      const next = { ...prev }
      for (const productId of filteredIds) {
        const current = next[productId] ?? createEmptySelection()
        next[productId] = {
          ...current,
          selected: false,
        }
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.date || !formData.id_fournisseur) {
      setFormError("La date et le fournisseur sont obligatoires.")
      return
    }
    if (formData.date !== TODAY) {
      setFormError("La date doit être la date du jour.")
      return
    }
    if (!currentUserId) {
      setFormError("Utilisateur courant introuvable.")
      return
    }

    if (!editing) {
      const selectedLines = produits
        .map(product => {
          const selection = productSelections[product.id]
          if (!selection?.selected) return null

          return {
            id_produit: product.id,
            quantite: Number(selection.quantite),
            prix_unitaire: Number(selection.prix_unitaire),
            prix_vente: selection.prix_vente === "" ? null : Number(selection.prix_vente),
            id_devise: Number(selection.id_devise),
          }
        })
        .filter((line): line is { id_produit: number; quantite: number; prix_unitaire: number; prix_vente: number | null; id_devise: number } => line !== null)

      const hasInvalidLine = selectedLines.some(line => !Number.isFinite(line.quantite) || line.quantite <= 0 || !Number.isFinite(line.prix_unitaire) || line.prix_unitaire < 0 || !line.id_devise || (line.prix_vente !== null && (!Number.isFinite(line.prix_vente) || line.prix_vente < 0)))
      if (hasInvalidLine || selectedLines.length === 0) {
        setFormError("Coche au moins un produit et renseigne une quantité positive, un prix d'achat décimal, un prix de vente valide et une devise.")
        return
      }
    }

    setIsSaving(true)
    setFormError("")

    try {
      const body: Record<string, unknown> = {
        date: formData.date,
        id_fournisseur: Number(formData.id_fournisseur),
        id_user: currentUserId,
      }

      if (!editing) {
        body.lignes = produits
          .map(product => {
            const selection = productSelections[product.id]
            if (!selection?.selected) return null

            return {
              id_produit: product.id,
              quantite: Number(selection.quantite),
              prix_unitaire: Number(selection.prix_unitaire),
              prix_vente: selection.prix_vente === "" ? null : Number(selection.prix_vente),
              id_devise: Number(selection.id_devise),
              paye_par_caisse: Boolean(selection.paye_par_caisse),
            }
          })
          .filter((line): line is {
            id_produit: number;
            quantite: number;
            prix_unitaire: number;
            prix_vente: number | null;
            id_devise: number;
            paye_par_caisse: boolean;
          } => line !== null)
      }

      if (editing) {
        const res = await backendRequest<{ data: ApprovisionnementRaw }>(`/approvisionnements/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
        setApprovisionnements(prev => prev.map(a => a.id === editing.id ? normalizeAppro(res.data) : a))
      } else {
        const res = await backendRequest<{ data: ApprovisionnementRaw }>("/approvisionnements", {
          method: "POST",
          body: JSON.stringify(body),
        })
        setApprovisionnements(prev => [normalizeAppro(res.data), ...prev])
      }

      closeDialog()
      fetchApprovisionnements(searchInput)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (approvisionnement: Approvisionnement) => {
    if (!confirm(`Supprimer l'approvisionnement ${approvisionnement.code} ?`)) return
    try {
      await backendRequest(`/approvisionnements/${approvisionnement.id}`, { method: "DELETE" })
      setApprovisionnements(prev => prev.filter(a => a.id !== approvisionnement.id))
      if (selectedApprovisionnement?.id === approvisionnement.id) {
        setSelectedApprovisionnement(null)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  const summaryLines = useMemo(() => selectedApprovisionnement?.lignes ?? [], [selectedApprovisionnement])

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return produits
    const q = productSearch.trim().toLowerCase()
    return produits.filter(product =>
      product.nom.toLowerCase().includes(q) ||
      product.code.toLowerCase().includes(q),
    )
  }, [produits, productSearch])

  const selectedProductsCount = useMemo(() => {
    return produits.reduce((count, product) => count + (productSelections[product.id]?.selected ? 1 : 0), 0)
  }, [produits, productSelections])

  const historyStats = useMemo(() => {
    const totalApprovisionnements = approvisionnements.length
    const totalFournisseurs = new Set(approvisionnements.map(item => item.id_fournisseur)).size
    const totalUnits = approvisionnements.reduce((sum, item) => sum + (item.lignes?.reduce((lSum, line) => lSum + (Number(line.quantite) || 0), 0) || 0), 0)
    const totalAmount = approvisionnements.reduce((sum, item) => sum + (item.lignes?.reduce((lSum, line) => {
      const qty = Number(line.quantite) || 0
      const unit = Number(line.prix_unitaire) || 0
      return lSum + (qty * unit)
    }, 0) || 0), 0)

    return { totalApprovisionnements, totalFournisseurs, totalUnits, totalAmount }
  }, [approvisionnements])

  const filteredHistory = useMemo(() => {
    let result = [...approvisionnements]
    if (historySearch.trim()) {
      const q = historySearch.trim().toLowerCase()
      result = result.filter(item =>
        item.code.toLowerCase().includes(q) ||
        item.fournisseur?.nom?.toLowerCase().includes(q) ||
        item.user?.name?.toLowerCase().includes(q) ||
        item.user?.nom?.toLowerCase().includes(q),
      )
    }
    if (showOnlyWithLines) {
      result = result.filter(item => (item.lignes?.length ?? 0) > 0)
    }
    return result
  }, [approvisionnements, historySearch, showOnlyWithLines])

  return (
    <div className="space-y-6 pb-24">
      <div className="rounded-2xl border bg-gradient-to-r from-slate-50 via-white to-orange-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stock / achats</p>
            <h1 className="text-2xl lg:text-3xl font-bold">Approvisionnements</h1>
            <p className="text-muted-foreground">Créer un approvisionnement rapidement, avec un ou plusieurs produits, sans surcharge de détails.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fetchApprovisionnements(searchInput)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel approvisionnement
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Boxes className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approvisionnements</p>
                <p className="text-2xl font-bold">{historyStats.totalApprovisionnements}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fournisseurs</p>
                <p className="text-2xl font-bold">{historyStats.totalFournisseurs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Layers className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unités entrées</p>
                <p className="text-2xl font-bold">{historyStats.totalUnits}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Montant total</p>
                <p className="text-2xl font-bold">{historyStats.totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="details">Détails</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="relative lg:col-span-2">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Rechercher par code, fournisseur ou utilisateur..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>
                <Button
                  variant={showOnlyWithLines ? "default" : "outline"}
                  onClick={() => setShowOnlyWithLines(prev => !prev)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {showOnlyWithLines ? "Avec lignes" : "Tous les documents"}
                </Button>
              </div>

              <div className="flex justify-between items-center rounded-xl border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{filteredHistory.length} document(s) trouvé(s)</p>
                  <p className="text-xs text-muted-foreground">Les lignes et lots sont générés automatiquement à l'enregistrement.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setHistorySearch(""); setShowOnlyWithLines(false) }}>
                  <X className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  Aucun approvisionnement trouvé.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Produits</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map(approvisionnement => {
                      const totalAmount = (approvisionnement.lignes ?? []).reduce((sum, line) => {
                        const qty = Number(line.quantite) || 0
                        const unit = Number(line.prix_unitaire) || 0
                        return sum + (qty * unit)
                      }, 0)

                      return (
                        <TableRow key={approvisionnement.id}>
                          <TableCell className="font-mono text-xs">{approvisionnement.code}</TableCell>
                          <TableCell>{approvisionnement.date}</TableCell>
                          <TableCell>{approvisionnement.fournisseur?.nom ?? `#${approvisionnement.id_fournisseur}`}</TableCell>
                          <TableCell>{approvisionnement.user?.name ?? approvisionnement.user?.nom ?? `#${approvisionnement.id_user}`}</TableCell>
                          <TableCell><Badge variant="secondary">{approvisionnement.lignes?.length ?? 0}</Badge></TableCell>
                          <TableCell className="font-semibold text-emerald-600">{totalAmount.toFixed(2)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openDetails(approvisionnement)}>
                                  <Eye className="mr-2 h-4 w-4" />Détails
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(approvisionnement)}>
                                  <Edit className="mr-2 h-4 w-4" />Modifier l'en-tête
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(approvisionnement)}>
                                  <Trash2 className="mr-2 h-4 w-4" />Supprimer
                                </DropdownMenuItem>
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

        <TabsContent value="details" className="space-y-4">
          {selectedApprovisionnement ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Détails de {selectedApprovisionnement.code}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">Vue compacte des produits réapprovisionnés.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowMultipleEditDialog(true)}
                        disabled={summaryLines.length === 0}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Modifier devise (plusieurs)
                      </Button>
                      <Badge variant="secondary">{selectedApprovisionnement.lignes?.length ?? 0} ligne(s)</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>Quantité</TableHead>
                        <TableHead>Prix unitaire</TableHead>
                        <TableHead>Prix vente</TableHead>
                        <TableHead>Devise</TableHead>
                        <TableHead>Lots</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaryLines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune ligne associée</TableCell>
                        </TableRow>
                      ) : summaryLines.map(ligne => (
                        <TableRow key={ligne.id}>
                          <TableCell>{ligne.produit?.nom ?? `#${ligne.id_produit}`}</TableCell>
                          <TableCell>{ligne.quantite}</TableCell>
                          <TableCell>{formatMoney(ligne.prix_unitaire)}</TableCell>
                          <TableCell>{formatMoney(ligne.prix_vente)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50">
                              {ligne.devise?.code || `Devise #${ligne.id_devise}`}
                            </Badge>
                          </TableCell>
                          <TableCell><Badge variant="secondary">{ligne.lots?.length ?? 0}</Badge></TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingLigne(ligne)}
                              title="Modifier la devise"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-40" />
                Choisis un approvisionnement depuis l'onglet Historique pour voir ses détails.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog pour créer/modifier l'approvisionnement */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'approvisionnement" : "Nouvel approvisionnement"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto flex-1 pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="date">Date du jour *</Label>
                <Input id="date" value={formData.date} readOnly />
              </div>
              <div className="space-y-1">
                <Label htmlFor="id_fournisseur">Fournisseur *</Label>
                <Select value={formData.id_fournisseur} onValueChange={(value) => setFormData(prev => ({ ...prev, id_fournisseur: value }))}>
                  <SelectTrigger id="id_fournisseur">
                    <SelectValue placeholder="Choisir un fournisseur" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {fournisseurs.map(f => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editing && (
              <div className="rounded-3xl border bg-gradient-to-br from-muted/50 via-background to-orange-50/40 p-4 space-y-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">Produits à approvisionner</p>
                      <Badge variant="secondary">{selectedProductsCount} sélectionné(s)</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Coche seulement les produits voulus, puis complète prix d'achat, prix de vente et devise.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={selectAllVisibleProducts}>
                      <Plus className="h-4 w-4 mr-2" />Tout cocher
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearVisibleProducts}>
                      <X className="h-4 w-4 mr-2" />Tout décocher
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 rounded-2xl bg-background"
                    placeholder="Rechercher un produit à cocher..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>

                <div className="rounded-3xl border bg-background/90 overflow-hidden">
                  <div className="grid grid-cols-[auto_1.4fr_.7fr_.8fr_.8fr_.8fr_.9fr] gap-3 border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <span></span>
                    <span>Produit</span>
                    <span>Qté</span>
                    <span>Achat</span>
                    <span>Vente</span>
                    <span>En caisse</span>
                    <span>Devise</span>
                  </div>

                  <div className="max-h-[46vh] overflow-y-auto">
                    {filteredProducts.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">
                        Aucun produit trouvé.
                      </div>
                    ) : (
                      filteredProducts.map((product) => {
                        const selection = productSelections[product.id] ?? createEmptySelection()
                        const defaultDeviseId = devises[0] ? String(devises[0].id) : ""

                        return (
                          <div
                            key={product.id}
                            className={`grid grid-cols-[auto_1.4fr_.7fr_.8fr_.8fr_.8fr_.9fr] items-center gap-3 border-b px-4 py-4 transition-colors last:border-b-0 ${selection.selected ? "bg-amber-50/70" : "hover:bg-muted/40"}`}
                          >
                            <Checkbox
                              checked={selection.selected}
                              onCheckedChange={() => toggleProduct(product.id)}
                              aria-label={`Sélectionner ${product.nom}`}
                            />

                            <div className="min-w-0">
                              <p className="truncate font-medium">{product.nom}</p>
                              <p className="text-xs text-muted-foreground font-mono">{product.code}</p>
                            </div>

                            <Input
                              type="number"
                              min="1"
                              inputMode="numeric"
                              disabled={!selection.selected}
                              value={selection.quantite}
                              onChange={(e) => updateProductSelection(product.id, "quantite", e.target.value)}
                              placeholder="0"
                              className="h-10 rounded-xl"
                            />

                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              disabled={!selection.selected}
                              value={selection.prix_unitaire}
                              onChange={(e) => updateProductSelection(product.id, "prix_unitaire", e.target.value)}
                              placeholder="0.00"
                              className="h-10 rounded-xl"
                            />

                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              disabled={!selection.selected}
                              value={selection.prix_vente}
                              onChange={(e) => updateProductSelection(product.id, "prix_vente", e.target.value)}
                              placeholder="0.00"
                              className="h-10 rounded-xl"
                            />

                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={selection.paye_par_caisse}
                                onCheckedChange={(value) => updateProductSelection(product.id, "paye_par_caisse", Boolean(value))}
                                disabled={!selection.selected}
                                aria-label="Prendre dans la caisse"
                              />
                            </div>

                            <Select
                              value={selection.id_devise || defaultDeviseId}
                              onValueChange={(value) => updateProductSelection(product.id, "id_devise", value)}
                              disabled={!selection.selected}
                            >
                              <SelectTrigger className="h-10 rounded-xl">
                                <SelectValue placeholder="Devise" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 overflow-y-auto">
                                {devises.map(d => (
                                  <SelectItem key={d.id} value={String(d.id)}>{d.symbole} - {d.code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/70 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    La quantité, le prix d'achat, le prix de vente et la devise sont saisis directement sur les produits cochés. Coche « En caisse » pour débiter la caisse; sinon, le stock est approvisionné sans mouvement de caisse.
                  </p>
                  <Badge variant="outline" className="rounded-full px-3 py-1">Prix en décimal</Badge>
                </div>
              </div>
            )}

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

      {/* Dialog pour modifier la devise d'une seule ligne */}
      <EditSingleLigneDialog
        ligne={editingLigne}
        devises={devises}
        open={!!editingLigne}
        onClose={() => setEditingLigne(null)}
        onSave={handleUpdateSingleLigneDevise}
      />

      {/* Dialog pour modifier la devise de plusieurs lignes */}
      <EditMultipleLignesDialog
        lignes={summaryLines}
        devises={devises}
        open={showMultipleEditDialog}
        onClose={() => setShowMultipleEditDialog(false)}
        onSaveMultiple={handleUpdateMultipleLignesDevise}
      />
    </div>
  )
}