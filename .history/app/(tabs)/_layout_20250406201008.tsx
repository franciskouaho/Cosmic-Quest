"use client"

import { useEffect } from "react"
import { Tabs } from "expo-router"
import { useColorScheme } from "react-native"
import Colors from "../../constants/Colors"
import { Feather } from "@expo/vector-icons"
import { useSocket } from "../../contexts/SocketContext"

export default function TabLayout() {
    const colorScheme = useColorScheme() ?? "dark"
    const { connect } = useSocket()

    useEffect(() => {
        // Connect to socket when tabs load
        connect()
    }, [])

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme].primary,
                tabBarInactiveTintColor: Colors[colorScheme].textSecondary,
                tabBarStyle: {
                    backgroundColor: Colors[colorScheme].backgroundDarker,
                    borderTopWidth: 0,
                    elevation: 0,
                    height: 60,
                    paddingBottom: 10,
                },
                headerStyle: {
                    backgroundColor: Colors[colorScheme].backgroundDarker,
                },
                headerTintColor: Colors[colorScheme].text,
                headerTitleStyle: {
                    fontFamily: "Poppins-SemiBold",
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "Accueil",
                    tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="categories"
                options={{
                    title: "Catégories",
                    tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="leaderboard"
                options={{
                    title: "Classement",
                    tabBarIcon: ({ color, size }) => <Feather name="award" size={size} color={color} />,
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profil",
                    tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
                    headerShown: false,
                }}
            />
        </Tabs>
    )
}

