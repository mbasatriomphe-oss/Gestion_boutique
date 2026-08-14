"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { backendRequest, clearStoredSession, getStoredToken, setStoredSession } from "../services/backend"

const AuthContext = createContext(undefined)

function normalizeUser(user) {
  if (!user) {
    return null
  }

  const fullName = [user.nom, user.post_nom, user.prenom].filter(Boolean).join(" ").trim()

  return {
    id: String(user.id),
    username: user.email,
    role: user.role ?? "user",
    name: fullName || user.email,
    email: user.email,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem("pos_user")
    const savedToken = getStoredToken()

    // Restore user from localStorage immediately — no waiting for network
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        setUser(parsedUser)

        // Vendeurs n'ont pas de token Sanctum : session locale suffisante
        if (parsedUser.role === "vendeur" || !savedToken) {
          setIsLoading(false)
          return
        }

        // Validate token in background — won't block the UI
        backendRequest("/user", {}, savedToken)
          .then((response) => {
            const currentUser = normalizeUser(response)
            if (currentUser) {
              setUser(currentUser)
              localStorage.setItem("pos_user", JSON.stringify(currentUser))
            } else {
              clearStoredSession()
              setUser(null)
            }
          })
          .catch(() => {
            clearStoredSession()
            setUser(null)
          })
          .finally(() => {
            setIsLoading(false)
          })

        return
      } catch (error) {
        console.error("Failed to parse user from localStorage:", error)
        clearStoredSession()
      }
    }

    // No saved user — check token only
    if (!savedToken) {
      setIsLoading(false)
      return
    }

    backendRequest("/user", {}, savedToken)
      .then((response) => {
        const currentUser = normalizeUser(response)
        if (currentUser) {
          setUser(currentUser)
          localStorage.setItem("pos_user", JSON.stringify(currentUser))
        } else {
          clearStoredSession()
          setUser(null)
        }
      })
      .catch(() => {
        clearStoredSession()
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Redirect logic based on auth state
  useEffect(() => {
    if (isLoading) return

    const isLoginPage = pathname === "/login"
    const isAdminRoute = pathname?.startsWith("/admin")
    // Helper to avoid pushing the same route repeatedly which can create
    // navigation loops when Fast Refresh/HMR restores state.
    const navigateIfDifferent = (target) => {
      if (!target) return
      if (pathname === target) return
      // prefer replace to avoid growing history during automatic redirects
      try {
        router.replace(target)
      } catch {
        router.push(target)
      }
    }

    if (!user && !isLoginPage) {
      navigateIfDifferent("/login")
    } else if (user && isLoginPage) {
      navigateIfDifferent(user.role === "admin" ? "/admin" : "/")
    } else if (user && user.role === "admin" && !isAdminRoute) {
      navigateIfDifferent("/admin")
    } else if (user && user.role === "admin" && pathname === "/checkout") {
      navigateIfDifferent("/admin")
    } else if (user && isAdminRoute && user.role !== "admin") {
      navigateIfDifferent("/access-denied")
    }
  }, [user, isLoading, pathname, router])

  const login = async (email, password, isVendeur = false) => {
    try {
      if (isVendeur) {
        // Connexion vendeur : email + password
        const response = await backendRequest("/login-vendeur", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })

        const vendeurData = response.user
        if (!vendeurData) {
          return { success: false, error: "Réponse vendeur incomplète" }
        }

        const currentUser = normalizeUser(vendeurData)
        setUser(currentUser)
        if (response.token) {
          setStoredSession(response.token, currentUser)
        } else {
          localStorage.removeItem("pos_token")
          localStorage.setItem("pos_user", JSON.stringify(currentUser))
        }
        return { success: true, user: currentUser }
      }

      const response = await backendRequest("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })

      const currentUser = normalizeUser(response.user)

      if (!response.token || !currentUser) {
        return { success: false, error: "Backend login response is incomplete" }
      }

      setUser(currentUser)
      setStoredSession(response.token, currentUser)
      return { success: true, user: currentUser }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Impossible de se connecter au backend",
      }
    }
  }

  const logout = async () => {
    try {
      await backendRequest("/logout", {
        method: "POST",
      })
    } catch {
      // Ignore logout failures and clear local session anyway.
    } finally {
      clearStoredSession()
      setUser(null)
      router.push("/login")
    }
  }

  const isAdmin = () => {
    return user?.role === "admin"
  }

  const isSeller = () => {
    return user?.role === "vendeur"
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAdmin,
        isSeller,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
