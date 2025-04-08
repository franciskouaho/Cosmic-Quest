"use client"

import { useEffect } from "react"
import { View, ActivityIndicator } from "react-native"
import { useRouter } from "expo-router"
import Colors from "../constants/Colors"
import { useColorScheme } from "react-native"
import {useAuth} from "@/contexts/AuthContext";

export default function Index() {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const colorScheme = useColorScheme() ?? "dark"

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
        <View
            style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: Colors[colorScheme].background,
            }}
        >
            <ActivityIndicator size="large" color={Colors[colorScheme].primary} />
        </View>
    )
}

