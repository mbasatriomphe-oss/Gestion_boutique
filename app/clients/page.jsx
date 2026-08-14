"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "../context/auth-context"
import { useTheme } from "../context/theme-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Search,
  Users,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Sun,
  Moon,
  ArrowUpDown,
  Eye,
  Star,
  Calendar,
  Phone,
  Mail,
} from "lucide-react"

// Mock client data (would come from Laravel API)
const MOCK_CLIENTS = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    phone: "+1 234 567 8900",
    totalPurchases: 45,
    totalSpent: 2450.00,
    lastPurchase: "2024-01-15",
    loyaltyPoints: 245,
    status: "active",
    joinedDate: "2023-06-15",
    purchaseHistory: [
      { id: "p1", date: "2024-01-15", items: 3, total: 125.00 },
      { id: "p2", date: "2024-01-10", items: 2, total: 89.50 },
      { id: "p3", date: "2024-01-05", items: 5, total: 210.00 },
    ],
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "+1 234 567 8901",
    totalPurchases: 78,
    totalSpent: 4890.50,
    lastPurchase: "2024-01-16",
    loyaltyPoints: 489,
    status: "active",
    joinedDate: "2023-03-20",
    purchaseHistory: [
      { id: "p4", date: "2024-01-16", items: 4, total: 178.00 },
      { id: "p5", date: "2024-01-12", items: 6, total: 320.00 },
    ],
  },
  {
    id: "3",
    name: "Robert Johnson",
    email: "robert@example.com",
    phone: "+1 234 567 8902",
    totalPurchases: 120,
    totalSpent: 8920.75,
    lastPurchase: "2024-01-14",
    loyaltyPoints: 892,
    status: "vip",
    joinedDate: "2022-11-10",
    purchaseHistory: [
      { id: "p6", date: "2024-01-14", items: 8, total: 450.00 },
      { id: "p7", date: "2024-01-08", items: 3, total: 175.50 },
    ],
  },
  {
    id: "4",
    name: "Emily Brown",
    email: "emily@example.com",
    phone: "+1 234 567 8903",
    totalPurchases: 15,
    totalSpent: 650.25,
    lastPurchase: "2024-01-10",
    loyaltyPoints: 65,
    status: "active",
    joinedDate: "2023-12-01",
    purchaseHistory: [
      { id: "p8", date: "2024-01-10", items: 2, total: 85.00 },
    ],
  },
  {
    id: "5",
    name: "Michael Wilson",
    email: "michael@example.com",
    phone: "+1 234 567 8904",
    totalPurchases: 95,
    totalSpent: 6780.00,
    lastPurchase: "2024-01-17",
    loyaltyPoints: 678,
    status: "vip",
    joinedDate: "2023-01-15",
    purchaseHistory: [
      { id: "p9", date: "2024-01-17", items: 5, total: 290.00 },
      { id: "p10", date: "2024-01-13", items: 4, total: 215.00 },
    ],
  },
  {
    id: "6",
    name: "Sarah Davis",
    email: "sarah@example.com",
    phone: "+1 234 567 8905",
    totalPurchases: 8,
    totalSpent: 320.00,
    lastPurchase: "2023-12-28",
    loyaltyPoints: 32,
    status: "inactive",
    joinedDate: "2023-10-20",
    purchaseHistory: [
      { id: "p11", date: "2023-12-28", items: 1, total: 45.00 },
    ],
  },
  {
    id: "7",
    name: "David Martinez",
    email: "david@example.com",
    phone: "+1 234 567 8906",
    totalPurchases: 156,
    totalSpent: 12450.80,
    lastPurchase: "2024-01-17",
    loyaltyPoints: 1245,
    status: "vip",
    joinedDate: "2022-05-08",
    purchaseHistory: [
      { id: "p12", date: "2024-01-17", items: 10, total: 580.00 },
      { id: "p13", date: "2024-01-15", items: 7, total: 420.00 },
      { id: "p14", date: "2024-01-11", items: 4, total: 195.50 },
    ],
  },
  {
    id: "8",
    name: "Lisa Anderson",
    email: "lisa@example.com",
    phone: "+1 234 567 8907",
    totalPurchases: 62,
    totalSpent: 3890.25,
    lastPurchase: "2024-01-16",
    loyaltyPoints: 389,
    status: "active",
    joinedDate: "2023-04-12",
    purchaseHistory: [
      { id: "p15", date: "2024-01-16", items: 3, total: 145.00 },
    ],
  },
]

export default function ClientsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("totalSpent")
  const [sortOrder, setSortOrder] = useState("desc")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedClient, setSelectedClient] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let result = [...MOCK_CLIENTS]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (client) =>
          client.name.toLowerCase().includes(query) ||
          client.email.toLowerCase().includes(query) ||
          client.phone.includes(query)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((client) => client.status === statusFilter)
    }

    // Sort
    result.sort((a, b) => {
      const aValue = a[sortBy]
      const bValue = b[sortBy]
      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1
      }
      return aValue < bValue ? 1 : -1
    })

    return result
  }, [searchQuery, sortBy, sortOrder, statusFilter])

  // Stats calculations
  const stats = useMemo(() => {
    const totalClients = MOCK_CLIENTS.length
    const totalRevenue = MOCK_CLIENTS.reduce((sum, c) => sum + c.totalSpent, 0)
    const avgSpent = totalRevenue / totalClients
    const vipClients = MOCK_CLIENTS.filter((c) => c.status === "vip").length
    return { totalClients, totalRevenue, avgSpent, vipClients }
  }, [])

  const getStatusBadge = (status) => {
    switch (status) {
      case "vip":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">VIP</Badge>
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Active</Badge>
      case "inactive":
        return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">Inactive</Badge>
      default:
        return null
    }
  }

  const handleViewDetails = (client) => {
    setSelectedClient(client)
    setShowDetails(true)
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Clients</h1>
              <p className="text-sm text-muted-foreground">
                Gérez votre base de clients
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clients totaux</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalClients}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chiffre d'affaires total</p>
                  <p className="text-2xl font-bold text-foreground">${stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dépense moyenne</p>
                  <p className="text-2xl font-bold text-foreground">${stats.avgSpent.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clients VIP</p>
                  <p className="text-2xl font-bold text-foreground">{stats.vipClients}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher des clients..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Trier par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totalSpent">Dépense totale</SelectItem>
                  <SelectItem value="totalPurchases">Achats totaux</SelectItem>
                  <SelectItem value="loyaltyPoints">Points de fidélité</SelectItem>
                  <SelectItem value="name">Nom</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                <ArrowUpDown className={`h-4 w-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Client List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead>Last Purchase</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{client.name}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(client.status)}</TableCell>
                      <TableCell className="text-right">{client.totalPurchases}</TableCell>
                      <TableCell className="text-right font-medium">${client.totalSpent.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{client.loyaltyPoints}</TableCell>
                      <TableCell>{client.lastPurchase}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(client)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Top Buyers Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Top Buyers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MOCK_CLIENTS
                .sort((a, b) => b.totalSpent - a.totalSpent)
                .slice(0, 3)
                .map((client, index) => (
                  <div
                    key={client.id}
                    className={`p-4 rounded-lg border-2 ${
                      index === 0
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                        : index === 1
                        ? "border-slate-400 bg-slate-50 dark:bg-slate-800/50"
                        : "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                        index === 0 ? "bg-amber-500" : index === 1 ? "bg-slate-500" : "bg-orange-500"
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Spent</p>
                        <p className="font-bold text-foreground">${client.totalSpent.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Purchases</p>
                        <p className="font-bold text-foreground">{client.totalPurchases}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Client Details</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold">{selectedClient.name}</h3>
                    {getStatusBadge(selectedClient.status)}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {selectedClient.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {selectedClient.phone}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Customer since {selectedClient.joinedDate}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{selectedClient.totalPurchases}</p>
                  <p className="text-xs text-muted-foreground">Purchases</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">${selectedClient.totalSpent.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{selectedClient.loyaltyPoints}</p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">
                    ${(selectedClient.totalSpent / selectedClient.totalPurchases).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg. Order</p>
                </div>
              </div>

              {/* Purchase History */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Recent Purchases
                </h4>
                <div className="space-y-2">
                  {selectedClient.purchaseHistory.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{purchase.items} items</p>
                        <p className="text-sm text-muted-foreground">{purchase.date}</p>
                      </div>
                      <p className="font-semibold">${purchase.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
