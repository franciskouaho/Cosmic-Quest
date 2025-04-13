import { Stack } from 'expo-router';
import { AuthProvider } from "@/contexts/AuthContext";
import { GameProvider } from "@/contexts/GameContext";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupGlobalErrorHandlers } from '../utils/errorHandler';
import { useEffect } from 'react';

// Création d'une instance de QueryClient
const queryClient = new QueryClient();

export default function RootLayout() {
  // Configurer le gestionnaire global d'erreurs
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  return (
    // Envelopper l'application avec QueryClientProvider
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

