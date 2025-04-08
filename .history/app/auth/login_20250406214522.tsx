"use client"

import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  Image,
  StatusBar,
  SafeAreaView,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useAuth } from "@/contexts/AuthContext"
import Colors from "@/constants/Colors"
import { Feather } from "@expo/vector-icons"

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]
  const { signIn } = useAuth()
  const [username, setUsername] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    if (!username.trim()) return

    setIsLoading(true)
    try {
      await signIn(username)
    } catch (error) {
      console.error("Erreur de connexion:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#1a0933", "#2d0f4c", "#3b1366"]}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >

        {/* Main content */}
        <View style={styles.content}>
          {/* Logo and title */}
          <View style={styles.logoContainer}>
            <Text style={styles.title}>INSIGHT</Text>
            <Text style={styles.subtitle}>play with friends</Text>
          </View>

          {/* Characters image placeholder */}
          <View style={styles.charactersContainer}>
            <Image
              source={{ uri: "https://placeholder.svg?height=400&width=400" }}
              style={styles.charactersImage}
              resizeMode="contain"
            />
          </View>

          {/* Input field at bottom */}
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.inputWrapper}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputField}
                placeholder="Francis"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={15}
              />
              <TouchableOpacity
                style={[styles.sendButton, { opacity: isLoading || !username.trim() ? 0.7 : 1 }]}
                onPress={handleLogin}on, { opacity: isLoading || !username.trim() ? 0.7 : 1 }]}
                disabled={isLoading || !username.trim()}
              >isabled={isLoading || !username.trim()}
                <Feather name="send" color="#ffffff" size={24} />
              </TouchableOpacity>" color="#ffffff" size={24} />
            </View>ableOpacity>
            {/* Home indicator */}
            <View style={styles.homeIndicator} />
          </KeyboardAvoidingView>
        </View>
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1a0933",
  },
  container: {
    flex: 1,
  },
  statusBarMock: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  timeText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  statusIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  batteryText: {
    color: "white",
    fontSize: 16,
    marginLeft: 5,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
    letterSpacing: 2,
    fontFamily: Platform.OS === "ios" ? "Futura" : "sans-serif-condensed",
  },
  subtitle: {
    fontSize: 20,
    color: "white",
    opacity: 0.8,
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Futura" : "sans-serif-light",
  },
  charactersContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  charactersImage: {
    width: "100%",
    height: 400,
  },
  inputWrapper: {
    width: "100%",
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputContainer: {
    flex: 1,
    backgroundColor: "rgba(30, 10, 60, 0.8)",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#6a2fbd",
    height: 60,
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    color: "white",
    fontSize: 18,
    paddingHorizontal: 20,
    height: "100%",
    fontFamily: Platform.OS === "ios" ? "Avenir" : "sans-serif",
  },
  sendButton: {
    backgroundColor: "#8c42f5",
    height: 60,
    width: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  homeIndicator: {
    width: 140,
    height: 5,
    backgroundColor: "white",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 10,
  },
})

