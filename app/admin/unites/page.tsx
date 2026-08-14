"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Scale, MoreHorizontal, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { backendRequest } from "@/app/services/backend"

interface Unite {
  id: number
  nom: string
  symbole: string
}

interface BackendList {
  status: string
  data: Unite[]
}

interface BackendSingle {
  status: string
  data: Unite
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unite[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unite | null>(null)
  const [formData, setFormData] = useState({ nom: "", symbole: "" })

  const fetchUnits = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await backendRequest<BackendList>("/unites/all")
      setUnits(res.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUnits()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editingUnit) {
        const res = await backendRequest<BackendSingle>(`/unites/${editingUnit.id}`, {
          method: "PUT",
          body: JSON.stringify(formData),
        })
        setUnits(units.map((u) => (u.id === editingUnit.id ? res.data : u)))
      } else {
        const res = await backendRequest<BackendSingle>("/unites", {
          method: "POST",
          body: JSON.stringify(formData),
        })
        setUnits([...units, res.data])
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (unit: Unite) => {
    setEditingUnit(unit)
    setFormData({ nom: unit.nom, symbole: unit.symbole })
    setShowAddDialog(true)
  }

  const handleDelete = async (unit: Unite) => {
    if (!confirm(`Supprimer l'unité "${unit.nom}" ?`)) return
    try {
      await backendRequest(`/unites/${unit.id}`, { method: "DELETE" })
      setUnits(units.filter((u) => u.id !== unit.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression")
    }
  }

  const resetForm = () => {
    setFormData({ nom: "", symbole: "" })
    setEditingUnit(null)
    setShowAddDialog(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Unités de mesure</h1>
          <p className="text-muted-foreground">Gérez les unités : kg, mètre, litre, pièce, etc.</p>
        </div>
        <Dialog
          open={showAddDialog}
          onOpenChange={(open) => {
            if (!open) resetForm()
            else setShowAddDialog(true)
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une unité
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUnit ? "Modifier l'unité" : "Nouvelle unité"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md px-3 py-2">{error}</p>
              )}
              <div>
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  placeholder="ex : Kilogramme, Mètre, Litre"
                  required
                />
              </div>
              <div>
                <Label htmlFor="symbole">Symbole</Label>
                <Input
                  id="symbole"
                  value={formData.symbole}
                  onChange={(e) => setFormData({ ...formData, symbole: e.target.value })}
                  placeholder="ex : kg, m, L, pce"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingUnit ? "Mettre à jour" : "Ajouter"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Annuler
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error banner (outside dialog) */}
      {error && !showAddDialog && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md px-4 py-2">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Units Grid */}
      {!loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {units.map((unit) => (
            <Card key={unit.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Scale className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">
                      {unit.nom}{" "}
                      <span className="text-muted-foreground text-sm font-normal">({unit.symbole})</span>
                    </CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(unit)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(unit)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Symbole : <strong>{unit.symbole}</strong>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && units.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Scale className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">Aucune unité trouvée</h3>
            <p className="text-muted-foreground mb-4">Commencez par ajouter votre première unité de mesure</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une unité
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
