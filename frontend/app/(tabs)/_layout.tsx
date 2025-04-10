"use client"

import { useEffect } from "react"
import { Stack } from "expo-router"
import { useColorScheme } from "react-native"
import Colors from "../../constants/Colors"

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]

  return (
    <Stack 
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.gradient.purple.from
        }
      }} 
    />
  )
}

