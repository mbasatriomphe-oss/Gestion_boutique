"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  PackagePlus,
  Package,
  AlertTriangle,
  CheckCircle2,
  History,
  ArrowUpDown,
  Plus,
  Minus,
  Truck,
} from "lucide-react"
import { products } from "../../data/products"

// Simulated stock data with inventory info
const generateStockData = () => {
  return products.map((product) => ({
    ...product,
    currentStock: Math.floor(Math.random() * 100) + 5,
    minStock: 10,
    maxStock: 150,
    supplier: ["Supplier A", "Supplier B", "Supplier C"][Math.floor(Math.random() * 3)],
    lastRestock: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    costPrice: product.price * 0.6,
  }))
}

// Simulated restock history
const INITIAL_RESTOCK_HISTORY = [
  {
    id: "rh1",
    date: "2024-01-15",
    products: [{ id: 1, name: "Cheeseburger", quantity: 50 }],
    totalItems: 50,
    supplier: "Supplier A",
    processedBy: "Admin",
    status: "completed",
  },
  {
    id: "rh2",
    date: "2024-01-14",
    products: [
      { id: 6, name: "Coca Cola", quantity: 100 },
      { id: 7, name: "Iced Tea", quantity: 80 },
    ],
    totalItems: 180,
    supplier: "Supplier B",
    processedBy: "Admin",
    status: "completed",
  },
  {
    id: "rh3",
    date: "2024-01-12",
    products: [
      { id: 11, name: "Chocolate Cake", quantity: 30 },
      { id: 12, name: "Cheesecake", quantity: 25 },
      { id: 13, name: "Ice Cream", quantity: 40 },
    ],
    totalItems: 95,
    supplier: "Supplier C",
    processedBy: "Admin",
    status: "completed",
  },
]

export default function RestockingPage() {
  const [stockData, setStockData] = useState(() => generateStockData())
  const [restockHistory, setRestockHistory] = useState(INITIAL_RESTOCK_HISTORY)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [sortOrder, setSortOrder] = useState("asc")
  
  // Single product restock
  const [singleRestockModal, setSingleRestockModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [restockQuantity, setRestockQuantity] = useState("")
  
  // Reapprovisionnement multiple
  const [bulkRestockModal, setBulkRestockModal] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState([])
  const [bulkQuantities, setBulkQuantities] = useState({})
  
  // Success message
  const [successMessage, setSuccessMessage] = useState("")

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...stockData]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(query))
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category === categoryFilter)
    }

    // Stock filter
    if (stockFilter === "low") {
      result = result.filter((p) => p.currentStock <= p.minStock)
    } else if (stockFilter === "out") {
      result = result.filter((p) => p.currentStock === 0)
    } else if (stockFilter === "ok") {
      result = result.filter((p) => p.currentStock > p.minStock)
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1
      }
      return aVal < bVal ? 1 : -1
    })

    return result
  }, [stockData, searchQuery, categoryFilter, stockFilter, sortBy, sortOrder])

  // Low stock count
  const lowStockCount = stockData.filter((p) => p.currentStock <= p.minStock).length

  // Handle single product restock
  const handleSingleRestock = (product) => {
    setSelectedProduct(product)
    setRestockQuantity("")
    setSingleRestockModal(true)
  }

  const confirmSingleRestock = () => {
    const qty = parseInt(restockQuantity, 10)
    if (!qty || qty <= 0) return

    // Update stock
    setStockData((prev) =>
      prev.map((p) =>
        p.id === selectedProduct.id
          ? { ...p, currentStock: p.currentStock + qty, lastRestock: new Date().toISOString().split("T")[0] }
          : p
      )
    )

    // Add to history
    const newEntry = {
      id: `rh${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      products: [{ id: selectedProduct.id, name: selectedProduct.name, quantity: qty }],
      totalItems: qty,
      supplier: selectedProduct.supplier,
      processedBy: "Admin",
      status: "completed",
    }
    setRestockHistory((prev) => [newEntry, ...prev])

    setSingleRestockModal(false)
    setSuccessMessage(`Successfully restocked ${qty} units of ${selectedProduct.name}`)
    setTimeout(() => setSuccessMessage(""), 3000)
  }

  // Handle Reapprovisionnement multiple
  const toggleProductSelection = (productId) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  const selectAllLowStock = () => {
    const lowStockIds = stockData
      .filter((p) => p.currentStock <= p.minStock)
      .map((p) => p.id)
    setSelectedProducts(lowStockIds)
    
    // Set default quantities to bring to max stock
    const quantities = {}
    lowStockIds.forEach((id) => {
      const product = stockData.find((p) => p.id === id)
      quantities[id] = product.maxStock - product.currentStock
    })
    setBulkQuantities(quantities)
  }

  const openBulkRestock = () => {
    if (selectedProducts.length === 0) return
    setBulkRestockModal(true)
  }

  const confirmBulkRestock = () => {
    const restockedProducts = []
    let totalItems = 0

    // Update stock for all selected products
    setStockData((prev) =>
      prev.map((p) => {
        if (selectedProducts.includes(p.id)) {
          const qty = parseInt(bulkQuantities[p.id], 10) || 0
          if (qty > 0) {
            restockedProducts.push({ id: p.id, name: p.name, quantity: qty })
            totalItems += qty
            return {
              ...p,
              currentStock: p.currentStock + qty,
              lastRestock: new Date().toISOString().split("T")[0],
            }
          }
        }
        return p
      })
    )

    // Add to history
    if (restockedProducts.length > 0) {
      const newEntry = {
        id: `rh${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        products: restockedProducts,
        totalItems,
        supplier: "Multiple",
        processedBy: "Admin",
        status: "completed",
      }
      setRestockHistory((prev) => [newEntry, ...prev])
    }

    setBulkRestockModal(false)
    setSelectedProducts([])
    setBulkQuantities({})
    setSuccessMessage(`Successfully restocked ${restockedProducts.length} products with ${totalItems} total items`)
    setTimeout(() => setSuccessMessage(""), 3000)
  }

  const getStockBadge = (product) => {
    if (product.currentStock === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    }
    if (product.currentStock <= product.minStock) {
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Low Stock</Badge>
    }
    return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">In Stock</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reapprovisionnement</h1>
          <p className="text-muted-foreground">Manage your inventory and restock products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={selectAllLowStock}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Select Low Stock ({lowStockCount})
          </Button>
          <Button
            onClick={openBulkRestock}
            disabled={selectedProducts.length === 0}
          >
            <PackagePlus className="h-4 w-4 mr-2" />
            Reapprovisionnement multiple ({selectedProducts.length})
          </Button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-200">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold text-foreground">{stockData.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-foreground">{lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Package className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-foreground">
                  {stockData.filter((p) => p.currentStock === 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Réapprovisionnements récents</p>
                <p className="text-2xl font-bold text-foreground">{restockHistory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">
            <Package className="h-4 w-4 mr-2" />
            Stock
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Historique des réapprovisionnements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher des produits..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    <SelectItem value="food">Aliments</SelectItem>
                    <SelectItem value="drinks">Boissons</SelectItem>
                    <SelectItem value="desserts">Desserts</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="Niveau de stock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tout le stock</SelectItem>
                    <SelectItem value="low">Stock faible</SelectItem>
                    <SelectItem value="out">Rupture de stock</SelectItem>
                    <SelectItem value="ok">En stock</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts(filteredProducts.map((p) => p.id))
                            } else {
                              setSelectedProducts([])
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-center">Stock actuel</TableHead>
                      <TableHead className="text-center">Stock min.</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Dernier réapprovisionnement</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow
                        key={product.id}
                        className={selectedProducts.includes(product.id) ? "bg-primary/5" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={() => toggleProductSelection(product.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                            <div>
                              <p className="font-medium text-foreground">{product.name}</p>
                              <p className="text-sm text-muted-foreground">${product.price.toFixed(2)}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{product.category}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-semibold ${
                            product.currentStock <= product.minStock
                              ? "text-amber-600"
                              : "text-foreground"
                          }`}>
                            {product.currentStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{product.minStock}</TableCell>
                        <TableCell>{getStockBadge(product)}</TableCell>
                        <TableCell>{product.supplier}</TableCell>
                        <TableCell>{product.lastRestock}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSingleRestock(product)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Réapprovisionner
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

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Restock History</CardTitle>
              <CardDescription>View all past restocking activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {restockHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">
                            Restock #{entry.id.slice(-6)}
                          </p>
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {entry.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.date} | {entry.supplier} | By: {entry.processedBy}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-foreground">
                        {entry.totalItems} items
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.products.map((p) => (
                        <Badge key={p.id} variant="outline">
                          {p.name}: +{p.quantity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Single Restock Modal */}
      <Dialog open={singleRestockModal} onOpenChange={setSingleRestockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restock Product</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <p className="font-semibold text-foreground">{selectedProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Current Stock: {selectedProduct.currentStock} units
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Min: {selectedProduct.minStock} | Max: {selectedProduct.maxStock}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Quantity to Add
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRestockQuantity((prev) => Math.max(0, (parseInt(prev, 10) || 0) - 10).toString())}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={restockQuantity}
                    onChange={(e) => setRestockQuantity(e.target.value)}
                    className="text-center"
                    placeholder="Enter quantity"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRestockQuantity((prev) => ((parseInt(prev, 10) || 0) + 10).toString())}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRestockQuantity((selectedProduct.maxStock - selectedProduct.currentStock).toString())
                  }
                >
                  Fill to Max
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRestockQuantity("50")}>
                  +50
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRestockQuantity("100")}>
                  +100
                </Button>
              </div>

              {restockQuantity && parseInt(restockQuantity, 10) > 0 && (
                <Alert>
                  <AlertDescription>
                    New stock level will be:{" "}
                    <strong>
                      {selectedProduct.currentStock + parseInt(restockQuantity, 10)} units
                    </strong>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingleRestockModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmSingleRestock}
              disabled={!restockQuantity || parseInt(restockQuantity, 10) <= 0}
            >
              Confirm Restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reapprovisionnement multiple Modal */}
      <Dialog open={bulkRestockModal} onOpenChange={setBulkRestockModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reapprovisionnement multiple</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="text-muted-foreground">
              Set quantities for each selected product:
            </p>
            {selectedProducts.map((productId) => {
              const product = stockData.find((p) => p.id === productId)
              if (!product) return null
              return (
                <div
                  key={productId}
                  className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Current: {product.currentStock} | Max: {product.maxStock}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    className="w-24 text-center"
                    value={bulkQuantities[productId] || ""}
                    onChange={(e) =>
                      setBulkQuantities((prev) => ({
                        ...prev,
                        [productId]: e.target.value,
                      }))
                    }
                    placeholder="Qty"
                  />
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRestockModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmBulkRestock}>
              Confirm Reapprovisionnement multiple
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
