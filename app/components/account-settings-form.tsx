"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, KeyRound, Loader2, Save, UserRound } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/app/context/auth-context"
import { backendRequest } from "@/app/services/backend"

type AccountProfile = {
  id: number | string
  role?: string
  nom?: string | null
  post_nom?: string | null
  prenom?: string | null
  email?: string | null
}

type AuthWithProfile = {
  user: (AccountProfile & { name?: string }) | null
  updateUserProfile: (profile: AccountProfile) => void
}

type AccountSettingsFormProps = {
  returnPath: string
}

export default function AccountSettingsForm({ returnPath }: AccountSettingsFormProps) {
  const router = useRouter()
  const { user, updateUserProfile } = useAuth() as AuthWithProfile
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const isSeller = user?.role === "vendeur"

  useEffect(() => {
    let cancelled = false

    backendRequest<AccountProfile>("/user")
      .then((response) => {
        if (!cancelled) setProfile(response)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger le profil.")
        setProfile(user)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const updateField = (field: keyof AccountProfile, value: string) => {
    setProfile((current) => ({ ...(current ?? user ?? { id: "" }), [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setSuccess("")

    if (!profile?.nom?.trim() || !profile?.prenom?.trim()) {
      setError("Le nom et le prénom sont obligatoires.")
      return
    }
    if (password && password !== passwordConfirmation) {
      setError("La confirmation du mot de passe ne correspond pas.")
      return
    }
    if (password && !currentPassword) {
      setError("Saisissez votre mot de passe actuel pour en choisir un nouveau.")
      return
    }

    const payload: Record<string, string> = {
      nom: profile.nom.trim(),
      prenom: profile.prenom.trim(),
    }
    if (!isSeller) payload.post_nom = profile.post_nom?.trim() ?? ""
    if (password) {
      payload.current_password = currentPassword
      payload.password = password
      payload.password_confirmation = passwordConfirmation
    }

    setIsSaving(true)
    try {
      const response = await backendRequest<{ data: AccountProfile }>("/account/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      setProfile(response.data)
      updateUserProfile(response.data)
      setCurrentPassword("")
      setPassword("")
      setPasswordConfirmation("")
      setSuccess("Votre compte a été mis à jour.")
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de mettre à jour le compte.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push(returnPath)} aria-label="Retour">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Mon compte</h1>
          <p className="text-sm text-muted-foreground">Modifiez votre nom et votre mot de passe.</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" />Informations personnelles</CardTitle>
            <CardDescription>Ces informations identifient votre compte dans l’application.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-prenom">Prénom</Label>
              <Input
                id="profile-prenom"
                value={profile?.prenom ?? ""}
                onChange={(event) => updateField("prenom", event.target.value)}
                autoComplete="given-name"
                required
                disabled={isLoading || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-nom">Nom</Label>
              <Input
                id="profile-nom"
                value={profile?.nom ?? ""}
                onChange={(event) => updateField("nom", event.target.value)}
                autoComplete="family-name"
                required
                disabled={isLoading || isSaving}
              />
            </div>
            {!isSeller && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-postnom">Post-nom (facultatif)</Label>
                <Input
                  id="profile-postnom"
                  value={profile?.post_nom ?? ""}
                  onChange={(event) => updateField("post_nom", event.target.value)}
                  disabled={isLoading || isSaving}
                />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="profile-email">Adresse e-mail</Label>
              <Input id="profile-email" value={profile?.email ?? user?.email ?? ""} disabled />
              <p className="text-xs text-muted-foreground">L’adresse e-mail n’est pas modifiable ici.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Changer le mot de passe</CardTitle>
            <CardDescription>Laissez ces champs vides si vous ne souhaitez pas modifier votre mot de passe.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="current-password">Mot de passe actuel</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-confirmation">Confirmer le nouveau mot de passe</Label>
              <Input
                id="password-confirmation"
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                disabled={isSaving}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading || isSaving || !profile}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer les modifications
          </Button>
        </div>
      </form>
    </div>
  )
}
