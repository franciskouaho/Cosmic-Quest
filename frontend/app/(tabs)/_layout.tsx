"use client"

import React from "react"
import { Tabs } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useColorScheme } from "react-native"
import Colors from "../../constants/Colors"

export default function TabLayout() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]

  // Nous ne redirigeons plus automatiquement ici, car c'est géré dans le splash screen
  // et cela évite les redirections en boucle
  
  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.gradient.purple.frome
        },
        tabBarStyle: { display: 'none' }
      }}
    >
      <Tabs.Screen 
        name="index"
        options={{
          href: isAuthenticated ? undefined : null // Empêcher la navigation directe si non authentifié
        }}
      />
    </Tabs>
  );
}

