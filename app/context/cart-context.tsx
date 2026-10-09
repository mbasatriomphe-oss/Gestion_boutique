"use client"

import { createContext, useContext, useState, type ReactNode, useEffect } from "react"

export interface Product {
  id: number
  name: string
  price: number
  image: string
  category: string
  categoryLabel?: string
  currencySymbol?: string
  stock?: number
  basePrice?: number
  stockUnitLabel?: string
  saleUnits?: Array<{ id: number; label: string; factor: number; price?: number; currencyId?: number; currencySymbol?: string }>
  saleUnitId?: number
  saleUnitLabel?: string
  conversionFactor?: number
  sourceCurrencyId?: number
}

interface Discount {
  id: string
  type: "percentage" | "fixed"
  value: number
  description: string
  minAmount?: number
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  loyaltyPoints: number
  totalSpent: number
  purchaseHistory?: Transaction[]
}

interface Transaction {
  id: string
  customerId?: string
  items: CartItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  timestamp: Date
  receiptNumber: string
}

interface CartItem extends Product {
  quantity: number
}

interface CartContextType {
  cart: CartItem[]
  addToCart: (product: Product) => boolean
  removeFromCart: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  updateSaleUnit: (productId: number, unitId: number) => void
  clearCart: () => void
  cartTotal: number
  itemCount: number
  appliedDiscount: Discount | null
  applyDiscount: (discount: Discount) => void
  removeDiscount: () => void
  discountAmount: number
  customer: Customer | null
  setCustomer: (customer: Customer | null) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)

  // Load cart from localStorage on initial render
  useEffect(() => {
    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (error) {
        console.error("Failed to parse cart from localStorage:", error)
      }
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart))
  }, [cart])

  const addToCart = (product: Product) => {
    let added = false

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id)
      const stockLimit = Number(product.stock)

      if (Number.isFinite(stockLimit) && stockLimit <= 0) {
        return prevCart
      }

      const factor = existingItem?.conversionFactor ?? product.conversionFactor ?? 1
      if (existingItem && Number.isFinite(stockLimit) && (existingItem.quantity + 1) * factor > stockLimit) {
        return prevCart
      }

      if (existingItem) {
        added = true
        return prevCart.map((item) => {
          if (item.id !== product.id) return item
          const saleUnitId = item.saleUnitId ?? product.saleUnitId
          const saleUnit = product.saleUnits?.find(unit => unit.id === saleUnitId)
          return {
            ...item,
            ...product,
            quantity: item.quantity + 1,
            saleUnitId,
            saleUnitLabel: item.saleUnitLabel ?? product.saleUnitLabel,
            conversionFactor: item.conversionFactor ?? product.conversionFactor,
            price: saleUnit?.price ?? (product.basePrice ?? product.price) * (item.conversionFactor ?? product.conversionFactor ?? 1),
            sourceCurrencyId: saleUnit?.currencyId ?? item.sourceCurrencyId ?? product.sourceCurrencyId,
            currencySymbol: saleUnit?.currencySymbol ?? item.currencySymbol ?? product.currencySymbol,
          }
        })
      }

      added = true
      return [...prevCart, { ...product, quantity: 1 }]
    })

    return added
  }

  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId))
  }

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart((prevCart) => prevCart.map((item) => {
      if (item.id !== productId) return item
      const factor = item.conversionFactor ?? 1
      const maximum = Number.isFinite(item.stock) ? Math.floor((item.stock ?? 0) / factor) : quantity
      return { ...item, quantity: Math.min(quantity, maximum) }
    }).filter((item) => item.quantity > 0))
  }

  const updateSaleUnit = (productId: number, unitId: number) => {
    setCart((prevCart) => prevCart.map((item) => {
      if (item.id !== productId) return item
      const unit = item.saleUnits?.find((option) => option.id === unitId)
      if (!unit) return item
      const quantity = Number.isFinite(item.stock)
        ? Math.min(item.quantity, Math.floor((item.stock ?? 0) / unit.factor))
        : item.quantity
      return {
        ...item,
        quantity,
        saleUnitId: unit.id,
        saleUnitLabel: unit.label,
        conversionFactor: unit.factor,
        price: unit.price ?? (item.basePrice ?? item.price) * unit.factor,
        sourceCurrencyId: unit.currencyId ?? item.sourceCurrencyId,
        currencySymbol: unit.currencySymbol ?? item.currencySymbol,
      }
    }).filter((item) => item.quantity > 0))
  }

  const clearCart = () => {
    setCart([])
  }

  const applyDiscount = (discount: Discount) => {
    if (discount.minAmount && cartTotal < discount.minAmount) {
      return
    }
    setAppliedDiscount(discount)
  }

  const removeDiscount = () => {
    setAppliedDiscount(null)
  }

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)

  const discountAmount = appliedDiscount
    ? appliedDiscount.type === "percentage"
      ? cartTotal * (appliedDiscount.value / 100)
      : appliedDiscount.value
    : 0

  const itemCount = cart.reduce((count, item) => count + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateSaleUnit,
        clearCart,
        cartTotal,
        itemCount,
        appliedDiscount,
        applyDiscount,
        removeDiscount,
        discountAmount,
        customer,
        setCustomer,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}
