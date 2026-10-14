"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, Send, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { backendRequest, getBackendBaseUrl, getStoredToken } from "@/app/services/backend"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BACKUP_COMPLETED_KEY, localDateKey, markDatabaseBackupCompleted } from "../database-backup-utils"

type BackupSettings = {
  email: string
  enabled: boolean
  timezone: string
  last_attempted_at: string | null
  last_completed_at: string | null
  last_status: "sent" | "failed" | null
  last_error: string | null
  fallback_available: boolean
}

type ApiEnvelope<T> = { data?: T }

const defaultSettings: BackupSettings = {
  email: "",
  enabled: false,
  timezone: "Africa/Lubumbashi",
  last_attempted_at: null,
  last_completed_at: null,
  last_status: null,
  last_error: null,
  fallback_available: false,
}

function formatSavedAt(value: string | null) {
  if (!value) return "Aucune sauvegarde confirmée aujourd’hui sur ce navigateur."
  const [year, month, day] = value.split("-")
  return `Une sauvegarde a été téléchargée aujourd’hui (${day}/${month}/${year}).`
}

export default function DatabaseBackupsPage() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [savedToday, setSavedToday] = useState(false)
  const [settings, setSettings] = useState<BackupSettings>(defaultSettings)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)

  useEffect(() => {
    setSavedToday(localStorage.getItem(BACKUP_COMPLETED_KEY) === localDateKey())
    void backendRequest<ApiEnvelope<BackupSettings>>("/admin/backup/settings")
      .then((response) => setSettings({ ...defaultSettings, ...response.data }))
      .catch((settingsError: unknown) => {
        setError(settingsError instanceof Error ? settingsError.message : "Impossible de charger la configuration des sauvegardes.")
      })
  }, [])

  const saveSettings = async () => {
    if (settings.enabled && !settings.email.trim()) {
      setError("Saisissez une adresse e-mail avant d’activer l’envoi automatique.")
      return
    }
    setIsSavingSettings(true)
    setError("")
    setSuccess("")
    try {
      const response = await backendRequest<ApiEnvelope<BackupSettings>>("/admin/backup/settings", {
        method: "PUT",
        body: JSON.stringify({
          email: settings.email.trim(),
          enabled: settings.enabled,
          timezone: settings.timezone,
        }),
      })
      setSettings({ ...defaultSettings, ...response.data })
      setSuccess("La configuration des sauvegardes a été enregistrée.")
      toast.success("Configuration des sauvegardes enregistrée avec succès.")
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Impossible d’enregistrer la configuration."
      setError(message)
      toast.error(message)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const sendBackupByEmail = async () => {
    setIsSendingEmail(true)
    setError("")
    setSuccess("")
    try {
      const response = await backendRequest<{ message?: string }>("/admin/backup/database/email", { method: "POST" })
      const message = response.message || "La sauvegarde a été envoyée par e-mail."
      setSuccess(message)
      toast.success(message)
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Impossible d’envoyer la sauvegarde par e-mail."
      setError(message)
      toast.error(message)
    }

    try {
      const updatedSettings = await backendRequest<ApiEnvelope<BackupSettings>>("/admin/backup/settings")
      setSettings({ ...defaultSettings, ...updatedSettings.data })
    } catch (refreshError) {
      console.error("Impossible d’actualiser l’état de la sauvegarde après l’envoi.", refreshError)
    } finally {
      setIsSendingEmail(false)
    }
  }

  const downloadBackup = async (endpoint = "/admin/backup/database", fallbackName = `sauvegarde-${localDateKey()}.sql`) => {
    setIsDownloading(true)
    setError("")
    setSuccess("")
    try {
      const token = getStoredToken()
      const response = await fetch(`${getBackendBaseUrl()}${endpoint}`, {
        headers: {
          Accept: "application/sql, application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        let message = `La sauvegarde a échoué (HTTP ${response.status}).`
        try {
          const payload = await response.json() as { message?: string }
          message = payload.message || message
        } catch {
          // Preserve the explicit HTTP status when the server does not return JSON.
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const disposition = response.headers.get("Content-Disposition") ?? ""
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallbackName
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)

      markDatabaseBackupCompleted()
      setSavedToday(true)
      setSuccess("La sauvegarde a été téléchargée sur cet appareil.")
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Impossible de télécharger la sauvegarde.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-2xl border bg-gradient-to-br from-background via-background to-primary/10 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration · Sécurité des données</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Sauvegarde de la base de données</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Téléchargez une copie SQL de la structure et des données de la boutique, puis conservez-la sur un support sûr.
        </p>
      </header>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}
      {savedToday && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{formatSavedAt(localStorage.getItem(BACKUP_COMPLETED_KEY))}</AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary/10 p-3 text-primary"><DatabaseBackup className="h-6 w-6" /></span>
            <div>
              <CardTitle>Créer une sauvegarde maintenant</CardTitle>
              <CardDescription className="mt-1">Le fichier est généré depuis la base de données et téléchargé sur votre appareil.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="font-medium">1. Générer</p>
              <p className="mt-1 text-sm text-muted-foreground">Exporte les tables, leur structure, leurs données et les vues SQL.</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium">2. Télécharger</p>
              <p className="mt-1 text-sm text-muted-foreground">Un fichier .sql est enregistré via le navigateur, comme un téléchargement classique.</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium">3. Conserver</p>
              <p className="mt-1 text-sm text-muted-foreground">Copiez le fichier sur un support sécurisé distinct de cet ordinateur.</p>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="backup-email-enabled" className="text-base font-semibold">Envoi automatique par e-mail</Label>
                <p className="mt-1 text-sm text-muted-foreground">Chaque jour à 18 h, même si aucun administrateur n’est connecté.</p>
              </div>
              <Switch id="backup-email-enabled" checked={settings.enabled} onCheckedChange={(enabled) => setSettings((current) => ({ ...current, enabled }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
              <div className="space-y-2">
                <Label htmlFor="backup-email">Adresse e-mail de destination</Label>
                <Input id="backup-email" type="email" autoComplete="email" maxLength={255} value={settings.email} onChange={(event) => setSettings((current) => ({ ...current, email: event.target.value }))} placeholder="admin@exemple.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backup-timezone">Fuseau horaire</Label>
                <Select value={settings.timezone} onValueChange={(timezone) => setSettings((current) => ({ ...current, timezone }))}>
                  <SelectTrigger id="backup-timezone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Africa/Kinshasa">Afrique/Kinshasa (UTC+1)</SelectItem>
                    <SelectItem value="Africa/Lubumbashi">Afrique/Lubumbashi (UTC+2)</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Pour Gmail, activez la validation en deux étapes et utilisez un mot de passe d’application Google de 16 caractères, sans espaces, dans MAIL_PASSWORD de Backend/.env (pas le mot de passe habituel). Vérifiez aussi MAIL_HOST=smtp.gmail.com, MAIL_PORT=587 et MAIL_SCHEME=smtp (ou null pour STARTTLS automatique; ne mettez pas tls). En cas d’échec après génération, une copie locale de secours est conservée.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void sendBackupByEmail()} disabled={isSendingEmail || !settings.email.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  {isSendingEmail ? "Envoi en cours…" : "Envoyer une sauvegarde maintenant"}
                </Button>
                <Button onClick={() => void saveSettings()} disabled={isSavingSettings}>
                  {isSavingSettings ? "Enregistrement…" : "Enregistrer la configuration"}
                </Button>
              </div>
            </div>
            {settings.last_attempted_at && (
              <div className={`rounded-lg p-3 text-sm ${settings.last_status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted/50"}`}>
                {settings.last_status === "sent"
                  ? `Dernière sauvegarde envoyée : ${new Date(settings.last_completed_at ?? settings.last_attempted_at).toLocaleString("fr-FR")}.`
                  : `Dernière tentative : ${new Date(settings.last_attempted_at).toLocaleString("fr-FR")}. ${settings.last_error ?? "L’envoi a échoué."}`}
              </div>
            )}
            {settings.fallback_available && (
              <Button variant="outline" onClick={() => void downloadBackup("/admin/backup/database/latest-local", `sauvegarde-locale-${localDateKey()}.sql`)} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                Télécharger la dernière copie locale de secours
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-start">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-muted-foreground">
              Le fichier contient des données sensibles. Protégez-le et ne le partagez pas publiquement. Cette sauvegarde couvre la base de données, pas les images ou autres fichiers téléversés.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Réservé au compte administrateur
            </div>
            <Button onClick={() => void downloadBackup()} disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              {isDownloading ? "Préparation de la sauvegarde…" : "Télécharger la sauvegarde SQL"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold">Rappel quotidien à 18 h</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Si l’administration est ouverte après 18 h et qu’aucune sauvegarde n’a été téléchargée ce jour dans ce navigateur, un rappel s’affiche. Il réapparaîtra le lendemain si aucune sauvegarde n’est effectuée.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Le rappel dépend du navigateur et du fuseau horaire de l’appareil; il ne peut pas apparaître si l’application est fermée.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
