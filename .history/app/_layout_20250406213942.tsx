import { useColorScheme } from "react-native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useFonts } from "expo-font"
import Colors from "../constants/Colors"
import {AuthProvider} from "@/contexts/AuthContext";

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? "dark"


  return (
      <AuthProvider>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: Colors[colorScheme].background,
                  },
                  animation: "slide_from_right",
                }}
            >
            </Stack>
      </AuthProvider>
  )
}

