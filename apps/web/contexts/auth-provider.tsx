"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { signInApi, signUpApi } from "@/services/auth"
import {
  clearSession,
  getUserId,
  hasSession,
  saveSession,
} from "@/lib/auth/session"
import { useRouter } from "next/navigation"

type AuthContextValue = {
  isLoggedIn: boolean
  userId: string | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (username: string, email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [auth, setAuth] = useState(() => {
    return {
      isLoggedIn: hasSession(),
      userId: getUserId(),
      isLoading: false,
    }
  })

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await signInApi(email, password)
      saveSession(data.token, data.user.id)
      setAuth({ isLoggedIn: true, userId: data.user.id, isLoading: false })
      router.push("/")
    },
    [router]
  )

  const signUp = useCallback(
    async (username: string, email: string, password: string) => {
      const data = await signUpApi(username, email, password)
      saveSession(data.token, data.user.id)
      setAuth({ isLoggedIn: true, userId: data.user.id, isLoading: false })
      router.push("/")
    },
    [router]
  )

  const signOut = () => {
    clearSession()
    setAuth({ isLoggedIn: false, userId: null, isLoading: false })
  }

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: auth.isLoggedIn,
        userId: auth.userId,
        isLoading: auth.isLoading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
