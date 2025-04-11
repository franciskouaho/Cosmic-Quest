"use client"

import { useEffect } from "react"
import { Tabs } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useColorScheme } from "react-native"
import Colors from "../../constants/Colors"
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]

  useEffect(() => {
    if (!isLoading && !user?.id) {
      router.replace('/auth/login');
    }
  }, [user?.id, isLoading]);

  // Ne pas rendre les tabs tant que l'utilisateur n'est pas chargé
  if (isLoading || !user?.id) return null;

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.gradient.purple.from
        },
        tabBarStyle: { display: 'none' }
      }}
    >
      <Tabs.Screen 
        name="index"
        options={{
          href: null // Empêcher la navigation directe
        }}
      />
    </Tabs>
  );
}

