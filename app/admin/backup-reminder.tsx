"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DatabaseBackup, HardDriveDownload } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { backendRequest } from "@/app/services/backend"
import { BACKUP_COMPLETED_KEY, BACKUP_DISMISSED_KEY, localDateKey } from "./database-backup-utils"

type BackupSettings = {
  enabled: boolean
  timezone: string
  last_status: "sent" | "failed" | null
  last_attempted_at: string | null
  last_completed_at: string | null
}

function dateInTimezone(value: string | null, timezone: string) {
  if (!value) return ""
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value))
}

export default function BackupReminder() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [completedToday, setCompletedToday] = useState(false)
  const [automaticFailure, setAutomaticFailure] = useState(false)

  const checkReminder = useCallback(async () => {
    let today = localDateKey()
    let completed = localStorage.getItem(BACKUP_COMPLETED_KEY) === today
    let failed = false
    let hour = new Date().getHours()
    try {
      const response = await backendRequest<{ data?: BackupSettings }>("/admin/backup/settings")
      const configuration = response.data
      if (configuration?.enabled) {
        today = dateInTimezone(new Date().toISOString(), configuration.timezone)
        hour = Number(new Intl.DateTimeFormat("en-GB", {
          timeZone: configuration.timezone,
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()))
        const attemptDay = dateInTimezone(configuration.last_attempted_at, configuration.timezone)
        const completionDay = dateInTimezone(configuration.last_completed_at, configuration.timezone)
        completed ||= configuration.last_status === "sent" && completionDay === today
        failed = configuration.last_status === "failed" && attemptDay === today
        if (completed) localStorage.setItem(BACKUP_COMPLETED_KEY, today)
      }
    } catch (error) {
      console.error("Impossible de vérifier l’état de la sauvegarde quotidienne.", error)
    }
    setCompletedToday(completed)
    setAutomaticFailure(failed)
    setOpen(
      !completed
      && hour >= 18
      && localStorage.getItem(BACKUP_DISMISSED_KEY) !== today,
    )
  }, [])

  useEffect(() => {
    checkReminder()
    const interval = window.setInterval(checkReminder, 60_000)
    window.addEventListener("focus", checkReminder)
    window.addEventListener("database-backup-completed", checkReminder)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", checkReminder)
      window.removeEventListener("database-backup-completed", checkReminder)
    }
  }, [checkReminder])

  const dismissUntilTomorrow = () => {
    localStorage.setItem(BACKUP_DISMISSED_KEY, localDateKey())
    setOpen(false)
  }

  return (
    <>
      {completedToday && (
        <Button
          className="fixed bottom-4 right-4 z-40 shadow-lg print:hidden"
          variant="secondary"
          onClick={() => router.push("/admin/sauvegardes")}
        >
          <DatabaseBackup className="mr-2 h-4 w-4" />
          Sauvegarde faite aujourd’hui
        </Button>
      )}
      <AlertDialog open={open} onOpenChange={(nextOpen) => {
        if (!nextOpen) dismissUntilTomorrow()
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5 text-primary" />
              {automaticFailure ? "Échec de la sauvegarde quotidienne" : "Rappel de sauvegarde quotidienne"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {automaticFailure
                ? "L’envoi automatique a échoué. Téléchargez la copie locale de secours ou créez une sauvegarde manuelle."
                : "Il est 18 h. Pensez à vérifier que la sauvegarde quotidienne a bien été envoyée ou à télécharger une copie locale."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={dismissUntilTomorrow}>Me rappeler demain</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/admin/sauvegardes")}>
              <HardDriveDownload className="mr-2 h-4 w-4" />
              Ouvrir les sauvegardes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
