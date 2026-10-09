"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import formatMoney from "@/lib/formatMoney"
import { useAuth } from "../context/auth-context"

type PosReceipt = {
  date: string
  customer: {
    name: string
  }
  currency: {
    code?: string
    symbol?: string
  }
  paymentType: "total" | "avance" | "credit"
  total: number
  paid: number
  remaining: number
  discount: number
  lines: Array<{
    name: string
    unit?: string
    quantity: number
    unitPrice: number
    total: number
  }>
}

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()

  const amountPaid = Number.parseFloat(searchParams.get("amount") || "0")
  const remainingBalance = Number.parseFloat(searchParams.get("remaining") || "0")
  const paymentType = searchParams.get("type")
  const shouldPrint = searchParams.get("print") === "1"
  const receiptNumber = searchParams.get("receipt") || "—"
  const [receipt, setReceipt] = useState<PosReceipt | null>(null)
  const [receiptError, setReceiptError] = useState("")
  const didAutoPrint = useRef(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, user, router])

  useEffect(() => {
    const savedReceipt = sessionStorage.getItem("pos_pending_receipt")
    if (!savedReceipt) {
      setReceiptError("Les détails de la facture ne sont pas disponibles dans cette session.")
      return
    }

    try {
      const parsed = JSON.parse(savedReceipt) as PosReceipt
      if (!parsed.date || !parsed.customer?.name || !Array.isArray(parsed.lines)) {
        throw new Error("Données de facture incomplètes.")
      }
      setReceipt(parsed)
    } catch {
      setReceiptError("Impossible de charger l’aperçu de la facture. Revenez à la vente et réessayez.")
    }
  }, [])

  useEffect(() => {
    if (!shouldPrint || !receipt || didAutoPrint.current) return

    didAutoPrint.current = true
    const printTimer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(printTimer)
  }, [receipt, shouldPrint])

  const handleBackToPOS = () => {
    router.push("/")
  }

  const handlePrint = () => {
    window.print()
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const currencySymbol = receipt?.currency?.symbol || receipt?.currency?.code || ""
  const displayedPaymentType = receipt?.paymentType ?? paymentType
  const displayedPaid = receipt?.paid ?? amountPaid
  const displayedRemaining = receipt?.remaining ?? remainingBalance
  const displayedTotal = receipt?.total ?? displayedPaid + displayedRemaining
  const displayedDate = receipt?.date
    ? new Date(receipt.date).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    : new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })

  return (
    <main className="receipt-screen min-h-screen bg-slate-100 px-3 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="receipt-actions mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold">Vente enregistrée</h1>
              <p className="text-sm text-slate-600">Aperçu du reçu avant impression</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBackToPOS}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux ventes
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer le reçu
            </Button>
          </div>
        </div>

        {receiptError && (
          <p role="alert" className="mx-auto mb-4 max-w-[80mm] rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 print:hidden">
            {receiptError}
          </p>
        )}

        <section
          id="pos-receipt"
          aria-label="Aperçu du reçu à imprimer"
          className="mx-auto w-full max-w-[80mm] border border-slate-200 bg-white px-5 py-6 shadow-lg sm:px-6"
        >
          <header className="text-center">
            <h2 className="receipt-store-name text-xl font-black uppercase tracking-wide">Mukingi Accessoir</h2>
            <p className="mt-1 text-sm">Téléphone : 0992359255</p>
            <p className="mt-3 border-y border-dashed border-slate-400 py-2 text-lg font-bold uppercase">
              Facture / Reçu
            </p>
          </header>

          <div className="mt-3 space-y-1 text-xs">
            <div className="receipt-meta-row flex justify-between gap-2">
              <span>N° facture</span>
              <span className="receipt-meta-value break-all text-right font-semibold">{receiptNumber}</span>
            </div>
            <div className="receipt-meta-row flex justify-between gap-2">
              <span>Date</span>
              <span className="receipt-meta-value text-right">{displayedDate}</span>
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-slate-400" />

          <div className="text-xs">
            <p>
              <span className="font-bold uppercase">Client : </span>
              <span className="font-semibold">{receipt?.customer.name || "Client comptoir"}</span>
            </p>
          </div>

          <div className="my-3 border-t border-dashed border-slate-400" />

          <table className="receipt-lines w-full table-fixed text-left text-[11px] leading-snug">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[11%]" />
              <col className="w-[27.5%]" />
              <col className="w-[27.5%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-400">
                <th className="py-1 pr-1">Article</th>
                <th className="py-1 text-center">Qté</th>
                <th className="py-1 text-right">P.U.</th>
                <th className="py-1 pl-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt?.lines.map((line, index) => (
                <tr key={`${line.name}-${index}`} className="border-b border-dotted border-slate-300 align-top">
                  <td className="receipt-item-name break-words py-2 pr-1 font-medium">
                    {line.name}
                    {line.unit && <span className="block text-[10px] text-slate-600">{line.unit}</span>}
                  </td>
                  <td className="py-2 text-center">{line.quantity}</td>
                  <td className="receipt-amount py-2 text-right">{formatMoney(line.unitPrice, currencySymbol)}</td>
                  <td className="receipt-amount py-2 pl-1 text-right font-semibold">{formatMoney(line.total, currencySymbol)}</td>
                </tr>
              ))}
              {receipt && receipt.lines.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-slate-500">Aucun article sur ce reçu.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="my-3 border-t border-dashed border-slate-400" />

          <div id="receipt-summary" className="space-y-1.5 text-xs">
            {receipt && (
              <>
                <div className="receipt-summary-row flex justify-between gap-2">
                  <span>Sous-total</span>
                  <span className="receipt-amount">{formatMoney(receipt.total + receipt.discount, currencySymbol)}</span>
                </div>
                {receipt.discount > 0 && (
                  <div className="receipt-summary-row flex justify-between gap-2">
                    <span>Remise</span>
                    <span className="receipt-amount">- {formatMoney(receipt.discount, currencySymbol)}</span>
                  </div>
                )}
              </>
            )}
            <div className="receipt-summary-row flex justify-between gap-2 border-t border-slate-300 pt-2 text-sm font-black">
              <span>TOTAL</span>
              <span className="receipt-amount">{formatMoney(displayedTotal, currencySymbol)}</span>
            </div>
            <div className="receipt-summary-row flex justify-between gap-2">
              <span>Type de paiement</span>
              <span className="font-semibold">
                {displayedPaymentType === "credit" ? "Crédit" : displayedPaymentType === "avance" ? "Avance" : "Total"}
              </span>
            </div>
            <div className="receipt-summary-row flex justify-between gap-2">
              <span>Montant payé</span>
              <span className="receipt-amount">{formatMoney(displayedPaid, currencySymbol)}</span>
            </div>
            {displayedRemaining > 0 && (
              <div className="receipt-summary-row flex justify-between gap-2 font-bold">
                <span>Reste à payer</span>
                <span className="receipt-amount">{formatMoney(displayedRemaining, currencySymbol)}</span>
              </div>
            )}
          </div>

          <footer className="mt-5 border-t border-dashed border-slate-400 pt-3 text-center text-xs">
            <p className="font-semibold">Merci pour votre confiance !</p>
            <p className="mt-1">Conservez ce reçu.</p>
          </footer>
        </section>

        <p className="mt-4 text-center text-xs text-slate-500 print:hidden">
          Vérifiez l’aperçu, puis sélectionnez votre imprimante POS dans la fenêtre d’impression.
        </p>
      </div>

      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: auto !important;
            height: auto !important;
            min-width: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }

          .receipt-screen {
            display: block !important;
            width: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          .receipt-actions,
          .receipt-screen > div > p {
            display: none !important;
          }

          #pos-receipt {
            position: static !important;
            display: block !important;
            box-sizing: border-box !important;
            width: 66mm !important;
            max-width: 66mm !important;
            min-width: 0 !important;
            margin: 0 auto !important;
            padding: 1mm 2mm !important;
            border: 0 !important;
            box-shadow: none !important;
            color: #000 !important;
            font-family: Arial, sans-serif !important;
            overflow: visible !important;
            break-inside: auto !important;
          }

          #pos-receipt header,
          #pos-receipt section,
          #pos-receipt div,
          #pos-receipt table,
          #pos-receipt tr,
          #pos-receipt th,
          #pos-receipt td,
          #pos-receipt footer {
            box-sizing: border-box !important;
            max-width: 100% !important;
          }

          #pos-receipt * {
            color: #000 !important;
          }

          #pos-receipt .receipt-store-name {
            font-size: 17px !important;
            letter-spacing: 0 !important;
            overflow-wrap: anywhere !important;
          }

          #pos-receipt header > p:first-of-type {
            font-size: 12px !important;
          }

          #pos-receipt header > p:last-of-type {
            font-size: 16px !important;
          }

          #pos-receipt > div,
          #pos-receipt #receipt-summary {
            font-size: 12px !important;
            line-height: 1.45 !important;
          }

          #pos-receipt .receipt-lines {
            font-size: 10px !important;
            line-height: 1.35 !important;
          }

          #pos-receipt .receipt-lines th,
          #pos-receipt .receipt-lines td {
            font-size: 11px !important;
            line-height: 1.4 !important;
          }

          #pos-receipt .receipt-item-name {
            font-size: 12px !important;
          }

          #pos-receipt .receipt-lines td > span {
            font-size: 10px !important;
          }

          #pos-receipt #receipt-summary .receipt-summary-row.text-sm {
            font-size: 14px !important;
          }

          #pos-receipt footer {
            font-size: 11px !important;
          }

          #pos-receipt .receipt-meta-row,
          #pos-receipt .receipt-summary-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: baseline !important;
            column-gap: 2mm !important;
            width: 100% !important;
          }

          #pos-receipt .receipt-meta-row > :last-child,
          #pos-receipt .receipt-summary-row > :last-child {
            min-width: 0 !important;
            text-align: left !important;
            overflow-wrap: anywhere !important;
          }

          #pos-receipt .receipt-summary-row {
            grid-template-columns: minmax(0, 58%) minmax(0, 42%) !important;
            column-gap: 1mm !important;
          }

          #pos-receipt .receipt-meta-value {
            overflow-wrap: anywhere !important;
          }

          #pos-receipt .receipt-lines {
            display: table !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
            overflow: hidden !important;
          }

          #pos-receipt .receipt-lines th,
          #pos-receipt .receipt-lines td {
            min-width: 0 !important;
            padding-left: 0 !important;
            padding-right: 1mm !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
          }

          #pos-receipt .receipt-lines th:last-child,
          #pos-receipt .receipt-lines td:last-child {
            padding-right: 0 !important;
          }

          #pos-receipt .receipt-lines th:nth-child(3),
          #pos-receipt .receipt-lines th:nth-child(4),
          #pos-receipt .receipt-lines td:nth-child(3),
          #pos-receipt .receipt-lines td:nth-child(4) {
            text-align: left !important;
            padding-left: 1mm !important;
          }

          #pos-receipt .receipt-lines .receipt-amount {
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            font-size: 10px !important;
          }

          #pos-receipt .receipt-item-name {
            font-size: 12px !important;
            line-height: 1.4 !important;
          }

          #pos-receipt tr {
            break-inside: avoid !important;
          }

          #receipt-summary {
            break-inside: avoid !important;
          }
        }
      `}</style>
    </main>
  )
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
