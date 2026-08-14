"use client"

import type React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Plus, Edit, Trash2, MoreHorizontal, RefreshCw,
  Loader2, AlertCircle, ArrowLeftRight, CheckCircle2, XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { backendRequest } from "@/app/services/backend"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Devise {
  id: number
  code: string
  nom: string
  symbole: string
}

interface TauxRaw {
  id: number
  devise_source: number
  devise_but: number
  valeur: string
  valeur_inverse: string | null
  date_effet: string
  statut: "actif" | "inactif"
  devise_source_info?: Devise
  devise_but_info?: Devise
  // Nested relations from Laravel (camelCase or snake_case)
  deviseSource?: Devise
  deviseBut?: Devise
}

interface Taux extends Omit<TauxRaw, "deviseSource" | "deviseBut"> {
  devise_source_info: Devise | undefined
  devise_but_info: Devise | undefined
}

// ─── Precision helpers ───────────────────────────────────────────────────────

/**
 * Compute 1 / value in the browser with maximum JS float precision (15–16 sig. digits).
 * Returns an empty string if value is not a valid positive number.
 */
function calcInverse(rawValue: string): string {
  const n = parseFloat(rawValue)
  if (!isFinite(n) || n <= 0) return ""
  const inv = 1 / n
  // Format to 15 significant decimal digits then strip trailing zeros
  return stripTrailingZeros(inv.toPrecision(15))
}

/** Strip trailing zeros after the decimal point */
function stripTrailingZeros(s: string): string {
  if (!s.includes(".")) return s
  return s.replace(/\.?0+$/, "")
}

/**
 * Display a rate value nicely: up to 10 decimal places, stripped trailing zeros,
 * but never show scientific notation.
 */
function displayRate(v: string | null | undefined): string {
  if (!v) return "—"
  const n = parseFloat(v)
  if (!isFinite(n)) return v
  // Use toFixed(10) then strip zeros to get readable output
  return stripTrailingZeros(n.toFixed(10))
}

// ─── Normalise raw Laravel response ─────────────────────────────────────────

function normalise(raw: TauxRaw): Taux {
  // Laravel's toArray() may replace integer FKs with the loaded relation object.
  // Handle both: when FK is an integer and when it's been overridden by the object.
  const srcObj: Devise | undefined =
    raw.devise_source_info ?? raw.deviseSource ??
    (typeof raw.devise_source === 'object' ? (raw.devise_source as unknown as Devise) : undefined)
  const butObj: Devise | undefined =
    raw.devise_but_info ?? raw.deviseBut ??
    (typeof raw.devise_but === 'object' ? (raw.devise_but as unknown as Devise) : undefined)

  return {
    ...raw,
    devise_source: typeof raw.devise_source === 'number' ? raw.devise_source : (srcObj?.id ?? 0),
    devise_but: typeof raw.devise_but === 'number' ? raw.devise_but : (butObj?.id ?? 0),
    devise_source_info: srcObj,
    devise_but_info: butObj,
  }
}

// ─── Form initial state ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  devise_source: "",
  devise_but: "",
  valeur: "",
  date_effet: new Date().toISOString().slice(0, 10),
  statut: "inactif" as "actif" | "inactif",
  avec_inverse: true,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TauxPage() {
  const [tauxList, setTauxList] = useState<Taux[]>([])
  const [devises, setDevises] = useState<Devise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Taux | null>(null)
  const [formData, setFormData] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState("")

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const [tauxRes, devRes] = await Promise.all([
        backendRequest<{ data: TauxRaw[] }>("/taux?per_page=all"),
        backendRequest<{ data: Devise[] }>("/devises?per_page=all"),
      ])
      setTauxList((tauxRes.data ?? []).map(normalise))
      setDevises(devRes.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Computed inverse preview ───────────────────────────────────────────────

  const inversePreview = useMemo(() => calcInverse(formData.valeur), [formData.valeur])

  const srcDevise = useMemo(
    () => devises.find(d => String(d.id) === formData.devise_source),
    [devises, formData.devise_source],
  )
  const butDevise = useMemo(
    () => devises.find(d => String(d.id) === formData.devise_but),
    [devises, formData.devise_but],
  )

  // ── Dialog helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setFormData({ ...EMPTY_FORM })
    setFormError("")
    setShowDialog(true)
  }

  const openEdit = (t: Taux) => {
    setEditing(t)
    setFormData({
      devise_source: String(t.devise_source),
      devise_but: String(t.devise_but),
      valeur: t.valeur,
      date_effet: t.date_effet,
      statut: t.statut,
      avec_inverse: false, // don't auto-create inverse when editing
    })
    setFormError("")
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditing(null)
    setFormError("")
  }

  // ── Form field helpers ─────────────────────────────────────────────────────

  const setField = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }))

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.devise_source || !formData.devise_but) {
      setFormError("Veuillez sélectionner les deux devises.")
      return
    }
    if (formData.devise_source === formData.devise_but) {
      setFormError("La devise source et la devise but doivent être différentes.")
      return
    }
    const valNum = parseFloat(formData.valeur)
    if (!formData.valeur || !isFinite(valNum) || valNum <= 0) {
      setFormError("Le taux doit être un nombre positif.")
      return
    }
    if (!formData.date_effet) {
      setFormError("La date d'effet est obligatoire.")
      return
    }

    setIsSaving(true)
    setFormError("")

    try {
      const body = {
        devise_source: Number(formData.devise_source),
        devise_but: Number(formData.devise_but),
        valeur: formData.valeur,
        date_effet: formData.date_effet,
        statut: formData.statut,
        avec_inverse: formData.avec_inverse,
      }

      if (editing) {
        // Update: no inverse creation on edit
        const res = await backendRequest<{ data: TauxRaw }>(`/taux/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...body, avec_inverse: undefined }),
        })
        setTauxList(prev => prev.map(t => t.id === editing.id ? normalise(res.data) : t))
      } else {
        // Create — backend returns { data: { direct, inverse? } }
        const res = await backendRequest<{ data: { direct: TauxRaw; inverse?: TauxRaw } }>("/taux", {
          method: "POST",
          body: JSON.stringify(body),
        })
        const newTaux: Taux[] = [normalise(res.data.direct)]
        if (res.data.inverse) newTaux.push(normalise(res.data.inverse))
        setTauxList(prev => [...newTaux, ...prev])
      }

      closeDialog()
      fetchAll() // Refresh to get latest statuts
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement")
    } finally {
      setIsSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (t: Taux) => {
    const src = t.devise_source_info?.symbole ?? t.devise_source
    const but = t.devise_but_info?.symbole ?? t.devise_but
    if (!confirm(`Supprimer le taux ${src} → ${but} du ${t.date_effet} ?`)) return
    try {
      await backendRequest(`/taux/${t.id}`, { method: "DELETE" })
      setTauxList(prev => prev.filter(x => x.id !== t.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression")
    }
  }

  // ── Toggle statut ──────────────────────────────────────────────────────────

  const toggleStatut = async (t: Taux) => {
    const next = t.statut === "actif" ? "inactif" : "actif"
    try {
      const res = await backendRequest<{ data: TauxRaw }>(`/taux/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ statut: next }),
      })
      setTauxList(prev => prev.map(x => {
        if (x.id === t.id) return normalise(res.data)
        // Backend deactivates siblings when activating
        if (next === "actif" && x.devise_source === t.devise_source && x.devise_but === t.devise_but) {
          return { ...x, statut: "inactif" }
        }
        return x
      }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors du changement de statut")
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Taux de change</h1>
          <p className="text-muted-foreground">
            Gérez les taux de conversion entre devises avec précision.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau taux
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tauxList.length}</div>
            <p className="text-xs text-muted-foreground">taux enregistrés</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tauxList.filter(t => t.statut === "actif").length}
            </div>
            <p className="text-xs text-muted-foreground">taux actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Devises</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devises.length}</div>
            <p className="text-xs text-muted-foreground">devises disponibles</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tauxList.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucun taux de change enregistré.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>Taux direct</TableHead>
                  <TableHead>Taux inverse</TableHead>
                  <TableHead>Date d&apos;effet</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tauxList.map(t => {
                  const src = t.devise_source_info
                  const but = t.devise_but_info
                  const srcLabel = src ? `${src.symbole} (${src.code})` : `#${t.devise_source}`
                  const butLabel = but ? `${but.symbole} (${but.code})` : `#${t.devise_but}`
                  const srcSym = src?.symbole ?? t.devise_source
                  const butSym = but?.symbole ?? t.devise_but

                  return (
                    <TableRow key={t.id}>
                      {/* Direction */}
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <span>{srcLabel}</span>
                          <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{butLabel}</span>
                        </div>
                      </TableCell>

                      {/* Direct rate */}
                      <TableCell>
                        <div className="font-mono text-sm">
                          <span className="text-muted-foreground">1 {srcSym} = </span>
                          <span className="font-semibold text-foreground">{displayRate(t.valeur)}</span>
                          <span className="text-muted-foreground"> {butSym}</span>
                        </div>
                      </TableCell>

                      {/* Inverse rate */}
                      <TableCell>
                        <div className="font-mono text-sm">
                          <span className="text-muted-foreground">1 {butSym} = </span>
                          <span className="font-semibold text-blue-600">
                            {displayRate(t.valeur_inverse)}
                          </span>
                          <span className="text-muted-foreground"> {srcSym}</span>
                        </div>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-muted-foreground">{t.date_effet}</TableCell>

                      {/* Statut badge */}
                      <TableCell>
                        <button
                          onClick={() => toggleStatut(t)}
                          className="cursor-pointer"
                          title={t.statut === "actif" ? "Désactiver" : "Activer"}
                        >
                          <Badge variant={t.statut === "actif" ? "default" : "secondary"}>
                            {t.statut === "actif" ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" />Actif</>
                            ) : (
                              <><XCircle className="h-3 w-3 mr-1" />Inactif</>
                            )}
                          </Badge>
                        </button>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(t)}>
                              <Edit className="mr-2 h-4 w-4" />Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleStatut(t)}>
                              {t.statut === "actif"
                                ? <><XCircle className="mr-2 h-4 w-4" />Désactiver</>
                                : <><CheckCircle2 className="mr-2 h-4 w-4" />Activer</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(t)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog ── */}
      <Dialog open={showDialog} onOpenChange={open => !open && closeDialog()}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le taux" : "Nouveau taux de change"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 space-y-5 pr-1">
            {/* Devise source */}
            <div className="space-y-1">
              <Label htmlFor="devise_source">Devise source (de)</Label>
              <Select
                value={formData.devise_source}
                onValueChange={v => setField("devise_source", v)}
              >
                <SelectTrigger id="devise_source">
                  <SelectValue placeholder="Choisir une devise..." />
                </SelectTrigger>
                <SelectContent>
                  {devises.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.symbole} — {d.nom} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Devise but */}
            <div className="space-y-1">
              <Label htmlFor="devise_but">Devise but (vers)</Label>
              <Select
                value={formData.devise_but}
                onValueChange={v => setField("devise_but", v)}
              >
                <SelectTrigger id="devise_but">
                  <SelectValue placeholder="Choisir une devise..." />
                </SelectTrigger>
                <SelectContent>
                  {devises
                    .filter(d => String(d.id) !== formData.devise_source)
                    .map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.symbole} — {d.nom} ({d.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Taux */}
            <div className="space-y-1">
              <Label htmlFor="valeur">
                Taux
                {srcDevise && butDevise && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    (1 {srcDevise.symbole} = ? {butDevise.symbole})
                  </span>
                )}
              </Label>
              <Input
                id="valeur"
                type="number"
                step="any"
                min="0"
                placeholder="ex: 2400"
                value={formData.valeur}
                onChange={e => setField("valeur", e.target.value)}
              />
            </div>

            {/* Inverse preview */}
            {inversePreview && srcDevise && butDevise && (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Calcul de l&apos;inverse (aperçu)
                </p>
                <div className="font-mono text-sm">
                  <span className="text-muted-foreground">1 {srcDevise.symbole} = </span>
                  <span className="font-bold text-foreground">{formData.valeur}</span>
                  <span className="text-muted-foreground"> {butDevise.symbole}</span>
                </div>
                <div className="font-mono text-sm">
                  <span className="text-muted-foreground">1 {butDevise.symbole} = </span>
                  <span className="font-bold text-blue-600">{inversePreview}</span>
                  <span className="text-muted-foreground"> {srcDevise.symbole}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  La valeur exacte sera calculée côté serveur via BCMath (20 décimales).
                </p>
              </div>
            )}

            {/* Date */}
            <div className="space-y-1">
              <Label htmlFor="date_effet">Date d&apos;effet</Label>
              <Input
                id="date_effet"
                type="date"
                value={formData.date_effet}
                onChange={e => setField("date_effet", e.target.value)}
              />
            </div>

            {/* Statut */}
            <div className="space-y-1">
              <Label htmlFor="statut">Statut</Label>
              <Select
                value={formData.statut}
                onValueChange={v => setField("statut", v as "actif" | "inactif")}
              >
                <SelectTrigger id="statut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inactif">Inactif</SelectItem>
                  <SelectItem value="actif">Actif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Créer aussi le taux inverse */}
            {!editing && (
              <label className="flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer hover:bg-muted/30">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={formData.avec_inverse}
                  onChange={e => setField("avec_inverse", e.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium">
                    Créer aussi le taux inverse automatiquement
                  </p>
                  {srcDevise && butDevise && inversePreview ? (
                    <p className="text-xs text-muted-foreground">
                      Insère également{" "}
                      <span className="font-mono">
                        1 {butDevise.symbole} = {inversePreview} {srcDevise.symbole}
                      </span>
                      {" "}en base de données.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Insère également le taux {butDevise?.symbole ?? "but"} → {srcDevise?.symbole ?? "source"} en base de données.
                    </p>
                  )}
                </div>
              </label>
            )}

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Enregistrer" : formData.avec_inverse ? "Créer les deux taux" : "Créer le taux"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
