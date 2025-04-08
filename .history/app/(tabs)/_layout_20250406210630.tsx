"use client"

import { useEffect } from "react"
import { Stack } from "expo-router"
import { useColorScheme } from "react-native"
import Colors from "../../constants/Colors"

export default function TabLayout() {

    return <Stack screenOptions={{ headerShown: false }} />
}

