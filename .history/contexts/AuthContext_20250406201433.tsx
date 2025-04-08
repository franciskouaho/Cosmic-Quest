"use client"

import { createContext, useContext, useState, type ReactNode, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { router } from "expo-router"

interface User {
    id: string
    username: string
    avatar: string
    level: number
    xp: number
    country: string
}

interface AuthContextType {
    user: User | null
    isLoading: boolean
    signIn: (username: string) => Promise<void>
    signOut: () => Promise<void>
    updateUser: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}

interface AuthProviderProps {
    children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Load user from AsyncStorage on app start
        const loadUser = async () => {
            try {
                const userJson = await AsyncStorage.getItem("@user")
                if (userJson) {
                    setUser(JSON.parse(userJson))
                }
            } catch (error) {
                console.error("Failed to load user from storage", error)
            } finally {
                setIsLoading(false)
            }
        }

        loadUser()
    }, [])

    const signIn = async (username: string) => {
        // In a real app, you would validate with a backend
        // For now, we'll create a mock user
        const newUser: User = {
            id: Math.random().toString(36).substring(2, 9),
            username,
            avatar: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${username}`,
            level: 1,
            xp: 0,
            country: "FR", // Default country
        }

        setUser(newUser)
        await AsyncStorage.setItem("@user", JSON.stringify(newUser))
        router.replace("/(tabs)")
    }

    const signOut = async () => {
        setUser(null)
        await AsyncStorage.removeItem("@user")
        router.replace("/auth/login")
    }

    const updateUser = async (data: Partial<User>) => {
        if (!user) return

        const updatedUser = { ...user, ...data }
        setUser(updatedUser)
        await AsyncStorage.setItem("@user", JSON.stringify(updatedUser))
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signOut, updateUser }}>{children}</AuthContext.Provider>
    )
}

export default AuthContext

