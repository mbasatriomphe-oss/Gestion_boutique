"use client"

import { useState, useEffect } from "react"
import { Search, Plus, User, Phone, Mail, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { db, type Customer } from "../services/database"
import { useCart } from "../context/cart-context"

interface CustomerModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CustomerModal({ isOpen, onClose }: CustomerModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [formError, setFormError] = useState("")
  const [customerLoadError, setCustomerLoadError] = useState("")
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
  })
  const { customer, setCustomer } = useCart()

  useEffect(() => {
    if (isOpen) {
      loadCustomers()
    }
  }, [isOpen])

  const loadCustomers = async () => {
    setIsLoadingCustomers(true)
    setCustomerLoadError("")
    try {
      const allCustomers = await db.getCustomers()
      setCustomers(allCustomers)
    } catch (error) {
      setCustomers([])
      setCustomerLoadError(error instanceof Error ? error.message : "Impossible de charger les clients.")
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    setIsLoadingCustomers(true)
    setCustomerLoadError("")
    try {
      if (query.trim()) {
        const results = await db.searchCustomers(query)
        setCustomers(results)
      } else {
        await loadCustomers()
      }
    } catch (error) {
      setCustomers([])
      setCustomerLoadError(error instanceof Error ? error.message : "Impossible de rechercher les clients.")
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      setFormError("Le nom du client est obligatoire.")
      return
    }

    const customer: Customer = {
      id: "",
      name: newCustomer.name.trim(),
      email: newCustomer.email.trim(),
      phone: newCustomer.phone.trim(),
      address: newCustomer.address.trim(),
      city: newCustomer.city.trim(),
      country: newCustomer.country.trim(),
      loyaltyPoints: 0,
      totalSpent: 0,
      createdAt: new Date(),
      lastVisit: new Date(),
    }

    try {
      const savedCustomer = await db.saveCustomer(customer)
      setNewCustomer({ name: "", email: "", phone: "", address: "", city: "", country: "" })
      setFormError("")
      setShowAddForm(false)
      setCustomer(savedCustomer)
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Impossible d'enregistrer le client.")
    }
  }

  const handleSelectCustomer = (selectedCustomer: Customer) => {
    setCustomer(selectedCustomer)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[88vh] min-h-0 max-w-2xl flex-col overflow-hidden rounded-2xl p-0">
        <DialogHeader>
          <div className="border-b bg-muted/30 px-6 py-5">
            <DialogTitle className="text-xl">Client de la vente</DialogTitle>
            <DialogDescription className="mt-1">
              Choisissez un client existant ou créez une fiche avec son nom uniquement.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 pb-6">
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher des clients..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => { setShowAddForm(!showAddForm); setFormError("") }} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un client
            </Button>
          </div>

          {showAddForm && (
            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Nouvelle fiche client</CardTitle>
                <p className="text-sm text-muted-foreground">Seul le nom est obligatoire. Les autres informations sont facultatives.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom *</Label>
                  <Input
                    id="name"
                    autoFocus
                    required
                    aria-required="true"
                    placeholder="Nom du client"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    placeholder="Adresse du client"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Numéro de téléphone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Adresse e-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="adresse@exemple.com"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      value={newCustomer.city}
                      onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      value={newCustomer.country}
                      onChange={(e) => setNewCustomer({ ...newCustomer, country: e.target.value })}
                    />
                  </div>
                </div>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <div className="flex gap-2">
                  <Button onClick={handleAddCustomer} disabled={!newCustomer.name.trim()}>Enregistrer le client</Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {customerLoadError && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {customerLoadError}
            </p>
          )}

          {isLoadingCustomers && (
            <p className="py-4 text-center text-sm text-muted-foreground">Chargement des clients…</p>
          )}

          {customer && (
            <Card className="border-primary bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">Client actuel</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setCustomer(null)}>
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isLoadingCustomers && customers.length === 0 && !customerLoadError && (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              {searchQuery.trim() ? "Aucun client ne correspond à cette recherche." : "Aucun client enregistré pour le moment."}
            </div>
          )}

          {customers.map((cust) => (
            <Card key={cust.id} role="button" tabIndex={0} className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/50" onClick={() => handleSelectCustomer(cust)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") handleSelectCustomer(cust) }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{cust.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {cust.email && <><Mail className="h-3 w-3" />{cust.email}</>}
                        {cust.phone && (
                          <>
                            <Phone className="h-3 w-3 ml-2" />
                            {cust.phone}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="mb-1">
                      <Award className="h-3 w-3 mr-1" />
                      {cust.loyaltyPoints} pts
                    </Badge>
                    <p className="text-sm text-muted-foreground">Dépensé : ${cust.totalSpent.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {customers.length === 0 && <div className="text-center py-8 text-muted-foreground">Aucun client trouvé</div>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
