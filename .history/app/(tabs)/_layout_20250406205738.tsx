"use client"

import { useEffect } from "react"
import { Stack } from "expo-router"
import { useColorScheme } from "react-native"
import Colors from "../../constants/Colors"
import { useSocket } from "../../contexts/SocketContext"

export default function TabLayout() {
    const colorScheme = useColorScheme() ?? "dark"
    const { connect } = useSocket()

    useEffect(() => {
        // Connect to socket when tabs load
        connect()
    }, [])

    return <Stack screenOptions={{ headerShown: false }} />
}

