"use client"

import { useEffect, useState } from "react"
import { Search, Filter, Eye, Printer, RefreshCw, Calendar, DollarSign, Package, MoreHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { backendRequest } from "@/app/services/backend"

interface BackendEnvelope<T> {
  status?: string
  data?: T
  message?: string
}

interface BackendSaleLine {
  id?: number
  id_produit?: number | string
  quantite?: number | string
  prix_vente?: number | string
  produit?: { id?: number; nom?: string | null } | null
  devise?: { id?: number; code?: string | null; nom?: string | null; symbole?: string | null } | null
}

interface BackendSalePayment {
  id?: number
  type?: string | null
  montant?: number | string | null
  reference_type?: string | null
  reference_id?: number | string | null
  caisse?: {
    id?: number
    id_devise?: number | string | null
    devise?: { id?: number; code?: string | null; nom?: string | null; symbole?: string | null } | null
  } | null
}

interface BackendSale {
  id: number
  code?: string | null
  date?: string | null
  created_at?: string | null
  id_client?: number | string | null
  client?: { id?: number; nom?: string | null; post_nom?: string | null; prenom?: string | null; contact?: string | null } | null
  id_vendeur?: number | string | null
  vendeur?: { id?: number; nom?: string | null; post_nom?: string | null; prenom?: string | null } | null
  lignes?: BackendSaleLine[] | null
  transactionsCaisses?: BackendSalePayment[] | null
}

interface Customer {
  id: number
  nom?: string | null
  post_nom?: string | null
  prenom?: string | null
  contact?: string | null
}

interface Transaction {
  id: string
  customerId?: string
  status?: string
  items: Array<{ id: number; name: string; price: number; quantity: number; total: number }>
  lineTotalsByCurrency: Array<{ label: string; amount: number }>
  paymentTotalsByCurrency: Array<{ label: string; amount: number }>
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  timestamp: Date
  receiptNumber: string
  cashierName?: string
}

interface OrderDetails extends Transaction {
  customerName?: string
  customerEmail?: string
}

const orderStatuses = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "processing", label: "Processing", color: "bg-blue-100 text-blue-800" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
  { value: "refunded", label: "Refunded", color: "bg-gray-100 text-gray-800" },
]

const toNumber = (value: number | string | null | undefined) => (typeof value === "number" ? value : Number(value ?? 0))

function formatCurrencyLabel(code?: string | null, symbol?: string | null, name?: string | null, fallback = "Devise") {
  return symbol || code || name || fallback
}

function groupAmountsByCurrency<T>(items: T[], getCurrency: (item: T) => { code?: string | null; symbol?: string | null; name?: string | null; labelFallback?: string | null }, getAmount: (item: T) => number) {
  const grouped = new Map<string, { label: string; amount: number }>()

  for (const item of items) {
    const currency = getCurrency(item)
    const label = formatCurrencyLabel(currency.code, currency.symbol, currency.name, currency.labelFallback ?? "Devise")
    const key = currency.code || currency.symbol || currency.name || currency.labelFallback || label
    const current = grouped.get(key) ?? { label, amount: 0 }
    current.label = label
    current.amount += getAmount(item)
    grouped.set(key, current)
  }

  return Array.from(grouped.values())
}

function formatCustomerName(customer?: Customer | null) {
  if (!customer) return "Guest"
  return [customer.nom, customer.post_nom, customer.prenom].filter(Boolean).join(" ").trim() || "Guest"
}

function getStatusBadge(status: string) {
  return orderStatuses.find((item) => item.value === status) || orderStatuses[2]
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderDetails[]>([])
  const [filteredOrders, setFilteredOrders] = useState<OrderDetails[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCancellingOrder, setIsCancellingOrder] = useState(false)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    let filtered = orders

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (order) =>
          order.receiptNumber.toLowerCase().includes(query) ||
          order.customerName?.toLowerCase().includes(query) ||
          order.customerEmail?.toLowerCase().includes(query),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => (order.status || "completed") === statusFilter)
    }

    setFilteredOrders(filtered)
  }, [orders, searchQuery, statusFilter])

  const mapSaleToOrder = (sale: BackendSale): Transaction => {
    const items = (sale.lignes ?? []).map((line) => {
      const quantity = toNumber(line.quantite)
      const price = toNumber(line.prix_vente)
      const productId = toNumber(line.id_produit ?? line.id)

      return {
        id: productId,
        name: line.produit?.nom?.trim() || `Produit #${productId}`,
        price,
        quantity,
        total: price * quantity,
      }
    })

    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const lineTotalsByCurrency = groupAmountsByCurrency(
      sale.lignes ?? [],
      (line) => ({
        code: line.devise?.code,
        symbol: line.devise?.symbole,
        name: line.devise?.nom,
        labelFallback: line.devise?.code || line.devise?.symbole || line.devise?.nom || "Devise",
      }),
      (line) => toNumber(line.prix_vente) * toNumber(line.quantite),
    )

    const paymentTotalsByCurrency = groupAmountsByCurrency(
      sale.transactionsCaisses ?? [],
      (payment) => ({
        code: payment.caisse?.devise?.code,
        symbol: payment.caisse?.devise?.symbole,
        name: payment.caisse?.devise?.nom,
        labelFallback: payment.caisse?.devise?.code || payment.caisse?.devise?.symbole || payment.caisse?.devise?.nom || "Devise",
      }),
      (payment) => toNumber(payment.montant),
    )

    return {
      id: String(sale.id),
      customerId: sale.id_client != null ? String(sale.id_client) : undefined,
      status: "completed",
      items,
      lineTotalsByCurrency,
      paymentTotalsByCurrency,
      subtotal,
      tax: 0,
      discount: 0,
      total: subtotal,
      paymentMethod: paymentTotalsByCurrency.length === 1 ? paymentTotalsByCurrency[0].label : paymentTotalsByCurrency.length > 1 ? "Paiement multi-devise" : "Cash",
      timestamp: new Date(sale.date ?? sale.created_at ?? Date.now()),
      receiptNumber: sale.code || `VEN-${sale.id}`,
      cashierName: [sale.vendeur?.nom, sale.vendeur?.post_nom, sale.vendeur?.prenom].filter(Boolean).join(" ").trim() || undefined,
    }
  }

  const loadOrders = async () => {
    setIsLoading(true)
    setLoadError("")

    try {
      const [salesResponse, customersResponse] = await Promise.all([
        backendRequest<BackendEnvelope<BackendSale[]>>("/ventes?per_page=all&sort_by=id&sort_direction=desc"),
        backendRequest<BackendEnvelope<Customer[]>>("/clients?per_page=all"),
      ])

      const customers = customersResponse.data ?? []
      const mappedOrders: OrderDetails[] = (salesResponse.data ?? []).map((sale) => {
        const transaction = mapSaleToOrder(sale)
        const customer = customers.find((item) => String(item.id) === transaction.customerId)

        return {
          ...transaction,
          customerName: formatCustomerName(customer),
          customerEmail: customer?.contact || "",
        }
      })

      setOrders(mappedOrders)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Erreur de chargement des commandes")
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewOrder = (order: OrderDetails) => {
    setSelectedOrder(order)
    setShowOrderDetails(true)
  }

  const handlePrintReceipt = (order: OrderDetails) => {
    console.log("Printing receipt for order:", order.receiptNumber)
  }

  const handleCancelOrder = async (order: OrderDetails) => {
    const confirmed = window.confirm(`Annuler la vente ${order.receiptNumber} ? Le stock et la caisse seront rétablis.`)

    if (!confirmed) {
      return
    }

    setIsCancellingOrder(true)
    setLoadError("")

    try {
      await backendRequest<BackendEnvelope<null>>(`/ventes/${order.id}`, { method: "DELETE" })
      setShowOrderDetails(false)
      setSelectedOrder(null)
      await loadOrders()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Impossible d'annuler la vente")
    } finally {
      setIsCancellingOrder(false)
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage and track all orders</p>
        </div>
        <Button onClick={loadOrders} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Package className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium">Total Orders</span></div><p className="text-2xl font-bold mt-1">{orders.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" /><span className="text-sm font-medium">Total Revenue</span></div><p className="text-2xl font-bold mt-1">${orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-yellow-500" /><span className="text-sm font-medium">Pending</span></div><p className="text-2xl font-bold mt-1">{orders.filter((order) => (order.status || "completed") === "pending").length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-purple-500" /><span className="text-sm font-medium">Today</span></div><p className="text-2xl font-bold mt-1">{orders.filter((order) => new Date(order.timestamp).toDateString() === new Date().toDateString()).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher des commandes..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {orderStatuses.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commandes récentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loadError && <div className="border-b bg-red-50 px-4 py-3 text-sm text-red-600">{loadError}</div>}
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 text-sm font-medium">
                <div className="col-span-2">ID commande</div>
                <div className="col-span-2">Client</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1">Articles</div>
                <div className="col-span-2">Total</div>
                <div className="col-span-2">Statut</div>
                <div className="col-span-1">Actions</div>
              </div>

              <div className="divide-y">
                {filteredOrders.map((order) => {
                  const statusConfig = getStatusBadge(order.status || "completed")

                  return (
                    <div key={order.id} className="grid grid-cols-12 gap-4 p-4 hover:bg-muted/50">
                      <div className="col-span-2"><p className="font-medium">#{order.receiptNumber}</p><p className="text-xs text-muted-foreground">{order.paymentMethod}</p></div>
                      <div className="col-span-2"><p className="font-medium">{order.customerName}</p>{order.customerEmail && <p className="text-xs text-muted-foreground">{order.customerEmail}</p>}</div>
                      <div className="col-span-2"><p className="text-sm">{formatDate(order.timestamp)}</p></div>
                      <div className="col-span-1"><p className="text-sm">{order.items.length}</p></div>
                      <div className="col-span-2 space-y-1">
                        <p className="font-medium">${order.total.toFixed(2)}</p>
                        {order.paymentTotalsByCurrency.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {order.paymentTotalsByCurrency.map((payment) => (
                              <Badge key={`${order.id}-${payment.label}-${payment.amount}`} variant="outline" className="text-[10px]">
                                {payment.label}: {payment.amount.toFixed(2)}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {order.discount > 0 && <p className="text-xs text-green-600">-${order.discount.toFixed(2)} discount</p>}
                      </div>
                      <div className="col-span-2"><Badge className={statusConfig.color}>{statusConfig.label}</Badge></div>
                      <div className="col-span-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewOrder(order)}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintReceipt(order)}><Printer className="h-4 w-4 mr-2" />Print Receipt</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCancelOrder(order)} className="text-red-600 focus:text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />Cancel Sale
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {!isLoading && filteredOrders.length === 0 && (
            <div className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">No orders found</h3>
              <p className="text-muted-foreground">{searchQuery || statusFilter !== "all" ? "Try adjusting your search or filters" : "Orders will appear here once customers start making purchases"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Order Details - #{selectedOrder?.receiptNumber}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="font-medium mb-2">Customer Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Name:</span> {selectedOrder.customerName}</p>
                    {selectedOrder.customerEmail && <p><span className="font-medium">Email:</span> {selectedOrder.customerEmail}</p>}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Order Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Order:</span> #{selectedOrder.receiptNumber}</p>
                    <p><span className="font-medium">Date:</span> {formatDate(selectedOrder.timestamp)}</p>
                    <p><span className="font-medium">Payment:</span> {selectedOrder.paymentMethod}</p>
                    {selectedOrder.cashierName && <p><span className="font-medium">Cashier:</span> {selectedOrder.cashierName}</p>}
                    <p><span className="font-medium">Status:</span> <Badge className={getStatusBadge(selectedOrder.status || "completed").color}>{getStatusBadge(selectedOrder.status || "completed").label}</Badge></p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-4">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div><p className="font-medium">{item.name}</p><p className="text-sm text-muted-foreground">${item.price.toFixed(2)} × {item.quantity}</p></div>
                      <p className="font-medium">${item.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-4">Amounts by Currency</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Sale amounts</p>
                    <div className="space-y-2">
                      {selectedOrder.lineTotalsByCurrency.length > 0 ? selectedOrder.lineTotalsByCurrency.map((entry) => (
                        <div key={`${selectedOrder.id}-line-${entry.label}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                          <span>{entry.label}</span>
                          <span className="font-medium">{entry.amount.toFixed(2)}</span>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Aucun montant trouvé.</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Payments received</p>
                    <div className="space-y-2">
                      {selectedOrder.paymentTotalsByCurrency.length > 0 ? selectedOrder.paymentTotalsByCurrency.map((entry) => (
                        <div key={`${selectedOrder.id}-payment-${entry.label}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                          <span>{entry.label}</span>
                          <span className="font-medium">{entry.amount.toFixed(2)}</span>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-4">Order Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span>Subtotal</span><span>${selectedOrder.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span>${selectedOrder.tax.toFixed(2)}</span></div>
                  {selectedOrder.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-${selectedOrder.discount.toFixed(2)}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-medium text-lg"><span>Total</span><span>${selectedOrder.total.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={() => handlePrintReceipt(selectedOrder)}><Printer className="h-4 w-4 mr-2" />Print Receipt</Button>
                <Button
                  variant="destructive"
                  onClick={() => handleCancelOrder(selectedOrder)}
                  disabled={isCancellingOrder}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isCancellingOrder ? "Canceling..." : "Cancel Sale"}
                </Button>
                <Button variant="outline" onClick={() => setShowOrderDetails(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}