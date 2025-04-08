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
            <View style={styles.inputContainer}>form.OS === "ios" ? "padding" : "height"} style={styles.inputWrapper}>
              <TextInpute={styles.inputContainer}>
                style={styles.inputField}
                placeholder="Francis"Field}
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={username}tColor="rgba(255,255,255,0.6)"
                onChangeText={setUsername}
                autoCapitalize="none"ername}
                autoCorrect={false}one"
                maxLength={15}{false}
              />  maxLength={15}
            </View>
            <TouchableOpacity
              style={[styles.sendButton, { opacity: isLoading || !username.trim() ? 0.7 : 1 }]}
              onPress={handleLogin}Button, { opacity: isLoading || !username.trim() ? 0.7 : 1 }]}
              disabled={isLoading || !username.trim()}
            >   disabled={isLoading || !username.trim()}
              <Feather name="send" color="#ffffff" size={24} />
            </TouchableOpacity>send" color="#ffffff" size={24} />
            {/* Home indicator */}
            <View style={styles.homeIndicator} />
          </KeyboardAvoidingView>}
        </View>ew style={styles.homeIndicator} />
      </LinearGradient>
    </SafeAreaView>
  )   </LinearGradient>
}   </SafeAreaView>
  )
const styles = StyleSheet.create({
  safeArea: {
    flex: 1, = StyleSheet.create({
    backgroundColor: "#1a0933",
  },flex: 1,
  container: {Color: "#1a0933",
    flex: 1,
  },ntainer: {
  statusBarMock: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10, "space-between",
    paddingBottom: 5,: 20,
  },paddingTop: 10,
  timeText: {ttom: 5,
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },fontSize: 16,
  statusIcons: {"bold",
    flexDirection: "row",
    alignItems: "center",
  },flexDirection: "row",
  batteryText: {"center",
    color: "white",
    fontSize: 16,
    marginLeft: 5,,
  },fontSize: 16,
  content: {ft: 5,
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },justifyContent: "space-between",
  logoContainer: {tal: 20,
    alignItems: "center",
    marginTop: 40,
  },alignItems: "center",
  title: {Top: 40,
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
    letterSpacing: 2,",
    fontFamily: Platform.OS === "ios" ? "Futura" : "sans-serif-condensed",
  },letterSpacing: 2,
  subtitle: {y: Platform.OS === "ios" ? "Futura" : "sans-serif-condensed",
    fontSize: 20,
    color: "white",
    opacity: 0.8,
    letterSpacing: 1,
    fontFamily: Platform.OS === "ios" ? "Futura" : "sans-serif-light",
  },letterSpacing: 1,
  charactersContainer: {.OS === "ios" ? "Futura" : "sans-serif-light",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },justifyContent: "center",
  charactersImage: {ter",
    width: "100%",
    height: 400,e: {
  },width: "100%",
  inputBottomContainer: {
    width: "100%",
    alignItems: "center",r: {
  },
  inputWrapper: {
    width: "80%", // Limiter la largeur à 80% de l'écran
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",90%",
    justifyContent: "center",
  },ter",
  inputContainer: { "space-between",
    flex: 1,
    backgroundColor: "rgba(30, 10, 60, 0.8)",r: {
    borderRadius: 8,
    borderWidth: 2,backgroundColor: "rgba(30, 10, 60, 0.8)",
    borderColor: "#6a2fbd",s: 8,
    height: 60,dth: 2,
    marginRight: 10,6a2fbd",
  },
  inputField: {
    flex: 1,
    color: "white",
    fontSize: 18,flex: 1,
    paddingHorizontal: 20,te",
    height: "100%",
    fontFamily: Platform.OS === "ios" ? "Avenir" : "sans-serif",zontal: 20,
  },00%",
  sendButton: {== "ios" ? "Avenir" : "sans-serif",
    backgroundColor: "#8c42f5",
    height: 60,
    width: 60,backgroundColor: "#8c42f5",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,tent: "center",
  },
  homeIndicator: {
    width: 140,
    height: 5,
    backgroundColor: "white",width: 140,
    borderRadius: 3,  height: 5,
    alignSelf: "center",    backgroundColor: "white",
    marginTop: 10,    borderRadius: 3,




})  },    alignSelf: "center",
    marginTop: 10,
  },
})

