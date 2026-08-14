"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CreditCard, Wallet, AlertCircle, CheckCircle2, Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCart } from "../context/cart-context"
import { useAuth } from "../context/auth-context"
import { backendRequest } from "../services/backend"

type BackendResponse<T> = {
  status?: string
  message?: string
  data?: T
}

type BackendDevise = {
  id: number
  code: string
  nom: string
  symbole: string
}

type BackendLot = {
  id: number
  id_produit: number
  id_devise?: number
  devise?: BackendDevise | null
  ligne_approvisionnement?: {
    prix_vente?: string | null
    prix_unitaire?: string | null
  }
}

type BackendTaux = {
  valeur: string
}

type LineOverrideState = Record<number, string>

type PricingLine = {
  id: number
  name: string
  quantity: number
  sourceCurrencyId: number | null
  sourceCurrencyCode: string
  sourceCurrencySymbol: string
  sourceUnitPrice: number
  purchaseUnitPrice: number | null
  proposedUnitPrice: number
  finalUnitPrice: number
  rate: number | null
  lineTotal: number
  needsRate: boolean
  isBelowPurchasePrice: boolean
}

type CheckoutError = {
  title: string
  description: string
}

function makeRateKey(sourceCurrencyId: number, targetCurrencyId: number) {
  return `${sourceCurrencyId}-${targetCurrencyId}`
}

function getCurrencyLabel(currency?: BackendDevise | null, fallback = "$") {
  return currency?.symbole || currency?.code || fallback
}

async function resolveRate(sourceCurrencyId: number, targetCurrencyId: number) {
  if (sourceCurrencyId === targetCurrencyId) {
    return 1
  }

  try {
    const response = await backendRequest<BackendResponse<BackendTaux>>(
      `/taux/actif?devise_source=${sourceCurrencyId}&devise_but=${targetCurrencyId}`,
    )

    const directRate = Number(response.data?.valeur)
    if (!Number.isFinite(directRate) || directRate <= 0) {
      throw new Error("Taux invalide")
    }

    return directRate
  } catch {
    const reverseResponse = await backendRequest<BackendResponse<BackendTaux>>(
      `/taux/actif?devise_source=${targetCurrencyId}&devise_but=${sourceCurrencyId}`,
    )

    const reverseRate = Number(reverseResponse.data?.valeur)
    if (!Number.isFinite(reverseRate) || reverseRate <= 0) {
      throw new Error("Taux introuvable")
    }

    return 1 / reverseRate
  }
}

export default function CheckoutPage() {
  const router = useRouter()
  const { cart, clearCart, customer, discountAmount } = useCart()
  const { user, isLoading: authLoading } = useAuth()
  const authUser = user as { id?: string | number; role?: string } | null

  const [paymentMethod, setPaymentMethod] = useState("card")
  const [isProcessing, setIsProcessing] = useState(false)
  const [francAmount, setFrancAmount] = useState("")
  const [dollarAmount, setDollarAmount] = useState("")
  const [singleAmount, setSingleAmount] = useState("")
  const [userEditedSingleAmount, setUserEditedSingleAmount] = useState(false)
  const [showPaymentInputs, setShowPaymentInputs] = useState(false)
  const [useSplitPayment, setUseSplitPayment] = useState(false)
  const [cardNumber, setCardNumber] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvv, setCardCvv] = useState("")
  const [cardName, setCardName] = useState("")
  const [cardError, setCardError] = useState("")

  useEffect(() => {
    if (!authLoading && authUser?.role === "admin") {
      router.replace("/admin")
    }
  }, [authLoading, authUser?.role, router])
  const [paymentError, setPaymentError] = useState<CheckoutError | null>(null)
  const [catalogError, setCatalogError] = useState("")
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [currencyOptions, setCurrencyOptions] = useState<BackendDevise[]>([])
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<number | null>(null)
  const [latestLotByProduct, setLatestLotByProduct] = useState<Record<number, BackendLot>>({})
  const [rateByPair, setRateByPair] = useState<Record<string, number>>({})
  const [lineOverrides, setLineOverrides] = useState<LineOverrideState>({})

  const selectedCurrency = useMemo(
    () => currencyOptions.find((currency) => currency.id === selectedCurrencyId) ?? null,
    [currencyOptions, selectedCurrencyId],
  )

  const francCurrency = useMemo(
    () =>
      currencyOptions.find(
        (currency) => /^(cdf|fc)$/i.test(currency.code) || /franc/i.test(currency.nom) || currency.symbole === "FC",
      ) ?? null,
    [currencyOptions],
  )

  const dollarCurrency = useMemo(
    () =>
      currencyOptions.find(
        (currency) => /^usd$/i.test(currency.code) || /dollar/i.test(currency.nom) || currency.symbole === "$",
      ) ?? null,
    [currencyOptions],
  )

  useEffect(() => {
    if (!user || cart.length === 0) {
      return
    }

    let cancelled = false

    const loadCatalog = async () => {
      setIsCatalogLoading(true)
      setCatalogError("")

      try {
        const [deviseResponse, lotResponse] = await Promise.all([
          backendRequest<BackendResponse<BackendDevise[]>>("/devises?per_page=all"),
          backendRequest<BackendResponse<BackendLot[]>>("/lots?per_page=all"),
        ])

        if (cancelled) {
          return
        }

        const lotMap: Record<number, BackendLot> = {}
        for (const lot of lotResponse.data ?? []) {
          if (!lotMap[lot.id_produit]) {
            lotMap[lot.id_produit] = lot
          }
        }

        setLatestLotByProduct(lotMap)
        setCurrencyOptions(deviseResponse.data ?? [])

        const firstSourceCurrencyId = cart
          .map((item) => lotMap[item.id]?.devise?.id ?? lotMap[item.id]?.id_devise ?? null)
          .find((currencyId): currencyId is number => typeof currencyId === "number")

        setSelectedCurrencyId((current) => current ?? firstSourceCurrencyId ?? deviseResponse.data?.[0]?.id ?? null)
      } catch (error) {
        if (!cancelled) {
          setCatalogError(error instanceof Error ? error.message : "Impossible de charger les devises et les lots.")
        }
      } finally {
        if (!cancelled) {
          setIsCatalogLoading(false)
        }
      }
    }

    loadCatalog()

    return () => {
      cancelled = true
    }
  }, [cart, user])

  useEffect(() => {
    if (!selectedCurrencyId || cart.length === 0) {
      setRateByPair({})
      return
    }

    let cancelled = false

    const loadRates = async () => {
      setCatalogError("")

      try {
        const sourceCurrencyIds = Array.from(
          new Set(
            cart
              .map((item) => latestLotByProduct[item.id]?.devise?.id ?? latestLotByProduct[item.id]?.id_devise ?? null)
              .filter((currencyId): currencyId is number => typeof currencyId === "number" && currencyId > 0),
          ),
        )

        if (francCurrency?.id) {
          sourceCurrencyIds.push(francCurrency.id)
        }

        if (dollarCurrency?.id) {
          sourceCurrencyIds.push(dollarCurrency.id)
        }

        const nextRates: Record<string, number> = {}
        let anyRateLoaded = false
        let loadError: string | null = null

        await Promise.all(
          sourceCurrencyIds.map(async (sourceCurrencyId) => {
            try {
              const rate = await resolveRate(sourceCurrencyId, selectedCurrencyId)
              nextRates[makeRateKey(sourceCurrencyId, selectedCurrencyId)] = rate
              anyRateLoaded = true
            } catch (error) {
              loadError = error instanceof Error ? error.message : String(error)
            }
          }),
        )

        if (!cancelled) {
          setRateByPair(nextRates)
          if (!anyRateLoaded && loadError) {
            setCatalogError(loadError)
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(error instanceof Error ? error.message : "Impossible de charger les taux actifs.")
          setRateByPair({})
        }
      }
    }

    loadRates()

    return () => {
      cancelled = true
    }
  }, [cart, latestLotByProduct, selectedCurrencyId, francCurrency?.id, dollarCurrency?.id])

  const pricingLines = useMemo<PricingLine[]>(() => {
    return cart.map((item) => {
      const lot = latestLotByProduct[item.id]
      const sourceCurrency = lot?.devise ?? null
      const sourceCurrencyId = sourceCurrency?.id ?? lot?.id_devise ?? null
      const sourceCurrencyCode = sourceCurrency?.code ?? item.currencySymbol ?? ""
      const sourceCurrencySymbol = getCurrencyLabel(sourceCurrency, item.currencySymbol ?? "$")
      const sourceUnitPrice = Number(lot?.ligne_approvisionnement?.prix_vente ?? lot?.ligne_approvisionnement?.prix_unitaire ?? item.price ?? 0)
      const purchaseSourceUnitPrice = Number(lot?.ligne_approvisionnement?.prix_unitaire ?? Number.NaN)

      let rate: number | null = 1
      const targetCurrencyId = selectedCurrencyId ?? sourceCurrencyId
      if (sourceCurrencyId && targetCurrencyId && sourceCurrencyId !== targetCurrencyId) {
        rate = rateByPair[makeRateKey(sourceCurrencyId, targetCurrencyId)] ?? null
      }

      const purchaseUnitPrice = Number.isFinite(purchaseSourceUnitPrice)
        ? rate !== null
          ? purchaseSourceUnitPrice * rate
          : null
        : null
      const proposedUnitPrice = rate ? sourceUnitPrice * rate : sourceUnitPrice
      const overrideValue = lineOverrides[item.id]
      const parsedOverride = overrideValue !== undefined && overrideValue !== "" ? Number.parseFloat(overrideValue) : Number.NaN
      const finalUnitPrice = Number.isFinite(parsedOverride) && parsedOverride >= 0 ? parsedOverride : proposedUnitPrice
      const isBelowPurchasePrice = purchaseUnitPrice !== null && finalUnitPrice < purchaseUnitPrice

      return {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        sourceCurrencyId,
        sourceCurrencyCode,
        sourceCurrencySymbol,
        sourceUnitPrice,
        purchaseUnitPrice,
        proposedUnitPrice,
        finalUnitPrice,
        rate,
        lineTotal: finalUnitPrice * item.quantity,
        needsRate: Boolean(sourceCurrencyId && targetCurrencyId && sourceCurrencyId !== targetCurrencyId),
        isBelowPurchasePrice,
      }
    })
  }, [cart, latestLotByProduct, lineOverrides, rateByPair, selectedCurrencyId])

  const convertedSubtotal = useMemo(
    () => pricingLines.reduce((sum, line) => sum + line.lineTotal, 0),
    [pricingLines],
  )

  const sourceSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discountRatio = sourceSubtotal > 0 ? discountAmount / sourceSubtotal : 0
  const convertedDiscount = convertedSubtotal * discountRatio
  const grandTotal = Math.max(convertedSubtotal - convertedDiscount, 0)
  const francAmountNum = Number.parseFloat(francAmount) || 0
  const dollarAmountNum = Number.parseFloat(dollarAmount) || 0
  const singleAmountNum = Number.parseFloat(singleAmount) || 0
  const francRateToSelected = francCurrency?.id && selectedCurrencyId
    ? francCurrency.id === selectedCurrencyId
      ? 1
      : rateByPair[makeRateKey(francCurrency.id, selectedCurrencyId)] ?? null
    : null
  const dollarRateToSelected = dollarCurrency?.id && selectedCurrencyId
    ? dollarCurrency.id === selectedCurrencyId
      ? 1
      : rateByPair[makeRateKey(dollarCurrency.id, selectedCurrencyId)] ?? null
    : null
  const francEquivalent = francAmountNum > 0 ? francAmountNum * (francRateToSelected ?? 0) : 0
  const dollarEquivalent = dollarAmountNum > 0 ? dollarAmountNum * (dollarRateToSelected ?? 0) : 0
  // Numeric helpers using a small epsilon to avoid floating point underflow
  const EPS = 1e-8
  const roundToDecimals = (v: number, decimals: number) => {
    const p = Math.pow(10, decimals)
    return Math.round((v + EPS) * p) / p
  }

  const ceilToDecimals = (v: number, decimals: number) => {
    const p = Math.pow(10, decimals)
    return Math.ceil((v + EPS) * p) / p
  }

  const floorToDecimals = (v: number, decimals: number) => {
    const p = Math.pow(10, decimals)
    return Math.floor((v + EPS) * p) / p
  }

  const mulExact = (a: number, b: number, decimals = 2) => {
    const p = Math.pow(10, decimals)
    return Math.round((a * b + EPS) * p) / p
  }

  const currencyDecimals = (currency?: BackendDevise | null) =>
    currency && (/^(cdf|fc)$/i.test(currency.code) || /franc/i.test(currency.nom) || currency.symbole === "FC")
      ? 0
      : 2

  const decimalsSelected = currencyDecimals(selectedCurrency)

  const formatAmountForDisplay = (v: number, currency?: BackendDevise | null) => {
    const s = v.toFixed(currencyDecimals(currency))
    return s.includes(".") ? s.replace(/\.?0+$/g, "") : s
  }

  const francEquivalentRounded = mulExact(francAmountNum, (francRateToSelected ?? 0), decimalsSelected)
  const dollarEquivalentRounded = mulExact(dollarAmountNum, (dollarRateToSelected ?? 0), decimalsSelected)
  const suggestedDollarFromFranc = (() => {
    if (!useSplitPayment) return null
    if (francAmountNum <= 0) return null
    if (!dollarRateToSelected) return null
    const remainingSelected = Math.max(grandTotal - francEquivalentRounded, 0)
    if (dollarRateToSelected <= 0) return null
    const targetDecimals = Math.max(0, currencyDecimals(dollarCurrency) - 1)
    return roundToDecimals(remainingSelected / dollarRateToSelected, targetDecimals)
  })()

  const suggestedFrancFromDollar = (() => {
    if (!useSplitPayment) return null
    if (dollarAmountNum <= 0) return null
    if (!francRateToSelected) return null
    const remainingSelected = Math.max(grandTotal - dollarEquivalentRounded, 0)
    if (francRateToSelected <= 0) return null
    const targetDecimals = Math.max(0, currencyDecimals(francCurrency) - 1)
    return roundToDecimals(remainingSelected / francRateToSelected, targetDecimals)
  })()
  const paymentAmountNum = useSplitPayment
    ? francEquivalentRounded + dollarEquivalentRounded
    : singleAmountNum
  const remainingBalance = Math.max(grandTotal - paymentAmountNum, 0)
  const remainingBalanceInFranc = francRateToSelected ? remainingBalance / francRateToSelected : null
  const remainingBalanceInDollar = dollarRateToSelected ? remainingBalance / dollarRateToSelected : null
  const isFullPayment = paymentAmountNum >= grandTotal && grandTotal > 0
  const hasMixedSourceCurrencies = new Set(pricingLines.map((line) => line.sourceCurrencyId).filter(Boolean)).size > 1
  const hasPendingRate = pricingLines.some((line) => line.needsRate && line.rate === null)
  const hasPendingSplitRate = useSplitPayment && ((francAmountNum > 0 && francRateToSelected === null) || (dollarAmountNum > 0 && dollarRateToSelected === null))
  const hasLossRisk = pricingLines.some((line) => line.isBelowPurchasePrice)
  const isSplitPayment = useSplitPayment && francAmountNum > 0 && dollarAmountNum > 0
  const francSymbol = francCurrency?.symbole ?? francCurrency?.code ?? "FC"
  const dollarSymbol = dollarCurrency?.symbole ?? dollarCurrency?.code ?? "$"
  const currencySymbol = getCurrencyLabel(selectedCurrency, pricingLines[0]?.sourceCurrencySymbol ?? "$")

  useEffect(() => {
    // Auto-update the single amount whenever the total or selected currency
    // changes, but only if the cashier hasn't manually edited the amount
    // and split-payment is not active.
    if (useSplitPayment) return
    if (userEditedSingleAmount) return

    setSingleAmount(grandTotal.toFixed(decimalsSelected))
  }, [grandTotal, useSplitPayment, selectedCurrencyId, userEditedSingleAmount])

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "")
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ""
    const parts = []

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }

    if (parts.length) {
      return parts.join(" ")
    }

    return value
  }

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "")
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`
    }
    return v
  }

  const validateCard = () => {
    if (paymentMethod !== "card") return true

    const cardNumClean = cardNumber.replace(/\s/g, "")
    if (cardNumClean.length < 13 || cardNumClean.length > 19) {
      setCardError("Veuillez saisir un numéro de carte valide.")
      return false
    }

    if (!cardExpiry || cardExpiry.length !== 5) {
      setCardError("Veuillez saisir une date d'expiration valide (MM/AA).")
      return false
    }

    if (!cardCvv || cardCvv.length < 3) {
      setCardError("Veuillez saisir un CVV valide.")
      return false
    }

    if (!cardName.trim()) {
      setCardError("Veuillez saisir le nom du titulaire de la carte.")
      return false
    }

    setCardError("")
    return true
  }

  const handlePayment = async () => {
    setPaymentError(null)

    if (pricingLines.length === 0 || paymentAmountNum <= 0) {
      setPaymentError({
        title: "Montant invalide",
        description: "Le montant à payer doit être supérieur à zéro.",
      })
      return
    }

    if (!customer?.id) {
      setPaymentError({
        title: "Client requis",
        description: "Sélectionne un client avant de valider la vente.",
      })
      return
    }

    if (!authUser?.id) {
      setPaymentError({
        title: "Vendeur introuvable",
        description: "Impossible de retrouver l'utilisateur connecté.",
      })
      return
    }

    if (!selectedCurrencyId) {
      setPaymentError({
        title: "Devise requise",
        description: "Choisis une devise de paiement avant de valider la vente.",
      })
      return
    }

    if (hasPendingRate || hasPendingSplitRate) {
      setPaymentError({
        title: "Taux manquant",
        description: "Au moins une conversion nécessaire n'a pas encore de taux actif vers la devise choisie.",
      })
      return
    }

    if (!validateCard()) {
      return
    }

    setIsProcessing(true)

    try {
      const response = await backendRequest<BackendResponse<{ code?: string; id?: number }>>("/ventes", {
        method: "POST",
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          id_vendeur: Number(authUser.id),
          id_client: Number(customer.id),
          devise_vente_id: selectedCurrencyId,
          paiements: (
            useSplitPayment
              ? [
                  francAmountNum > 0 && francCurrency
                    ? { devise_id: francCurrency.id, montant: Number(francAmountNum.toFixed(currencyDecimals(francCurrency))) }
                    : null,
                  dollarAmountNum > 0 && dollarCurrency
                    ? { devise_id: dollarCurrency.id, montant: Number(dollarAmountNum.toFixed(currencyDecimals(dollarCurrency))) }
                    : null,
                ].filter(Boolean)
              : [singleAmountNum > 0 && selectedCurrencyId ? { devise_id: selectedCurrencyId, montant: Number(singleAmountNum.toFixed(decimalsSelected)) } : null].filter(Boolean)
          ),
          lignes: pricingLines.map((line) => ({
            id_produit: line.id,
            quantite: line.quantity,
            prix_vente: Number(line.finalUnitPrice.toFixed(decimalsSelected)),
            id_devise: selectedCurrencyId,
          })),
        }),
      })

      clearCart()
      router.push(
        `/success?amount=${paymentAmountNum.toFixed(decimalsSelected)}&remaining=${remainingBalance.toFixed(decimalsSelected)}&receipt=${response.data?.code ?? response.data?.id ?? Date.now()}`,
      )
    } catch (error) {
      setPaymentError({
        title: "Paiement refusé",
        description: error instanceof Error ? error.message : "La vente n'a pas pu être enregistrée.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (cart.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Votre panier est vide</h1>
          <p className="mt-2 text-muted-foreground">Ajoutez des articles à votre panier avant de passer au paiement.</p>
          <Button className="mt-4" onClick={() => router.push("/")}>
            Retour au point de vente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-4 sm:py-8">
      <div className="container mx-auto max-w-6xl px-3 sm:px-4">
        <Button variant="ghost" className="mb-4 sm:mb-6" onClick={() => router.push("/")}> 
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au point de vente
        </Button>

        <h1 className="mb-4 text-2xl font-bold text-foreground sm:mb-6 sm:text-3xl">Paiement</h1>

        <div className="grid gap-6 lg:grid-cols-2 sm:gap-8">
          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Résumé de la commande</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  {pricingLines.map((line) => (
                    <div key={line.id} className="space-y-3 rounded-lg border border-border/60 p-3 sm:p-4">
                      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
                        <div>
                          <p className="font-medium text-foreground">{line.name}</p>
                            <p className="text-sm text-muted-foreground">
                            {line.quantity} x {line.sourceCurrencySymbol}{line.sourceUnitPrice.toFixed(2)} {line.sourceCurrencyCode ? `(${line.sourceCurrencyCode})` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Proposé : {currencySymbol}{line.proposedUnitPrice.toFixed(decimalsSelected)} {selectedCurrency?.code ? `(${selectedCurrency.code})` : ""}
                          </p>
                        </div>
                        <p className="font-semibold text-foreground">
                          {currencySymbol}{line.lineTotal.toFixed(decimalsSelected)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`price-${line.id}`}>Prix unitaire en {selectedCurrency?.code ?? currencySymbol}</Label>
                        <Input
                          id={`price-${line.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={lineOverrides[line.id] ?? line.finalUnitPrice.toFixed(decimalsSelected)}
                          onChange={(event) => {
                            setPaymentError(null)
                            setLineOverrides((current) => ({ ...current, [line.id]: event.target.value }))
                          }}
                        />
                        {line.needsRate && line.rate !== null && (
                          <p className="text-xs text-muted-foreground">
                            Taux appliqué : 1 {line.sourceCurrencyCode || line.sourceCurrencySymbol} = {line.rate.toFixed(6)} {selectedCurrency?.code ?? currencySymbol}
                          </p>
                        )}
                        {line.needsRate && line.rate === null && (
                          <p className="text-xs text-amber-600">Aucun taux actif trouvé pour la devise de ce produit.</p>
                        )}
                        {line.isBelowPurchasePrice && (
                          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800 dark:text-amber-200">
                              Avec ce prix ({currencySymbol}{line.finalUnitPrice.toFixed(decimalsSelected)}), vous risquez d'entrer en perte.
                              Prix d'achat estimé : {currencySymbol}{(line.purchaseUnitPrice ?? 0).toFixed(decimalsSelected)}.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div className="flex justify-between text-foreground">
                    <p>Sous-total</p>
                    <p>{currencySymbol}{convertedSubtotal.toFixed(decimalsSelected)}</p>
                  </div>
                  {convertedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <p>Remise</p>
                      <p>-{currencySymbol}{convertedDiscount.toFixed(decimalsSelected)}</p>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold text-foreground">
                    <p>Total</p>
                    <p>{currencySymbol}{grandTotal.toFixed(decimalsSelected)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Montant du paiement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Devise de paiement</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={selectedCurrencyId ?? ""}
                    onChange={(event) => {
                      const nextValue = event.target.value ? Number(event.target.value) : null
                      setSelectedCurrencyId(nextValue)
                      setPaymentError(null)
                    }}
                  >
                    {currencyOptions.map((currency) => (
                      <option key={currency.id} value={currency.id}>
                        {currency.code} - {currency.nom} ({currency.symbole})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Montant de paiement</Label>
                      <p className="text-sm text-muted-foreground">Saisis le montant à payer. Active le paiement fractionné si tu veux répartir entre francs et dollars.</p>
                    </div>
                    {!showPaymentInputs ? (
                      <Button
                        size="sm"
                        variant="outline"
                          onClick={() => {
                          setShowPaymentInputs(true)
                          if (!useSplitPayment) {
                            setSingleAmount(grandTotal.toFixed(decimalsSelected))
                            setUserEditedSingleAmount(false)
                          }
                        }}
                      >
                        Saisir le montant
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { setShowPaymentInputs(false); setUseSplitPayment(false); }}>Masquer</Button>
                    )}
                  </div>

                  {showPaymentInputs && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Montant ({selectedCurrency?.code ?? currencySymbol})</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">{selectedCurrency?.symbole ?? currencySymbol}</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={singleAmount}
                            onChange={(e) => {
                              setSingleAmount(e.target.value)
                              setUserEditedSingleAmount(true)
                            }}
                            className="pl-7 text-lg font-semibold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant={useSplitPayment ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => {
                            setUseSplitPayment(true)
                            setSingleAmount("")
                            setFrancAmount("")
                            setDollarAmount("")
                            setUserEditedSingleAmount(false)
                          }}
                        >
                          Utiliser paiement fractionné
                        </Button>
                        {useSplitPayment && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUseSplitPayment(false)
                              if (showPaymentInputs) {
                                setSingleAmount(grandTotal.toFixed(decimalsSelected))
                                setUserEditedSingleAmount(false)
                              }
                            }}
                          >
                            Désactiver paiement fractionné
                          </Button>
                        )}
                      </div>

                      {useSplitPayment && (
                        <>
                          <div className="space-y-2">
                            <Label>Montant en franc</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-muted-foreground">{francCurrency?.symbole ?? francCurrency?.code ?? "FC"}</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={francAmount}
                                onChange={(event) => setFrancAmount(event.target.value)}
                                className="pl-7 text-lg font-semibold"
                              />
                                      {suggestedDollarFromFranc !== null && (
                                        <p className="mt-1 text-sm text-muted-foreground">Compléter en {dollarSymbol} : <strong>{dollarSymbol}{formatAmountForDisplay(suggestedDollarFromFranc, dollarCurrency)}</strong></p>
                                      )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Montant en dollar</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-muted-foreground">{dollarCurrency?.symbole ?? dollarCurrency?.code ?? "$"}</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={dollarAmount}
                                onChange={(event) => setDollarAmount(event.target.value)}
                                className="pl-7 text-lg font-semibold"
                              />
                              {suggestedFrancFromDollar !== null && (
                                <p className="mt-1 text-sm text-muted-foreground">Compléter en {francSymbol} : <strong>{francSymbol}{formatAmountForDisplay(suggestedFrancFromDollar, francCurrency)}</strong></p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (francAmountNum > 0 && dollarRateToSelected) {
                                  const remainingSelected = Math.max(grandTotal - francEquivalentRounded, 0)
                                  const suggested = ceilToDecimals(remainingSelected / dollarRateToSelected, currencyDecimals(dollarCurrency))
                                  setDollarAmount(suggested.toFixed(currencyDecimals(dollarCurrency)))
                                }
                              }}
                              disabled={francAmountNum <= 0 || !dollarRateToSelected}
                              className="text-xs"
                            >
                              Compléter en $
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (dollarAmountNum > 0 && francRateToSelected) {
                                  const remainingSelected = Math.max(grandTotal - dollarEquivalentRounded, 0)
                                  const suggested = ceilToDecimals(remainingSelected / francRateToSelected, currencyDecimals(francCurrency))
                                  setFrancAmount(suggested.toFixed(currencyDecimals(francCurrency)))
                                }
                              }}
                              disabled={dollarAmountNum <= 0 || !francRateToSelected}
                              className="text-xs"
                            >
                              Compléter en FC
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (francCurrency?.id === selectedCurrencyId || !dollarCurrency) {
                                  setFrancAmount(grandTotal.toFixed(currencyDecimals(francCurrency)))
                                  setDollarAmount("")
                                } else if (francRateToSelected) {
                                  const suggested = ceilToDecimals(grandTotal / francRateToSelected, currencyDecimals(francCurrency))
                                  setFrancAmount(suggested.toFixed(currencyDecimals(francCurrency)))
                                  setDollarAmount("")
                                }
                              }}
                              className={paymentAmountNum === grandTotal ? "border-primary bg-primary/10" : ""}
                            >
                              Tout en franc
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (dollarCurrency?.id === selectedCurrencyId || !francCurrency) {
                                  setDollarAmount(grandTotal.toFixed(currencyDecimals(dollarCurrency)))
                                  setFrancAmount("")
                                } else if (dollarRateToSelected) {
                                  const suggested = ceilToDecimals(grandTotal / dollarRateToSelected, currencyDecimals(dollarCurrency))
                                  setDollarAmount(suggested.toFixed(currencyDecimals(dollarCurrency)))
                                  setFrancAmount("")
                                }
                              }}
                            >
                              Tout en dollar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!(francCurrency && dollarCurrency && francRateToSelected && dollarRateToSelected)) return

                                const halfSelected = grandTotal / 2

                                // If selected currency is dollar, make dollar half exact and compute franc equivalent
                                if (selectedCurrencyId === dollarCurrency?.id) {
                                  const dollarVal = roundToDecimals(halfSelected, currencyDecimals(dollarCurrency))
                                  const francVal = ceilToDecimals(halfSelected / (francRateToSelected ?? 1), currencyDecimals(francCurrency))
                                  setDollarAmount(dollarVal.toFixed(currencyDecimals(dollarCurrency)))
                                  setFrancAmount(francVal.toFixed(currencyDecimals(francCurrency)))
                                  return
                                }

                                // If selected currency is franc, make franc half exact and compute dollar equivalent
                                if (selectedCurrencyId === francCurrency?.id) {
                                  const francVal = roundToDecimals(halfSelected, currencyDecimals(francCurrency))
                                  const dollarVal = ceilToDecimals(halfSelected / (dollarRateToSelected ?? 1), currencyDecimals(dollarCurrency))
                                  setFrancAmount(francVal.toFixed(currencyDecimals(francCurrency)))
                                  setDollarAmount(dollarVal.toFixed(currencyDecimals(dollarCurrency)))
                                  return
                                }

                                // Fallback: compute each side from halfSelected using their rates
                                const francSuggested = ceilToDecimals(halfSelected / (francRateToSelected ?? 1), currencyDecimals(francCurrency))
                                const dollarSuggested = ceilToDecimals(halfSelected / (dollarRateToSelected ?? 1), currencyDecimals(dollarCurrency))
                                setFrancAmount(francSuggested.toFixed(currencyDecimals(francCurrency)))
                                setDollarAmount(dollarSuggested.toFixed(currencyDecimals(dollarCurrency)))
                              }}
                            >
                              Répartition 50 / 50
                            </Button>
                          </div>
                        </>
                      )}

                      {showPaymentInputs && !useSplitPayment && (
                        <div className="mt-2">
                          {!isFullPayment && singleAmountNum > 0 && (
                            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                              <Info className="h-4 w-4 text-amber-600" />
                              <AlertDescription className="text-amber-800 dark:text-amber-200">
                                Montant payé équivalent : <strong>{currencySymbol}{paymentAmountNum.toFixed(decimalsSelected)}</strong>.
                                Reste à payer : <strong>{currencySymbol}{remainingBalance.toFixed(decimalsSelected)}</strong>
                              </AlertDescription>
                            </Alert>
                          )}

                          {isFullPayment && singleAmountNum > 0 && (
                            <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <AlertDescription className="text-emerald-800 dark:text-emerald-200">
                                Paiement complet, aucun reste à payer.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}

                      {showPaymentInputs && useSplitPayment && (
                        <div className="mt-2">
                          {paymentAmountNum > 0 && paymentAmountNum < grandTotal && (
                            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                              <Info className="h-4 w-4 text-amber-600" />
                              <AlertDescription className="text-amber-800 dark:text-amber-200">
                                Montant payé équivalent : <strong>{currencySymbol}{paymentAmountNum.toFixed(decimalsSelected)}</strong>.
                                Reste à payer : <strong>{currencySymbol}{(grandTotal - paymentAmountNum).toFixed(decimalsSelected)}</strong>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Méthode de paiement</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div
                    className={`flex items-center space-x-2 rounded-lg border p-3 cursor-pointer transition-colors sm:p-4 ${
                      paymentMethod === "card" ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center cursor-pointer flex-1">
                      <CreditCard className="mr-2 h-5 w-5" />
                      Carte bancaire
                    </Label>
                  </div>

                  <div
                    className={`mt-3 flex items-center space-x-2 rounded-lg border p-3 cursor-pointer transition-colors sm:p-4 ${
                      paymentMethod === "cash" ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="flex items-center cursor-pointer flex-1">
                      <Wallet className="mr-2 h-5 w-5" />
                      Espèces
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {paymentMethod === "card" && (
              <Card>
                <CardHeader>
                  <CardTitle>Informations de la carte</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cardError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{cardError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label>Numéro de carte</Label>
                    <Input
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                      maxLength={19}
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nom du titulaire</Label>
                    <Input
                      placeholder="John Doe"
                      value={cardName}
                      onChange={(event) => setCardName(event.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date d'expiration</Label>
                      <Input
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(event) => setCardExpiry(formatExpiry(event.target.value))}
                        maxLength={5}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CVV</Label>
                      <Input
                        placeholder="123"
                        type="password"
                        value={cardCvv}
                        onChange={(event) => setCardCvv(event.target.value.replace(/\D/g, "").slice(0, 4))}
                        maxLength={4}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {(catalogError || paymentError || hasMixedSourceCurrencies) && (
              <Card>
                <CardHeader>
                  <CardTitle>Statut</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {catalogError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{catalogError}</AlertDescription>
                    </Alert>
                  )}
                  {paymentError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium">{paymentError.title}</div>
                        <div>{paymentError.description}</div>
                      </AlertDescription>
                    </Alert>
                  )}
                  {hasMixedSourceCurrencies && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Le panier mélange plusieurs devises sources. Le système convertit chaque ligne selon sa devise d'origine.
                      </AlertDescription>
                    </Alert>
                  )}
                  {hasLossRisk && (
                    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        Une ou plusieurs lignes sont en dessous du prix d'achat. Vérifie les prix unitaires avant validation.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full h-14 text-lg font-semibold"
              size="lg"
              onClick={handlePayment}
              disabled={
                isProcessing ||
                paymentAmountNum <= 0 ||
                hasPendingRate ||
                hasPendingSplitRate ||
                isCatalogLoading ||
                !selectedCurrencyId ||
                !customer?.id
              }
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Traitement du paiement...
                </div>
              ) : (
                <>
                  {isSplitPayment
                    ? `Valider paiement fractionné (${francSymbol}${francAmountNum.toFixed(currencyDecimals(francCurrency))} + ${dollarSymbol}${dollarAmountNum.toFixed(currencyDecimals(dollarCurrency))})`
                    : `${isFullPayment ? "Paiement complet" : "Valider le paiement partiel"} - ${currencySymbol}${paymentAmountNum.toFixed(decimalsSelected)}`}
                </>
              )}
            </Button>

            {!customer?.id && (
              <p className="text-sm text-center text-amber-600">
                Sélectionnez un client dans la barre latérale du panier avant de valider la vente.
              </p>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Vos informations de paiement sont sécurisées et chiffrées.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
