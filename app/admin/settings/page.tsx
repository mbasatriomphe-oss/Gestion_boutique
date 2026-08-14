"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  MoreVertical,
  Store,
  Bell,
  Shield,
  Palette,
  CreditCard,
  Save,
  RefreshCw,
  Upload,
  Search,
  Plus,
  XCircle,
  Eye,
  EyeOff,
  Key,
  LogOut,
  CheckCircle,
  Sun,
  Moon,
  DollarSign,
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Clock,
} from "lucide-react"
import { toast } from "sonner"
import { backendRequest } from "@/app/services/backend"
import formatMoney from "@/lib/formatMoney"
import { postHtmlToPdf } from "@/lib/downloadPdf"

// ==================== TYPES ====================

interface Seller {
  id: number
  nom: string
  prenom: string
  email: string
  telephone: string
  code: string
  role: "admin" | "manager" | "cashier" | "seller"
  status: "active" | "inactive"
  commission?: number
  salaire_horaire?: number
  objectif_vente?: number
  password?: string
  date_embauche: string
}

interface StoreInfo {
  id?: number
  nom: string
  logo: string
  adresse: string
  telephone: string
  email: string
  site_web: string
  numero_tva: string
  devise: string
  fuseau_horaire: string
}

interface AlertSettings {
  seuil_stock_faible: number
  seuil_stock_critique: number
  alerte_rupture: boolean
  alerte_stock_faible: boolean
  rapport_quotidien: boolean
  rapport_hebdomadaire: boolean
  destinataires_rapports: string[]
}

interface InvoiceSettings {
  en_tete_ticket: string
  pied_page_ticket: string
  prefixe_facture: string
  prochain_numero: number
  afficher_tva: boolean
  taux_tva: number
  symbole_devise: string
}

interface AppearanceSettings {
  theme: "light" | "dark" | "system"
  couleur_principale: string
  densite_tableau: "compact" | "normal" | "comfortable"
  animations: boolean
}

interface StoreHours {
  jour: string
  ouverture: string
  fermeture: string
  ferme: boolean
}

// ==================== COMPOSANT PRINCIPAL ====================

export default function AdminSettingsPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({
    nom: "",
    logo: "",
    adresse: "",
    telephone: "",
    email: "",
    site_web: "",
    numero_tva: "",
    devise: "EUR",
    fuseau_horaire: "Europe/Paris",
  })
  const [storeHours, setStoreHours] = useState<StoreHours[]>([])
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    seuil_stock_faible: 10,
    seuil_stock_critique: 5,
    alerte_rupture: true,
    alerte_stock_faible: true,
    rapport_quotidien: true,
    rapport_hebdomadaire: false,
    destinataires_rapports: [],
  })
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({
    en_tete_ticket: "Merci de votre visite !",
    pied_page_ticket: "Retour possible sous 14 jours",
    prefixe_facture: "INV",
    prochain_numero: 1001,
    afficher_tva: true,
    taux_tva: 20,
    symbole_devise: "€",
  })
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme: "system",
    couleur_principale: "#6366f1",
    densite_tableau: "normal",
    animations: true,
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null)
  const [formData, setFormData] = useState<Partial<Seller>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [devises, setDevises] = useState<{ id: number; code: string; nom: string; symbole: string }[]>([])
  const [reportStart, setReportStart] = useState("")
  const [reportEnd, setReportEnd] = useState("")
  const [reportData, setReportData] = useState<any | null>(null)
  const [isReportLoading, setIsReportLoading] = useState(false)

  // Charger les données depuis l'API
  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        fetchSellers(),
        fetchStoreInfo(),
        fetchAlertSettings(),
        fetchInvoiceSettings(),
        fetchAppearance(),
        fetchDevises(),
      ])
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error)
      toast.error("Erreur lors du chargement des données")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSellers = async () => {
    try {
      const response = await backendRequest<{ data: Seller[] }>("/vendeurs?per_page=all")
      setSellers(response.data || [])
    } catch (error) {
      console.error("Erreur chargement vendeurs:", error)
    }
  }

  const fetchStoreInfo = async () => {
    try {
      const response = await backendRequest<{ data: StoreInfo }>("/parametres/boutique")
      if (response.data) {
        setStoreInfo(response.data)
      }
      // Charger les horaires
      const hoursResponse = await backendRequest<{ data: StoreHours[] }>("/parametres/horaires")
      setStoreHours(hoursResponse.data || [])
    } catch (error) {
      console.error("Erreur chargement boutique:", error)
    }
  }

  const fetchAlertSettings = async () => {
    try {
      const response = await backendRequest<{ data: AlertSettings }>("/parametres/alertes")
      if (response.data) {
        setAlertSettings(response.data)
      }
    } catch (error) {
      console.error("Erreur chargement alertes:", error)
    }
  }

  const fetchInvoiceSettings = async () => {
    try {
      const response = await backendRequest<{ data: InvoiceSettings }>("/parametres/facturation")
      if (response.data) {
        setInvoiceSettings(response.data)
      }
    } catch (error) {
      console.error("Erreur chargement facturation:", error)
    }
  }

  const fetchAppearance = async () => {
    try {
      const response = await backendRequest<{ data: AppearanceSettings }>("/parametres/apparence")
      if (response.data) {
        setAppearance(response.data)
        // Appliquer le thème
        applyTheme(response.data.theme)
      }
    } catch (error) {
      console.error("Erreur chargement apparence:", error)
    }
  }

  const fetchDevises = async () => {
    try {
      const response = await backendRequest<{ data: any[] }>("/devises?per_page=all")
      const list = response.data || []
      setDevises(list)
      if (typeof window !== "undefined" && list.length > 0) {
        const first = list[0]
        if (first) {
          if (!localStorage.getItem("pos_currency_symbol") && (first.symbole || first.code)) {
            localStorage.setItem("pos_currency_symbol", first.symbole || first.code || "")
          }
          if (!localStorage.getItem("pos_currency_code") && first.code) {
            localStorage.setItem("pos_currency_code", first.code)
          }
        }
      }
    } catch (error) {
      console.error("Erreur chargement devises:", error)
    }
  }

  const applyTheme = (theme: string) => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else if (theme === "light") {
      document.documentElement.classList.remove("dark")
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }

  // Filtrer les vendeurs
  const filteredSellers = sellers.filter((seller) => {
    const fullName = `${seller.nom} ${seller.prenom}`.toLowerCase()
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
      seller.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === "all" || seller.role === roleFilter
    const matchesStatus = statusFilter === "all" || seller.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  // Statistiques des vendeurs
  const stats = {
    total: sellers.length,
    active: sellers.filter(s => s.status === "active").length,
    inactive: sellers.filter(s => s.status === "inactive").length,
    admin: sellers.filter(s => s.role === "admin").length,
    manager: sellers.filter(s => s.role === "manager").length,
    cashier: sellers.filter(s => s.role === "cashier").length,
    seller: sellers.filter(s => s.role === "seller").length,
  }

  // Ajouter un vendeur
  const handleAddSeller = async () => {
    try {
      const newSeller = {
        nom: formData.nom || "Nouveau",
        prenom: formData.prenom || "Vendeur",
        email: formData.email || `vendeur${Date.now()}@boutique.com`,
        telephone: formData.telephone || "",
        role: formData.role || "seller",
        password: "password123",
        commission: formData.commission || 2,
        salaire_horaire: formData.salaire_horaire || 12,
        objectif_vente: formData.objectif_vente || 5000,
      }
      await backendRequest("/vendeurs", {
        method: "POST",
        body: JSON.stringify(newSeller),
      })
      await fetchSellers()
      setIsDialogOpen(false)
      setEditingSeller(null)
      setFormData({})
      toast.success("Vendeur ajouté avec succès")
    } catch (error) {
      toast.error("Erreur lors de l'ajout")
    }
  }

  // Modifier un vendeur
  const handleEditSeller = async () => {
    if (!editingSeller) return
    try {
      await backendRequest(`/vendeurs/${editingSeller.id}`, {
        method: "PUT",
        body: JSON.stringify(formData),
      })
      await fetchSellers()
      setIsDialogOpen(false)
      setEditingSeller(null)
      setFormData({})
      toast.success("Vendeur modifié avec succès")
    } catch (error) {
      toast.error("Erreur lors de la modification")
    }
  }

  // Supprimer un vendeur
  const handleDeleteSeller = async (id: number) => {
    try {
      await backendRequest(`/vendeurs/${id}`, { method: "DELETE" })
      await fetchSellers()
      toast.success("Vendeur supprimé")
    } catch (error) {
      toast.error("Erreur lors de la suppression")
    }
  }

  // Changer le statut
  const handleToggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active"
    try {
      await backendRequest(`/vendeurs/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      })
      await fetchSellers()
      toast.success("Statut mis à jour")
    } catch (error) {
      toast.error("Erreur lors de la mise à jour")
    }
  }

  // Sauvegarder les paramètres de la boutique
  const handleSaveStoreSettings = async () => {
    try {
      await backendRequest("/parametres/boutique", {
        method: "PUT",
        body: JSON.stringify(storeInfo),
      })
      await backendRequest("/parametres/horaires", {
        method: "PUT",
        body: JSON.stringify({ horaires: storeHours }),
      })
      toast.success("Paramètres de la boutique sauvegardés")
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  // Sauvegarder les alertes
  const handleSaveAlerts = async () => {
    try {
      await backendRequest("/parametres/alertes", {
        method: "PUT",
        body: JSON.stringify(alertSettings),
      })
      toast.success("Paramètres d'alertes sauvegardés")
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  // Sauvegarder les factures
  const handleSaveInvoice = async () => {
    try {
      await backendRequest("/parametres/facturation", {
        method: "PUT",
        body: JSON.stringify(invoiceSettings),
      })
      toast.success("Paramètres de facturation sauvegardés")
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  // Sauvegarder l'apparence
  const handleSaveAppearance = async () => {
    try {
      await backendRequest("/parametres/apparence", {
        method: "PUT",
        body: JSON.stringify(appearance),
      })
      applyTheme(appearance.theme)
      // Appliquer la couleur primaire
      document.documentElement.style.setProperty("--primary", appearance.couleur_principale)
      toast.success("Apparence sauvegardée")
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde")
    }
  }

  // Récupérer le rapport de ventes pour une période
  const handleFetchReport = async () => {
    try {
      setIsReportLoading(true)
      if (reportStart && reportEnd) {
        const res: any = await backendRequest<any>(`/rapports/chiffre-affaires?start=${reportStart}&end=${reportEnd}`)
        // Si le backend renvoie un tableau de lignes (v_chiffre_affaires), normaliser
        if (res && Array.isArray(res.data)) {
          const salesRaw = res.data
          const sales = salesRaw.map((r: any, idx: number) => ({
            id: r.id || idx,
            created_at: r.date_vente,
            client_name: r.client_name || '-',
            total: parseFloat(r.montant_total) || 0,
            profit: parseFloat(r.profit || 0) || 0,
            items: r.items || [],
          }))
          const total_amount = sales.reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0)
          const total_profit = sales.reduce((sum: number, s: any) => sum + (Number(s.profit) || 0), 0)
          setReportData({ total_amount, total_profit, sales })
        } else {
          // Si le backend renvoie déjà la forme attendue
          setReportData(res)
        }
      } else if (reportStart && !reportEnd) {
        const res: any = await backendRequest<any>(`/rapports/recap-journalier?date=${reportStart}`)
        setReportData(res)
      } else {
        toast.error("Sélectionnez au moins une date de début")
      }
    } catch (error) {
      console.error("Erreur chargement rapport:", error)
      toast.error("Erreur lors de la génération du rapport")
    } finally {
      setIsReportLoading(false)
    }
  }

  // Imprimer le rapport affiché
  const handlePrintReport = () => {
    if (!reportData) return
    const title = `${storeInfo.nom || 'Mukingi Accessoir'} - Rapport de ventes`
    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style>
        </head>
        <body>
          <h2>${title}</h2>
          <p>Période: ${reportStart || '-'} → ${reportEnd || reportStart || '-'}</p>
          ${(() => {
            const total = formatMoney(reportData.total_amount || 0, invoiceSettings.symbole_devise)
            const profit = formatMoney(reportData.total_profit || 0, invoiceSettings.symbole_devise)
            const rows = (reportData.sales || []).map((s: any) => `<tr><td>${s.id}</td><td>${new Date(s.created_at).toLocaleString()}</td><td>${s.client_name || (s.client && s.client.nom) || '-'}</td><td>${formatMoney(s.total || 0, invoiceSettings.symbole_devise)}</td><td>${formatMoney(s.profit || 0, invoiceSettings.symbole_devise)}</td></tr>`).join('')
            return `<p>Total ventes: ${total}</p><p>Bénéfice: ${profit}</p><table><thead><tr><th>Id</th><th>Date</th><th>Client</th><th>Total</th><th>Profit</th></tr></thead><tbody>${rows}</tbody></table>`
          })()}
        </body>
      </html>
    `
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      w.print()
    }
  }

  // Imprimer une facture pour une vente (s: vente object)
  const printInvoice = (s: any) => {
    const header = storeInfo.nom || 'Mukingi Accessoir'
    const html = `
      <html>
        <head>
          <title>Facture ${s.id}</title>
          <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style>
        </head>
        <body>
          <h2>${header}</h2>
          <p>Facture N° ${invoiceSettings.prefixe_facture}-${invoiceSettings.prochain_numero}</p>
          <p>Date: ${new Date(s.created_at).toLocaleString()}</p>
          <p>Client: ${s.client_name || (s.client && s.client.nom) || '—'}</p>
          <table>
            <thead><tr><th>Produit</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
            <tbody>
              ${s.items && s.items.map((it: any) => `<tr><td>${it.produit_nom}</td><td>${it.quantite}</td><td>${formatMoney(it.prix_unitaire, invoiceSettings.symbole_devise)}</td><td>${formatMoney(it.total, invoiceSettings.symbole_devise)}</td></tr>`).join('')}
            </tbody>
          </table>
          <h3>Total: ${formatMoney(s.total, invoiceSettings.symbole_devise)}</h3>
        </body>
      </html>
    `
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      w.print()
    }
  }

  // Créer un administrateur via route publique (utiliser avec précaution)
  const createAdmin = async () => {
    const nom = prompt('Nom (admin) :')
    if (!nom) return
    const prenom = prompt('Prénom (admin) :') || ''
    const email = prompt('Email (admin) :')
    if (!email) return
    const password = prompt('Mot de passe :')
    if (!password) return
    const secret = prompt('Clé secrète admin :')
    if (!secret) return
    try {
      await backendRequest('/register-admin', {
        method: 'POST',
        body: JSON.stringify({ nom, prenom, email, password, password_confirmation: password, secret }),
      })
      toast.success('Administrateur créé')
    } catch (error) {
      console.error(error)
      toast.error('Erreur création administrateur')
    }
  }

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      manager: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      cashier: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      seller: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    }
    const labels: Record<string, string> = {
      admin: "Admin",
      manager: "Manager",
      cashier: "Caissier",
      seller: "Vendeur",
    }
    return <Badge className={styles[role]}>{labels[role] || role}</Badge>
  }

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Actif</Badge>
    }
    return <Badge variant="outline" className="text-muted-foreground">Inactif</Badge>
  }

  const joursSemaine = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">
            Gérez votre boutique, vos vendeurs et personnalisez l'application
          </p>
        </div>
        <Button variant="outline" onClick={fetchAllData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Onglets principaux */}
      <Tabs defaultValue="sellers" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="sellers">
            <Users className="h-4 w-4 mr-2" />
            Vendeurs
          </TabsTrigger>
          <TabsTrigger value="store">
            <Store className="h-4 w-4 mr-2" />
            Boutique
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="h-4 w-4 mr-2" />
            Alertes
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <CreditCard className="h-4 w-4 mr-2" />
            Facturation
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Apparence
          </TabsTrigger>
          <TabsTrigger value="reports">
            <DollarSign className="h-4 w-4 mr-2" />
            Rapports
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        {/* ==================== ONGLET VENDEURS ==================== */}
        <TabsContent value="sellers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Gestion des Vendeurs</CardTitle>
                  <CardDescription>
                    Ajoutez, modifiez ou supprimez des vendeurs et gérez leurs permissions
                  </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingSeller(null); setFormData({}); }}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Ajouter un vendeur
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingSeller ? "Modifier le vendeur" : "Ajouter un vendeur"}</DialogTitle>
                      <DialogDescription>
                        Remplissez les informations du vendeur
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nom *</Label>
                          <Input
                            value={formData.nom || ""}
                            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                            placeholder="Dupont"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Prénom *</Label>
                          <Input
                            value={formData.prenom || ""}
                            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                            placeholder="Jean"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={formData.email || ""}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="jean@boutique.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Téléphone</Label>
                          <Input
                            value={formData.telephone || ""}
                            onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                            placeholder="+33 6 12 34 56 78"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Rôle *</Label>
                          <Select
                            value={formData.role || "seller"}
                            onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrateur</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="cashier">Caissier</SelectItem>
                              <SelectItem value="seller">Vendeur</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Date d'embauche</Label>
                          <Input
                            type="date"
                            value={formData.date_embauche || new Date().toISOString().split("T")[0]}
                            onChange={(e) => setFormData({ ...formData, date_embauche: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Commission (%)</Label>
                          <Input
                            type="number"
                            value={formData.commission || 2}
                            onChange={(e) => setFormData({ ...formData, commission: parseFloat(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Salaire horaire (€)</Label>
                          <Input
                            type="number"
                            value={formData.salaire_horaire || 12}
                            onChange={(e) => setFormData({ ...formData, salaire_horaire: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Objectif de vente (€/mois)</Label>
                        <Input
                          type="number"
                          value={formData.objectif_vente || 5000}
                          onChange={(e) => setFormData({ ...formData, objectif_vente: parseFloat(e.target.value) })}
                        />
                      </div>
                      {!editingSeller && (
                        <div className="space-y-2">
                          <Label>Mot de passe temporaire</Label>
                          <Input
                            type="password"
                            value={formData.password || ""}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Laissez vide pour un mot de passe par défaut"
                          />
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={editingSeller ? handleEditSeller : handleAddSeller}>
                        <Save className="h-4 w-4 mr-2" />
                        {editingSeller ? "Modifier" : "Ajouter"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Statistiques */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Actifs</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
                  <p className="text-xs text-muted-foreground">Inactifs</p>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{stats.admin + stats.manager}</p>
                  <p className="text-xs text-muted-foreground">Managers</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{stats.cashier}</p>
                  <p className="text-xs text-muted-foreground">Caissiers</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-emerald-600">{stats.seller}</p>
                  <p className="text-xs text-muted-foreground">Vendeurs</p>
                </div>
              </div>

              {/* Filtres */}
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un vendeur..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les rôles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="cashier">Caissier</SelectItem>
                    <SelectItem value="seller">Vendeur</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="active">Actifs</SelectItem>
                    <SelectItem value="inactive">Inactifs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tableau des vendeurs */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendeur</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Objectif</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date d'embauche</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSellers.map((seller) => (
                      <TableRow key={seller.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {seller.nom?.[0]}{seller.prenom?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{seller.nom} {seller.prenom}</p>
                              <p className="text-xs text-muted-foreground">{seller.code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{seller.email}</p>
                            <p className="text-muted-foreground">{seller.telephone}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(seller.role)}</TableCell>
                        <TableCell>{seller.commission || 0}%</TableCell>
                        <TableCell>{formatMoney(seller.objectif_vente, invoiceSettings.symbole_devise)}</TableCell>
                        <TableCell>{getStatusBadge(seller.status)}</TableCell>
                        <TableCell>{seller.date_embauche}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditingSeller(seller)
                                setFormData(seller)
                                setIsDialogOpen(true)
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(seller.id, seller.status)}>
                                {seller.status === "active" ? (
                                  <>
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    Désactiver
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Activer
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDeleteSeller(seller.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ONGLET BOUTIQUE ==================== */}
        <TabsContent value="store">
          <Card>
            <CardHeader>
              <CardTitle>Informations de la Boutique</CardTitle>
              <CardDescription>
                Modifiez les informations générales de votre boutique
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nom de la boutique *</Label>
                  <Input
                    value={storeInfo.nom}
                    onChange={(e) => setStoreInfo({ ...storeInfo, nom: e.target.value })}
                    placeholder="Ma Boutique"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={storeInfo.logo}
                      onChange={(e) => setStoreInfo({ ...storeInfo, logo: e.target.value })}
                      placeholder="https://..."
                    />
                    <Button variant="outline" size="icon">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Textarea
                    value={storeInfo.adresse}
                    onChange={(e) => setStoreInfo({ ...storeInfo, adresse: e.target.value })}
                    placeholder="Adresse complète"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input
                    value={storeInfo.telephone}
                    onChange={(e) => setStoreInfo({ ...storeInfo, telephone: e.target.value })}
                    placeholder="+33 1 23 45 67 89"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={storeInfo.email}
                    onChange={(e) => setStoreInfo({ ...storeInfo, email: e.target.value })}
                    placeholder="contact@boutique.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site web</Label>
                  <Input
                    value={storeInfo.site_web}
                    onChange={(e) => setStoreInfo({ ...storeInfo, site_web: e.target.value })}
                    placeholder="www.boutique.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Numéro de TVA</Label>
                  <Input
                    value={storeInfo.numero_tva}
                    onChange={(e) => setStoreInfo({ ...storeInfo, numero_tva: e.target.value })}
                    placeholder="FR123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select
                    value={storeInfo.devise}
                    onValueChange={(value) => setStoreInfo({ ...storeInfo, devise: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {devises.map(devise => (
                        <SelectItem key={devise.id} value={devise.code}>
                          {devise.symbole} - {devise.code} - {devise.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fuseau horaire</Label>
                  <Select
                    value={storeInfo.fuseau_horaire}
                    onValueChange={(value) => setStoreInfo({ ...storeInfo, fuseau_horaire: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="America/New_York">America/New York</SelectItem>
                      <SelectItem value="Africa/Douala">Africa/Douala</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />
              <div>
                <Label className="mb-3 block">Horaires d'ouverture</Label>
                <div className="space-y-2">
                  {joursSemaine.map((jour, index) => {
                    const hours = storeHours.find(h => h.jour === jour) || { jour, ouverture: "09:00", fermeture: "19:00", ferme: jour === "dimanche" }
                    return (
                      <div key={jour} className="flex items-center gap-4 p-2 bg-muted/20 rounded-lg">
                        <div className="w-32 font-medium capitalize">{jour}</div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`closed-${jour}`}
                            checked={hours.ferme}
                            onCheckedChange={(checked) => {
                              const newHours = [...storeHours]
                              const existing = newHours.find(h => h.jour === jour)
                              if (existing) {
                                existing.ferme = !!checked
                              } else {
                                newHours.push({ ...hours, ferme: !!checked })
                              }
                              setStoreHours(newHours)
                            }}
                          />
                          <Label htmlFor={`closed-${jour}`}>Fermé</Label>
                        </div>
                        {!hours.ferme && (
                          <>
                            <Input
                              type="time"
                              value={hours.ouverture}
                              onChange={(e) => {
                                const newHours = [...storeHours]
                                const existing = newHours.find(h => h.jour === jour)
                                if (existing) {
                                  existing.ouverture = e.target.value
                                } else {
                                  newHours.push({ ...hours, ouverture: e.target.value })
                                }
                                setStoreHours(newHours)
                              }}
                              className="w-32"
                            />
                            <span>→</span>
                            <Input
                              type="time"
                              value={hours.fermeture}
                              onChange={(e) => {
                                const newHours = [...storeHours]
                                const existing = newHours.find(h => h.jour === jour)
                                if (existing) {
                                  existing.fermeture = e.target.value
                                } else {
                                  newHours.push({ ...hours, fermeture: e.target.value })
                                }
                                setStoreHours(newHours)
                              }}
                              className="w-32"
                            />
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <Button onClick={handleSaveStoreSettings} className="w-full md:w-auto">
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder les informations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ONGLET ALERTES ==================== */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Alertes et Notifications</CardTitle>
              <CardDescription>
                Configurez les alertes de stock et les notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Seuil d'alerte stock faible</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={alertSettings.seuil_stock_faible}
                      onChange={(e) => setAlertSettings({ ...alertSettings, seuil_stock_faible: parseInt(e.target.value) })}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">unités</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Seuil critique</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={alertSettings.seuil_stock_critique}
                      onChange={(e) => setAlertSettings({ ...alertSettings, seuil_stock_critique: parseInt(e.target.value) })}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">unités</span>
                  </div>
                </div>
              </div>

              <Separator />
              <div className="space-y-3">
                <Label>Activer les alertes</Label>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">Alertes rupture de stock</p>
                    <p className="text-sm text-muted-foreground">Notification quand un produit est en rupture</p>
                  </div>
                  <Switch
                    checked={alertSettings.alerte_rupture}
                    onCheckedChange={(checked) => setAlertSettings({ ...alertSettings, alerte_rupture: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">Alertes stock faible</p>
                    <p className="text-sm text-muted-foreground">Notification quand un produit atteint le seuil faible</p>
                  </div>
                  <Switch
                    checked={alertSettings.alerte_stock_faible}
                    onCheckedChange={(checked) => setAlertSettings({ ...alertSettings, alerte_stock_faible: checked })}
                  />
                </div>
              </div>

              <Separator />
              <div className="space-y-3">
                <Label>Rapports par email</Label>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">Rapport quotidien</p>
                    <p className="text-sm text-muted-foreground">Reçu chaque matin à 8h00</p>
                  </div>
                  <Switch
                    checked={alertSettings.rapport_quotidien}
                    onCheckedChange={(checked) => setAlertSettings({ ...alertSettings, rapport_quotidien: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">Rapport hebdomadaire</p>
                    <p className="text-sm text-muted-foreground">Reçu chaque lundi</p>
                  </div>
                  <Switch
                    checked={alertSettings.rapport_hebdomadaire}
                    onCheckedChange={(checked) => setAlertSettings({ ...alertSettings, rapport_hebdomadaire: checked })}
                  />
                </div>
                <div className="space-y-2 mt-3">
                  <Label>Destinataires des rapports</Label>
                  <div className="flex flex-wrap gap-2">
                    {alertSettings.destinataires_rapports.map((email, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        {email}
                        <button
                          onClick={() => {
                            setAlertSettings({
                              ...alertSettings,
                              destinataires_rapports: alertSettings.destinataires_rapports.filter((_, i) => i !== idx)
                            })
                          }}
                          className="ml-1 hover:text-red-500"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const email = prompt("Entrez l'adresse email :")
                        if (email) {
                          setAlertSettings({
                            ...alertSettings,
                            destinataires_rapports: [...alertSettings.destinataires_rapports, email]
                          })
                        }
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveAlerts}>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder les alertes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ONGLET FACTURATION ==================== */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres de Facturation</CardTitle>
              <CardDescription>
                Personnalisez vos factures et tickets de caisse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>En-tête du ticket</Label>
                  <Input
                    value={invoiceSettings.en_tete_ticket}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, en_tete_ticket: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pied de page du ticket</Label>
                  <Input
                    value={invoiceSettings.pied_page_ticket}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, pied_page_ticket: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Préfixe des factures</Label>
                  <Input
                    value={invoiceSettings.prefixe_facture}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prefixe_facture: e.target.value })}
                    placeholder="INV"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prochain numéro de facture</Label>
                  <Input
                    type="number"
                    value={invoiceSettings.prochain_numero}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, prochain_numero: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taux de TVA (%)</Label>
                  <Input
                    type="number"
                    value={invoiceSettings.taux_tva}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, taux_tva: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Symbole de la devise</Label>
                  <Input
                    value={invoiceSettings.symbole_devise}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, symbole_devise: e.target.value })}
                    placeholder="€"
                    className="w-20"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showTaxDetails"
                  checked={invoiceSettings.afficher_tva}
                  onCheckedChange={(checked) => setInvoiceSettings({ ...invoiceSettings, afficher_tva: !!checked })}
                />
                <Label htmlFor="showTaxDetails">Afficher les détails de la TVA sur les tickets</Label>
              </div>

              {/* Aperçu du ticket */}
              <Separator />
              <div>
                <Label className="mb-2 block">Aperçu du ticket</Label>
                <div className="border rounded-lg p-4 bg-muted/20 font-mono text-sm">
                  <div className="text-center border-b pb-2 mb-2">
                    <p className="font-bold">{storeInfo.nom || "Ma Boutique"}</p>
                    <p className="text-xs">{storeInfo.adresse}</p>
                    <p className="text-xs">Tel: {storeInfo.telephone}</p>
                  </div>
                  <p className="text-center text-xs text-muted-foreground mb-2">{invoiceSettings.en_tete_ticket}</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Produit 1</span>
                      <span>10.00{invoiceSettings.symbole_devise}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Produit 2</span>
                      <span>15.00{invoiceSettings.symbole_devise}</span>
                    </div>
                    <div className="border-t my-2"></div>
                    <div className="flex justify-between font-bold">
                      <span>TOTAL</span>
                      <span>25.00{invoiceSettings.symbole_devise}</span>
                    </div>
                    {invoiceSettings.afficher_tva && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Dont TVA ({invoiceSettings.taux_tva}%)</span>
                        <span>4.17{invoiceSettings.symbole_devise}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-2">{invoiceSettings.pied_page_ticket}</p>
                  <div className="text-center border-t pt-2 mt-2 text-xs">
                    <p>N° {invoiceSettings.prefixe_facture}-{invoiceSettings.prochain_numero}</p>
                    <p>{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveInvoice}>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder les paramètres de facturation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ONGLET APPARENCE ==================== */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Personnalisation</CardTitle>
              <CardDescription>
                Personnalisez l'apparence de l'application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Thème</Label>
                <RadioGroup
                  value={appearance.theme}
                  onValueChange={(value: any) => setAppearance({ ...appearance, theme: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Clair
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark" className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Sombre
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system">Système</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Couleur principale</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={appearance.couleur_principale}
                    onChange={(e) => setAppearance({ ...appearance, couleur_principale: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={appearance.couleur_principale}
                    onChange={(e) => setAppearance({ ...appearance, couleur_principale: e.target.value })}
                    className="w-32"
                  />
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: appearance.couleur_principale }} />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Densité des tableaux</Label>
                <RadioGroup
                  value={appearance.densite_tableau}
                  onValueChange={(value: any) => setAppearance({ ...appearance, densite_tableau: value })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="compact" id="compact" />
                    <Label htmlFor="compact">Compact</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="normal" id="normal" />
                    <Label htmlFor="normal">Normal</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="comfortable" id="comfortable" />
                    <Label htmlFor="comfortable">Confortable</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Animations</p>
                  <p className="text-sm text-muted-foreground">Activer les animations et transitions</p>
                </div>
                <Switch
                  checked={appearance.animations}
                  onCheckedChange={(checked) => setAppearance({ ...appearance, animations: checked })}
                />
              </div>

              <Button onClick={handleSaveAppearance}>
                <Save className="h-4 w-4 mr-2" />
                Appliquer l'apparence
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ONGLET SÉCURITÉ ==================== */}
        {/* ==================== ONGLET RAPPORTS ==================== */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Rapports de Ventes</CardTitle>
              <CardDescription>
                Consultez les ventes et le bénéfice sur une période ou par jour
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleFetchReport} className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Générer
                  </Button>
                  <Button variant="outline" onClick={() => { setReportStart(""); setReportEnd(""); setReportData(null) }}>
                    Réinitialiser
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Ventes:</p>
                  <p className="text-2xl font-bold">{reportData && typeof reportData.total_amount !== 'undefined' ? formatMoney(reportData.total_amount, invoiceSettings.symbole_devise) : '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bénéfice:</p>
                  <p className="text-2xl font-bold">{reportData && typeof reportData.total_profit !== 'undefined' ? formatMoney(reportData.total_profit, invoiceSettings.symbole_devise) : '—'}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handlePrintReport} disabled={!reportData}>
                    Imprimer
                  </Button>
                  <Button onClick={async () => {
                    if (!reportData) return
                    const title = `${storeInfo.nom || 'Mukingi Accessoir'} - Rapport de ventes`
                    const html = `
                      <html>
                        <head>
                          <title>${title}</title>
                          <style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style>
                        </head>
                        <body>
                          <h2>${title}</h2>
                          <p>Période: ${reportStart || '-'} → ${reportEnd || reportStart || '-'}</p>
                          ${(() => {
                            const total = formatMoney(reportData.total_amount || 0, invoiceSettings.symbole_devise)
                            const profit = formatMoney(reportData.total_profit || 0, invoiceSettings.symbole_devise)
                            const rows = (reportData.sales || []).map((s: any) => `<tr><td>${s.id}</td><td>${new Date(s.created_at).toLocaleString()}</td><td>${s.client_name || (s.client && s.client.nom) || '-'}</td><td>${formatMoney(s.total || 0, invoiceSettings.symbole_devise)}</td><td>${formatMoney(s.profit || 0, invoiceSettings.symbole_devise)}</td></tr>`).join('')
                            return `<p>Total ventes: ${total}</p><p>Bénéfice: ${profit}</p><table><thead><tr><th>Id</th><th>Date</th><th>Client</th><th>Total</th><th>Profit</th></tr></thead><tbody>${rows}</tbody></table>`
                          })()}
                        </body>
                      </html>
                    `
                    try {
                      await postHtmlToPdf(html, `rapport_ventes_${reportStart || 'single'}.pdf`)
                    } catch (e: any) {
                      toast.error('Erreur génération PDF: ' + (e?.message || String(e)))
                    }
                  }} disabled={!reportData}>
                    Télécharger PDF
                  </Button>
                </div>
              </div>

              <Separator />
              {reportData && (!reportData.sales || reportData.sales.length === 0) && (
                <div className="p-4 text-center text-sm text-muted-foreground">Aucune vente pour la période sélectionnée.</div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Id</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Bénéfice</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData && reportData.sales && reportData.sales.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.id}</TableCell>
                        <TableCell>{new Date(s.created_at).toLocaleString()}</TableCell>
                        <TableCell>{s.client_name || s.client?.nom || '—'}</TableCell>
                        <TableCell>{formatMoney(s.total || 0, invoiceSettings.symbole_devise)}</TableCell>
                        <TableCell>{formatMoney(s.profit || 0, invoiceSettings.symbole_devise)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => printInvoice(s)}>
                            Imprimer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Sécurité et Accès</CardTitle>
              <CardDescription>
                Gérez la sécurité de votre compte et les accès
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  Pour des raisons de sécurité, certaines actions nécessitent une vérification supplémentaire.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Changer le mot de passe</p>
                    <p className="text-sm text-muted-foreground">Modifiez votre mot de passe actuel</p>
                  </div>
                  <Button variant="outline" onClick={() => toast.info("Fonctionnalité à venir")}>
                    <Key className="h-4 w-4 mr-2" />
                    Modifier
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Authentification à deux facteurs</p>
                    <p className="text-sm text-muted-foreground">Sécurisez votre compte avec 2FA</p>
                  </div>
                  <Switch onCheckedChange={() => toast.info("Fonctionnalité à venir")} />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Créer un administrateur</p>
                    <p className="text-sm text-muted-foreground">Créer un compte admin (utiliser la clé secrète)</p>
                  </div>
                  <Button variant="outline" onClick={createAdmin}>Créer</Button>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Sessions actives</p>
                    <p className="text-sm text-muted-foreground">Gérez vos sessions ouvertes</p>
                  </div>
                  <Button variant="outline" onClick={() => toast.info("Fonctionnalité à venir")}>Voir les sessions</Button>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg border-red-200 bg-red-50 dark:bg-red-900/20">
                  <div>
                    <p className="font-medium text-red-600">Déconnexion de tous les appareils</p>
                    <p className="text-sm text-muted-foreground">Déconnectez-vous de tous les appareils</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => toast.info("Fonctionnalité à venir")}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Tout déconnecter
                  </Button>
                </div>
              </div>

              <Separator />
              <div>
                <Label className="mb-2 block">Journal d'activité</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  <div className="flex justify-between items-center p-2 text-sm border-b">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span>Connexion réussie</span>
                    </div>
                    <span className="text-muted-foreground">{new Date().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 text-sm border-b">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-blue-500" />
                      <span>Ajout d'un nouveau vendeur</span>
                    </div>
                    <span className="text-muted-foreground">{new Date(Date.now() - 86400000).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 text-sm border-b">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4 text-amber-500" />
                      <span>Modification des paramètres</span>
                    </div>
                    <span className="text-muted-foreground">{new Date(Date.now() - 172800000).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}