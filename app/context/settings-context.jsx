"use client"

import { createContext, useContext, useState, useEffect } from "react"

/**
 * @typedef {Object} AppSettings
 * @property {boolean} quickActionsEnabled
 * @property {boolean} clientPageEnabled
 * @property {boolean} soundEnabled
 * @property {number} autoLogout
 * @property {string} currency
 * @property {string} currencySymbol
 * @property {number} taxRate
 */

/**
 * @typedef {Object} SettingsContextValue
 * @property {AppSettings} settings
 * @property {(key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => void} updateSetting
 * @property {() => void} toggleQuickActions
 * @property {() => void} toggleClientPage
 * @property {() => void} toggleSound
 */

/** @type {React.Context<SettingsContextValue | null>} */
const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  /** @type {[AppSettings, React.Dispatch<React.SetStateAction<AppSettings>>]} */
  const [settings, setSettings] = useState({
    quickActionsEnabled: true,
    clientPageEnabled: true,
    soundEnabled: true,
    autoLogout: 30, // minutes
    currency: "USD",
    currencySymbol: "$",
    taxRate: 10, // percentage
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedSettings = localStorage.getItem("pos_settings")
    if (savedSettings) {
      try {
        setSettings((prev) => ({ ...prev, ...JSON.parse(savedSettings) }))
      } catch (error) {
        console.error("Failed to parse settings:", error)
      }
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("pos_settings", JSON.stringify(settings))
    }
  }, [settings, mounted])

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const toggleQuickActions = () => {
    setSettings((prev) => ({
      ...prev,
      quickActionsEnabled: !prev.quickActionsEnabled,
    }))
  }

  const toggleClientPage = () => {
    setSettings((prev) => ({
      ...prev,
      clientPageEnabled: !prev.clientPageEnabled,
    }))
  }

  const toggleSound = () => {
    setSettings((prev) => ({
      ...prev,
      soundEnabled: !prev.soundEnabled,
    }))
  }

  if (!mounted) {
    return null
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        toggleQuickActions,
        toggleClientPage,
        toggleSound,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
