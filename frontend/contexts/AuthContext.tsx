"use client"

import React, { createContext, useState, useContext, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useRouter } from "expo-router"

// Définition du type User simplifié
type User = {
    username: string;
}

// Contexte d'authentification simplifié
type AuthContextType = {
    user: User | null;
    isLoading: boolean;
    signIn: (username: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    signIn: async () => {},
    signOut: async () => {},
})

// Hook personnalisé pour utiliser le contexte d'auth
export const useAuth = () => useContext(AuthContext)

// Provider pour le contexte d'auth
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    // Charger l'utilisateur depuis le stockage au démarrage
    useEffect(() => {
        const loadUser = async () => {
            try {
                const storedUsername = await AsyncStorage.getItem("@username")
                if (storedUsername) {
                    setUser({ username: storedUsername })
                }
            } catch (error) {
                console.error("Échec du chargement de l'utilisateur", error)
            } finally {
                setIsLoading(false)
            }
        }

        loadUser()
    }, [])

    // Connexion simplifiée
    const signIn = async (username: string) => {
        // Créer un utilisateur avec uniquement le nom d'utilisateur
        const newUser: User = {
            username,
        }

        setUser(newUser)
        await AsyncStorage.setItem("@username", username)
        router.replace("/(tabs)")
    }

    // Déconnexion
    const signOut = async () => {
        setUser(null)
        await AsyncStorage.removeItem("@username")
        router.replace("/auth/login")
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext
