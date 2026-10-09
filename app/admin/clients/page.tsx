"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle, Edit, Loader2, MoreHorizontal, Plus, RefreshCw,
  Search, Trash2, Users, UserPlus, X, Phone, MapPin
} from "lucide-react"
import { backendRequest } from "@/app/services/backend"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Client {
  id: number
  nom: string
  post_nom?: string | null
  prenom?: string | null
  adresse?: string | null
  ville?: string | null
  pays?: string | null
  contact?: string | null
  email?: string | null
  ventes_count: number
}

const EMPTY_FORM = {
  nom: "", adresse: "", contact: "", email: "",
  ville: "", pays: "", post_nom: "", prenom: "",
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState("")

  const fetchClients = useCallback(async (q = "") => {
    setIsLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ per_page: "0" })
      if (q.trim()) params.set("search", q.trim())
      const res = await backendRequest<{ data: Client[] }>(`/clients?${params}`)
      setClients(res.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])
  useEffect(() => {
    const t = setTimeout(() => fetchClients(search), 300)
    return () => clearTimeout(t)
  }, [search, fetchClients])

  const openCreate = () => {
    setEditing(null)
    setFormData({ ...EMPTY_FORM })
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (client: Client) => {
    setEditing(client)
    setFormData({
      nom: client.nom, post_nom: client.post_nom ?? "", prenom: client.prenom ?? "",
      adresse: client.adresse ?? "", ville: client.ville ?? "", pays: client.pays ?? "",
      contact: client.contact ?? "", email: client.email ?? "",
    })
    setFormError("")
    setShowDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nom.trim()) {
      setFormError("Le nom du client est obligatoire.")
      return
    }
    setIsSaving(true)
    setFormError("")
    try {
      if (editing) {
        const res = await backendRequest<{ data: Client }>(`/clients/${editing.id}`, { method: "PUT", body: JSON.stringify(formData) })
        setClients(prev => prev.map(c => c.id === editing.id ? { ...res.data, ventes_count: c.ventes_count } : c))
      } else {
        const res = await backendRequest<{ data: Client }>("/clients", { method: "POST", body: JSON.stringify(formData) })
        setClients(prev => [{ ...res.data, ventes_count: 0 }, ...prev])
      }
      setShowDialog(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (client: Client) => {
    if (!confirm(`Supprimer ${[client.nom, client.post_nom, client.prenom].filter(Boolean).join(" ")} ?`)) return
    try {
      await backendRequest(`/clients/${client.id}`, { method: "DELETE" })
      setClients(prev => prev.filter(c => c.id !== client.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  const stats = useMemo(() => ({
    total: clients.length,
    villes: new Set(clients.map(c => c.ville)).size,
    totalVentes: clients.reduce((s, c) => s + (c.ventes_count || 0), 0),
  }), [clients])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-r from-slate-50 via-white to-blue-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Gestion</p>
            <h1 className="text-2xl lg:text-3xl font-bold">Clients</h1>
            <p className="text-muted-foreground">Gérez vos clients et suivez leur historique d'achats.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchClients(search)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Actualiser
            </Button>
            <Button onClick={openCreate}>
              <UserPlus className="h-4 w-4 mr-2" />Nouveau client
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { icon: Users, label: "Total clients", value: stats.total, color: "bg-blue-100 text-blue-600" },
          { icon: MapPin, label: "Villes", value: stats.villes, color: "bg-emerald-100 text-emerald-600" },
          { icon: Phone, label: "Ventes effectuées", value: stats.totalVentes, color: "bg-amber-100 text-amber-600" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
                <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher un client..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : clients.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />Aucun client trouvé.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[42rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Ville / Pays</TableHead>
                    <TableHead>Ventes</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map(client => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-xs">
                              {client.prenom?.[0] ?? ""}{client.nom[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{[client.nom, client.post_nom, client.prenom].filter(Boolean).join(" ")}</p>
                            <p className="text-xs text-muted-foreground">{client.adresse || "—"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{client.contact || client.email || "—"}</TableCell>
                      <TableCell>
                        <p>{client.ville || "—"}</p>
                        <p className="text-xs text-muted-foreground">{client.pays || "—"}</p>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{client.ventes_count || 0}</Badge></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(client)}><Edit className="mr-2 h-4 w-4" />Modifier</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(client)}><Trash2 className="mr-2 h-4 w-4" />Supprimer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={open => !open && setShowDialog(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le client" : "Nouveau client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nom">Nom *</Label>
              <Input id="nom" value={formData.nom} onChange={e => setFormData(p => ({ ...p, nom: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adresse">Adresse</Label>
              <Input id="adresse" value={formData.adresse} onChange={e => setFormData(p => ({ ...p, adresse: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact">Numéro de téléphone</Label>
              <Input id="contact" value={formData.contact} onChange={e => setFormData(p => ({ ...p, contact: e.target.value }))} placeholder="+243..." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ville">Ville</Label>
                <Input id="ville" value={formData.ville} onChange={e => setFormData(p => ({ ...p, ville: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pays">Pays</Label>
                <Input id="pays" value={formData.pays} onChange={e => setFormData(p => ({ ...p, pays: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="post_nom">Post-nom</Label>
                <Input id="post_nom" value={formData.post_nom} onChange={e => setFormData(p => ({ ...p, post_nom: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prenom">Prénom</Label>
                <Input id="prenom" value={formData.prenom} onChange={e => setFormData(p => ({ ...p, prenom: e.target.value }))} />
              </div>
            </div>
            {formError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{formError}</AlertDescription></Alert>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
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
