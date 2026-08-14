"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldX, Home, ArrowLeft } from "lucide-react"

export default function AccessDeniedPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Accès refusé
          </CardTitle>
          <CardDescription className="text-slate-400">
            Vous n'avez pas l'autorisation d'accéder à cette zone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-slate-300 text-sm">
            Cette section est réservée aux administrateurs. Si vous pensez qu'il s'agit d'une erreur, contactez votre administrateur système.
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push("/")}
              className="w-full h-12 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium"
            >
              <Home className="w-4 h-4 mr-2" />
              Aller au tableau de bord POS
            </Button>
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="w-full h-12 bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retourner
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
