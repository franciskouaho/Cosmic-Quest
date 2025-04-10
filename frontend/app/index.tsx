"use client"

import { useEffect } from "react"
import { View, ActivityIndicator, StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "@/contexts/AuthContext"
import { LinearGradient } from "expo-linear-gradient"

export default function Index() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    
    useEffect(() => {
        if (!isLoading) {
            if (user) {
                router.replace("/(tabs)")
            } else {
                router.replace("/auth/login")
            }
        }
    }, [isLoading, user])

    return (
        <LinearGradient
            colors={["#1A0938", "#2D1155"]}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <ActivityIndicator size="large" color="#FFFFFF" />
        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
})
