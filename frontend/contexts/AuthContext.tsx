"use client"

import React, { createContext, useContext } from "react"
import { useUser, useLogin, useLogout } from '@/hooks/useAuth'

export const AuthContext = createContext<any>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data: user, isLoading } = useUser()
    const loginMutation = useLogin()
    const logoutMutation = useLogout()

    const signIn = async (username: string) => {
        return loginMutation.mutateAsync(username)
    }

    const signOut = async () => {
        return logoutMutation.mutateAsync()
    }

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            signIn,
            signOut,
            isSigningIn: loginMutation.isPending,
            isSigningOut: logoutMutation.isPending,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

// Renommer en useAuth pour la cohérence
export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// Ne plus exporter useAuthContext
export { AuthContext, AuthProvider }
