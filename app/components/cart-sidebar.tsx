"use client"

import { useRouter } from "next/navigation"
import { Minus, Plus, ShoppingCart, Trash2, User, Tag } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import formatMoney from "@/lib/formatMoney"
import { useCart } from "../context/cart-context"
import CustomerModal from "./customer-modal"
import DiscountModal from "./discount-modal"

export default function CartSidebar() {
  const router = useRouter()
  const { cart, removeFromCart, updateQuantity, cartTotal, itemCount, customer, appliedDiscount, discountAmount } =
    useCart()
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)

  const handleCheckout = () => {
    router.push("/checkout")
  }

  const currencySymbol = cart[0]?.currencySymbol ?? "$"

  return (
    <div className="flex w-full flex-col border-t bg-background md:w-80 md:border-l md:border-t-0">
      <div className="flex items-center justify-between border-b p-3 sm:p-4">
        <h2 className="flex items-center text-base font-semibold sm:text-lg">
          <ShoppingCart className="mr-2 h-5 w-5" />
          Panier
        </h2>
        <span className="rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
          {itemCount} article(s)
        </span>
      </div>

      {/* Customer Section */}
      <div className="border-b p-3 sm:p-4">
        <Button
          variant="outline"
          className="w-full justify-start bg-transparent"
          onClick={() => setShowCustomerModal(true)}
        >
          <User className="mr-2 h-4 w-4" />
          {customer ? customer.name : "Sélectionner un client"}
        </Button>
      </div>

      {/* Discount Section */}
      <div className="border-b p-3 sm:p-4">
        <Button
          variant="outline"
          className="w-full justify-start bg-transparent"
          onClick={() => setShowDiscountModal(true)}
        >
          <Tag className="mr-2 h-4 w-4" />
          {appliedDiscount ? appliedDiscount.description : "Appliquer une remise"}
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-4">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ShoppingCart className="mb-2 h-12 w-12 text-muted-foreground" />
            <h3 className="font-medium">Votre panier est vide</h3>
            <p className="text-sm text-muted-foreground">Ajoutez des articles pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-lg border p-2 sm:p-0 sm:border-0">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border sm:h-16 sm:w-16">
                  <img src={item.image || "/placeholder.svg"} alt={item.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex gap-2 justify-between">
                    <h3 className="min-w-0 flex-1 truncate font-medium">{item.name}</h3>
                    <p className="shrink-0 font-medium">{formatMoney(item.price * item.quantity, item.currencySymbol ?? currencySymbol)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground sm:text-sm">{formatMoney(item.price, item.currencySymbol ?? currencySymbol)} chacun</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-transparent"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-transparent"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-3 sm:p-4">
        <div className="mb-4 space-y-2">
            <div className="flex justify-between">
            <p>Sous-total</p>
            <p>{formatMoney(cartTotal, currencySymbol)}</p>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <p>Remise</p>
              <p>-{formatMoney(discountAmount, currencySymbol)}</p>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <p>Total</p>
            <p>{formatMoney(cartTotal - discountAmount, currencySymbol)}</p>
          </div>
        </div>
        <Button className="w-full" size="lg" disabled={cart.length === 0} onClick={handleCheckout}>
          Passer au paiement
        </Button>
      </div>
      <CustomerModal isOpen={showCustomerModal} onClose={() => setShowCustomerModal(false)} />
      <DiscountModal isOpen={showDiscountModal} onClose={() => setShowDiscountModal(false)} />
    </div>
  )
}
