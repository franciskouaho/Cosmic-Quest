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
  Image,
  StatusBar,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useLogin } from "@/hooks/useAuth"
import { Feather } from "@expo/vector-icons"

export default function LoginScreen() {
  const { mutate: signIn, isPending: isSigningIn } = useLogin()
  const [username, setUsername] = useState("")

  const handleLogin = async () => {
    if (!username.trim() || isSigningIn) return

    try {
      signIn(username.trim())
    } catch (error: any) {
      console.error('❌ Login échoué:', error)
      Alert.alert(
        "Erreur de connexion",
        error?.response?.data?.error || "Une erreur est survenue lors de la connexion."
      )
    }
  }

  const isButtonDisabled = isSigningIn || !username.trim()

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#1a0933", "#321a5e"]}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.title}>Cosmic Quest</Text>
          <Text style={styles.subtitle}>play with friends</Text>
        </View>

        {/*<View style={styles.charactersContainer}>
          <Image
            source={require("@/assets/images/characters.png")}
            style={styles.charactersImage}
            resizeMode="contain"
          />
        </View>*/}

        <View style={styles.inputBottomContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={styles.inputWrapper}
          >
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputField}
                placeholder="Entrez votre pseudo"
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={15}
                editable={!isSigningIn}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, { opacity: isButtonDisabled ? 0.7 : 1 }]}
              onPress={handleLogin}
              disabled={isButtonDisabled}
            >
              {isSigningIn ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Feather name="send" color="#ffffff" size={24} />
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
          <View style={styles.homeIndicator} />
        </View>
      </View>
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
    fontSize: 32,
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
  inputBottomContainer: {
    width: "100%",
    alignItems: "center",
  },
  inputWrapper: {
    width: "90%", // Ajusté à 90% pour être un peu plus large
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

