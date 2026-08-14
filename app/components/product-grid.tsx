"use client"

import { PlusCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useCart } from "../context/cart-context"
import type { Product } from "../context/cart-context"

interface ProductGridProps {
  category: string
  searchQuery: string
  products: Product[]
}

export default function ProductGrid({ category, searchQuery, products }: ProductGridProps) {
  const { addToCart, cart } = useCart()
  const { toast } = useToast()

  const filteredProducts = products.filter((product) => {
    const matchesCategory = category === "all" || product.category === category
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleAddToCart = (product: Product) => {
    const stock = Number(product.stock ?? Number.POSITIVE_INFINITY)
    const currentQuantity = cart.find((item) => item.id === product.id)?.quantity ?? 0

    if (Number.isFinite(stock) && stock <= 0) {
      toast({
        variant: "destructive",
        title: "Produit en rupture de stock",
        description: `${product.name} ne peut pas être ajouté au panier.`,
      })
      return
    }

    if (Number.isFinite(stock) && currentQuantity >= stock) {
      toast({
        variant: "destructive",
        title: "Stock insuffisant",
        description: `Il n'y a plus assez de stock pour ${product.name}.`,
      })
      return
    }

    addToCart(product)
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {filteredProducts.map((product) => (
        <Card
          key={product.id}
          className={`group w-full overflow-hidden transition-all duration-200 ${
            (product.stock ?? 0) <= 0
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:scale-105 hover:shadow-md"
          }`}
          onClick={() => handleAddToCart(product)}
        >
          <div className="relative aspect-square">
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 z-10">
              <PlusCircle className="h-10 w-10 text-white" />
            </div>
            <img
              src={product.image || "/placeholder.svg"}
              alt={product.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {(product.stock ?? 0) <= 0 && (
              <div className="absolute left-2 top-2 z-10">
                <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                  Rupture
                </Badge>
              </div>
            )}
            {(product.stock ?? 0) > 0 && (
              <div className="absolute left-2 top-2 z-10">
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  Stock {product.stock}
                </Badge>
              </div>
            )}
          </div>
          <CardContent className="p-2">
            <div className="space-y-0.5 sm:space-y-1">
              {product.categoryLabel && (
                <Badge variant="secondary" className="hidden text-[10px] uppercase tracking-wide sm:inline-flex">
                  {product.categoryLabel}
                </Badge>
              )}
              <h3 className="line-clamp-2 text-[11px] font-medium leading-tight sm:line-clamp-1 sm:text-sm">
                {product.name}
              </h3>
              <p className="text-[11px] font-semibold text-emerald-600 sm:text-sm">
                {(product.currencySymbol ?? "$")}{product.price.toFixed(2)}
              </p>
              {(product.stock ?? 0) > 0 && <p className="hidden text-[11px] text-muted-foreground sm:block">Disponible immédiatement</p>}
            </div>
          </CardContent>
        </Card>
      ))}

      {filteredProducts.length === 0 && (
        <div className="col-span-full py-12 text-center">
          <p className="text-muted-foreground">Aucun produit trouvé</p>
        </div>
      )}
    </div>
  )
}
