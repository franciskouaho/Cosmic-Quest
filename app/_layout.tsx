import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack 
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade'
        }}
        initialRouteName="splash"
      >
        <Stack.Screen name="splash" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen 
          name="game/[id]" 
          options={{
            gestureEnabled: false,
          }} 
        />
        <Stack.Screen 
          name="index" 
          options={{
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="room/[id]" 
          options={{
            animation: 'slide_from_right'
          }} 
        />
      </Stack>
    </AuthProvider>
  );
}

