"use client"

import { useEffect, useState } from "react"
import { Bell, CheckCheck } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { backendRequest } from "@/app/services/backend"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type BackendNotification = {
  id: string
  data?: {
    type?: string
    title?: string
    message?: string
    action?: string
    entity?: string
    entity_name?: string
    actor_name?: string
  }
  created_at?: string
  read_at?: string | null
}

type NotificationBellProps = {
  showLabel?: boolean
  className?: string
}

export function NotificationBell({ showLabel = false, className }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<BackendNotification[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const response = await backendRequest<{ data: BackendNotification[] }>("/notifications/unread")
      setNotifications(response.data ?? [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()

    const interval = window.setInterval(loadNotifications, 30000)
    return () => window.clearInterval(interval)
  }, [])

  const markAsRead = async (notificationId: string) => {
    const previousNotifications = notifications
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId))

    try {
      await backendRequest(`/notifications/${notificationId}/read`, {
        method: "POST",
      })
    } catch {
      setNotifications(previousNotifications)
      toast({
        variant: "destructive",
        title: "Impossible de marquer la notification comme lue",
        description: "Vérifie la connexion au serveur puis réessaie.",
      })
    }
  }

  const markAllAsRead = async () => {
    const previousNotifications = notifications
    setNotifications([])

    try {
      await backendRequest("/notifications/read-all", {
        method: "POST",
      })
    } catch {
      setNotifications(previousNotifications)
      toast({
        variant: "destructive",
        title: "Impossible de marquer toutes les notifications comme lues",
        description: "Vérifie la connexion au serveur puis réessaie.",
      })
    }
  }

  const button = showLabel ? (
    <Button variant="outline" className={`gap-2 ${className ?? ""}`.trim()} onClick={loadNotifications} disabled={loading}>
      <Bell className="h-4 w-4" />
      Notifications
      {notifications.length > 0 && <Badge className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">{notifications.length}</Badge>}
    </Button>
  ) : (
    <Button variant="ghost" size="icon" className={`relative ${className ?? ""}`.trim()} onClick={loadNotifications} disabled={loading}>
      <Bell className="h-5 w-5" />
      {notifications.length > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {notifications.length}
        </span>
      )}
    </Button>
  )

  return (
    <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
      <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[26rem] w-[calc(100vw-1rem)] max-w-80 overflow-y-auto sm:w-80">
        <div className="px-3 py-2">
          <p className="text-sm font-medium">Notifications</p>
          <p className="text-xs text-muted-foreground">{notifications.length} notification(s) non lue(s)</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 px-3 py-2"
          onSelect={(event) => {
            event.preventDefault()
            void markAllAsRead()
          }}
          disabled={notifications.length === 0 || loading}
        >
          <CheckCheck className="h-4 w-4" />
          Tout marquer comme lu
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune notification non lue.</div>
        ) : (
          notifications.map((notification) => {
            const title = notification.data?.title ?? "Notification"
            const message = notification.data?.message ?? "Une action a été réalisée."
            const timeLabel = notification.created_at
              ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
              : "à l'instant"

            return (
              <DropdownMenuItem
                key={notification.id}
                className="flex cursor-pointer flex-col items-start gap-1 px-3 py-3"
                onSelect={(event) => {
                  event.preventDefault()
                  void markAsRead(notification.id)
                }}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{message}</p>
                  </div>
                  <CheckCheck className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </div>
                <p className="text-[11px] text-muted-foreground">{timeLabel}</p>
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}