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
        <LinearGradient 
            colors={[colors.gradient.purple.from, colors.gradient.purple.to]}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <View style={styles.logoContainer}>
                    <Text style={[styles.title, { color: colors.tertiary }]}>COSMIC QUEST</Text>
                    <Text style={[styles.subtitle, { color: colors.tertiary }]}>Entre ton pseudo pour jouer</Text>
                </View>

                <View style={styles.formContainer}>
                    <View style={styles.inputContainer}>
                        <Feather name="user" size={20} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                        <TextInput
                            style={[styles.inputField, { color: colors.tertiary }]}
                            placeholder="Ton pseudo"
                            placeholderTextColor="rgba(255,255,255,0.6)"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus={true}
                            maxLength={15}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.secondary, opacity: isLoading || !username.trim() ? 0.7 : 1 }]}
                        onPress={handleLogin}
                        disabled={isLoading || !username.trim()}
                    >
                        <Text style={[styles.buttonText, { color: colors.backgroundDarker }]}>
                            {isLoading ? "Chargement..." : "JOUER"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: "center",
    },
    logoContainer: {
        alignItems: "center",
        marginBottom: 40,
    },
    title: {
        fontSize: 42,
        fontWeight: "bold",
        letterSpacing: 2,
        fontFamily: "Poppins-Bold",
    },
    subtitle: {
        fontSize: 18,
        opacity: 0.8,
        fontFamily: "Poppins-Regular",
    },
    formContainer: {
        width: "100%",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 20,
        height: 60,
    },
    inputIcon: {
        marginRight: 12,
    },
    inputField: {
        flex: 1,
        fontSize: 18,
        height: '100%',
        fontFamily: "Poppins-Regular",
    },
    button: {
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: "center",
    },
    buttonText: {
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    }
})