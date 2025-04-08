import { useColorScheme } from "react-native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useFonts } from "expo-font"
import Colors from "../constants/Colors"
import {AuthProvider} from "@/contexts/AuthContext";
import {SocketProvider} from "@/contexts/SocketContext";
import {GameProvider} from "@/contexts/GameContext";

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? "dark"


  return (
      <AuthProvider>
        <SocketProvider>
          <GameProvider>
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
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="game" options={{ headerShown: false }} />
            </Stack>
          </GameProvider>
        </SocketProvider>
      </AuthProvider>
  )
}

