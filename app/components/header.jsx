"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "../context/auth-context"
import { useTheme } from "../context/theme-context"
import { useSettings } from "../context/settings-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { NotificationBell } from "./notification-bell"
import {
  Search,
  Settings,
  Sun,
  Moon,
  LogOut,
  User,
  Zap,
  Users,
  Shield,
  ShieldCheck,
} from "lucide-react"

export default function Header({ searchQuery, setSearchQuery }) {
  const router = useRouter()
  const { user, logout, isAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { settings, toggleQuickActions, toggleClientPage } = useSettings()

  return (
    <div className="sticky top-0 z-10 border-b bg-background">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <h1 className="truncate text-xl font-bold text-foreground sm:text-2xl">Point de vente</h1>
          
          {/* Role Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            isAdmin() 
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          }`}>
            {isAdmin() ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </>
            ) : (
              <>
                <Shield className="h-3.5 w-3.5" />
                Vendeur
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative w-full min-w-0 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher des produits..."
              className="bg-muted/50 pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <NotificationBell />

          {/* Admin Button - only visible to admins */}
          {isAdmin() && (
            <Button variant="outline" onClick={() => router.push("/admin")} className="hidden sm:inline-flex">
              <Settings className="h-4 w-4 mr-2" />
              Administration
            </Button>
          )}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 max-w-[12rem]">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="hidden truncate sm:inline">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] max-w-64 sm:w-64">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user?.name}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Quick Actions Toggle */}
              <div className="px-2 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Quick Actions</span>
                  </div>
                  <Switch
                    checked={settings.quickActionsEnabled}
                    onCheckedChange={toggleQuickActions}
                  />
                </div>
              </div>

              {/* Client Page Toggle */}
              <div className="px-2 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Client Page</span>
                  </div>
                  <Switch
                    checked={settings.clientPageEnabled}
                    onCheckedChange={toggleClientPage}
                  />
                </div>
              </div>

              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={() => router.push("/clients")}
                className="cursor-pointer"
              >
                <Users className="h-4 w-4 mr-2" />
                Voir les clients
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Actions Bar - when enabled */}
      {settings.quickActionsEnabled && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3 pb-3 pt-2 text-xs text-muted-foreground sm:px-4">
          <span className="font-medium">Actions rapides :</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+N</kbd>
          <span>Nouvelle vente</span>
          <span className="text-muted-foreground/50">|</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+P</kbd>
          <span>Payer</span>
          <span className="text-muted-foreground/50">|</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+F</kbd>
          <span>Rechercher</span>
          <span className="text-muted-foreground/50">|</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+D</kbd>
          <span>Remise</span>
          <span className="text-muted-foreground/50">|</span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
          <span>Effacer</span>
        </div>
      )}
    </div>
  )
}
