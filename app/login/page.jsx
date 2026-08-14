"use client"

import { useState } from "react"
import { useAuth } from "../context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Store, Lock, User, AlertCircle, ShieldCheck, UserCog } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isVendeur, setIsVendeur] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()

  const handleVendeurToggle = (checked) => {
    setIsVendeur(checked)
    setPassword("")
    setError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!email.trim() || !password.trim()) {
      setError(isVendeur ? "Veuillez entrer votre email et votre code vendeur" : "Veuillez entrer votre email et votre mot de passe")
      setIsLoading(false)
      return
    }

    const result = await login(email, password, isVendeur)

    if (!result.success) {
      setError(result.error)
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Gestion des stocks</h1>
          <p className="text-slate-400 mt-2">Système de point de vente</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white/5 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold text-white text-center">
              Bienvenue
            </CardTitle>
            <CardDescription className="text-slate-400 text-center">
              Connecte-toi pour accéder au tableau de bord
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-400">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Sélection du type de connexion */}
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isVendeur
                    ? "bg-amber-500/10 border-amber-500/40"
                    : "bg-white/5 border-white/10"
                }`}
                onClick={() => handleVendeurToggle(!isVendeur)}
              >
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${
                    isVendeur ? "bg-amber-500 border-amber-500" : "border-slate-500 bg-transparent"
                  }`}
                >
                  {isVendeur && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                {isVendeur ? (
                  <UserCog className="w-4 h-4 text-amber-400 flex-shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${isVendeur ? "text-amber-300" : "text-slate-300"}`}>
                    {isVendeur ? "Connexion vendeur" : "Connexion administrateur"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isVendeur
                      ? "Cochez pour vous connecter en tant que vendeur"
                      : "Décochez pour vous connecter en tant qu'administrateur"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type="email"
                    placeholder={isVendeur ? "email@vendeur.com" : "triomphembasa@gmail.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Entrer ton mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className={`w-full h-12 text-white font-medium shadow-lg ${
                  isVendeur
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/30"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/30"
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connexion en cours...
                  </div>
                ) : (
                  isVendeur ? "Se connecter (Vendeur)" : "Se connecter (Admin)"
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            {/* <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-sm text-slate-400 text-center mb-3">
                Identifiants de démonstration
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-emerald-400 font-medium mb-1">Admin</p>
                  <p className="text-xs text-slate-300">triomphembasa@gmail.com / admin1234</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-amber-400 font-medium mb-1">Vendeur</p>
                  <p className="text-xs text-slate-300">email vendeur + mot de passe</p>
                </div>
              </div>
            </div> */}
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-6">
          Propulsé par ExtraDev
        </p>
      </div>
    </div>
  )
}
