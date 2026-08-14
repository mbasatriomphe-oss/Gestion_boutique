"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Plus, Edit, Trash2, MoreHorizontal, RefreshCw, Loader2, AlertCircle, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { backendRequest } from "@/app/services/backend"

interface Devise {
  id: number
  code: string
  nom: string
  symbole: string
}

const EMPTY_FORM = { code: "", nom: "", symbole: "" }

export default function DevisesPage() {
  const [devises, setDevises] = useState<Devise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Devise | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState("")

  const fetchDevises = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await backendRequest<{ data: Devise[] }>("/devises?per_page=all")
      setDevises(res.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchDevises() }, [fetchDevises])

  const openCreate = () => {
    setEditing(null)
    setFormData(EMPTY_FORM)
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (d: Devise) => {
    setEditing(d)
    setFormData({ code: d.code, nom: d.nom, symbole: d.symbole })
    setFormError("")
    setShowDialog(true)
  }

  const closeDialog = () => { setShowDialog(false); setEditing(null); setFormError("") }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.nom.trim() || !formData.symbole.trim()) {
      setFormError("Tous les champs sont obligatoires.")
      return
    }
    setIsSaving(true)
    setFormError("")
    try {
      const body = { code: formData.code.trim().toUpperCase(), nom: formData.nom.trim(), symbole: formData.symbole.trim() }
      if (editing) {
        const res = await backendRequest<{ data: Devise }>(`/devises/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
        setDevises(prev => prev.map(d => d.id === editing.id ? res.data : d))
      } else {
        const res = await backendRequest<{ data: Devise }>("/devises", { method: "POST", body: JSON.stringify(body) })
        setDevises(prev => [...prev, res.data])
      }
      closeDialog()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (d: Devise) => {
    if (!confirm(`Supprimer la devise "${d.nom} (${d.code})" ?`)) return
    try {
      await backendRequest(`/devises/${d.id}`, { method: "DELETE" })
      setDevises(prev => prev.filter(x => x.id !== d.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Devises</h1>
          <p className="text-muted-foreground">
            {isLoading ? "Chargement…" : `${devises.length} devise${devises.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchDevises} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={showDialog} onOpenChange={open => { if (!open) closeDialog() }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle devise
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Modifier la devise" : "Nouvelle devise"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <div>
                  <Label htmlFor="code">Code *</Label>
                  <Input id="code" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Ex: USD" maxLength={4} required />
                </div>
                <div>
                  <Label htmlFor="nom">Nom *</Label>
                  <Input id="nom" value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })} placeholder="Ex: Dollar américain" required />
                </div>
                <div>
                  <Label htmlFor="symbole">Symbole *</Label>
                  <Input id="symbole" value={formData.symbole} onChange={e => setFormData({ ...formData, symbole: e.target.value })} placeholder="Ex: $" maxLength={10} required />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editing ? "Mettre à jour" : "Ajouter"}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>Annuler</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Symbole</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <TableCell key={j}><div className="h-4 rounded bg-muted animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {!isLoading && devises.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <Coins className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Aucune devise enregistrée
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && devises.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono font-semibold">{d.code}</TableCell>
                  <TableCell>{d.nom}</TableCell>
                  <TableCell className="text-lg">{d.symbole}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(d)}>
                          <Edit className="h-4 w-4 mr-2" />Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(d)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
