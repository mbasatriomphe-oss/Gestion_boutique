"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Printer, AlertCircle, Home } from "lucide-react"

import { Button } from "@/components/ui/button"
import formatMoney from "@/lib/formatMoney"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "../context/auth-context"

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()

  const amountPaid = parseFloat(searchParams.get("amount") || "0")
  const remainingBalance = parseFloat(searchParams.get("remaining") || "0")
  const receiptNumber = searchParams.get("receipt") || Math.floor(100000 + Math.random() * 900000).toString()
  const date = new Date().toLocaleString("fr-FR")
  const hasPartialPayment = remainingBalance > 0

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  const handleBackToPOS = () => {
    router.push("/")
  }

  const handlePrint = () => {
    window.print()
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {/* Success Icon */}
          <div className="mb-6 flex items-center justify-center">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
              hasPartialPayment ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"
            }`}>
              <Check className={`h-8 w-8 ${
                hasPartialPayment ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
              }`} />
            </div>
          </div>

          <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
            {hasPartialPayment ? "Paiement partiel reçu" : "Paiement réussi"}
          </h1>
          <p className="mb-6 text-center text-muted-foreground">
            {hasPartialPayment ? "Le paiement partiel a été enregistré." : "Merci pour votre achat !"}
          </p>

          {/* Receipt Info */}
          <div className="mb-6 text-center p-4 bg-muted/50 rounded-lg">
            <p className="font-semibold text-foreground">Reçu n° {receiptNumber}</p>
            <p className="text-sm text-muted-foreground">{date}</p>
            <p className="text-xs text-muted-foreground mt-1">Traité par : {user?.name}</p>
          </div>

          <Separator className="my-4" />

          {/* Payment Details */}
          <div className="space-y-3">
            <div className="flex justify-between text-foreground">
              <p className="font-medium">Montant payé</p>
              <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{formatMoney(amountPaid)}</p>
            </div>

            {hasPartialPayment && (
              <div className="flex justify-between text-foreground">
                <p className="font-medium">Reste à payer</p>
                <p className="font-bold text-lg text-amber-600 dark:text-amber-400">{formatMoney(remainingBalance)}</p>
              </div>
            )}
          </div>

          {/* Partial Payment Warning */}
          {hasPartialPayment && (
            <>
              <Separator className="my-4" />
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  Il s'agit d'un paiement partiel. Le client doit encore <strong>{formatMoney(remainingBalance)}</strong> pour terminer cette commande.
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3 print:hidden">
            <Button onClick={handlePrint} variant="outline" className="w-full h-12">
              <Printer className="mr-2 h-4 w-4" />
              Imprimer le reçu
            </Button>
            <Button onClick={handleBackToPOS} className="w-full h-12">
              <Home className="mr-2 h-4 w-4" />
              Retour au point de vente
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
