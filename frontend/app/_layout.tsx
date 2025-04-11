import { Stack } from "expo-router";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from "@/contexts/AuthContext";
import { GameProvider } from "@/contexts/GameContext";
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GameProvider>
            <Stack 
              screenOptions={{ headerShown: false }}
              initialRouteName="splash"
            >
              <Stack.Screen name="splash" options={{ gestureEnabled: false }} />
              <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
              <Stack.Screen name="auth" options={{ gestureEnabled: false }} />
            </Stack>
          </GameProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

