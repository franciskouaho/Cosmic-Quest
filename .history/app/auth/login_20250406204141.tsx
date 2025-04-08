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
            // Utilisons directement le nom d'utilisateur sans vérification backend
            await signIn(username)
        } catch (error) {
            console.error("Login error:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <LinearGradient colors={[colors.gradient.purple.from, colors.gradient.purple.to]} style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <View style={styles.logoContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>SOIRÉE QUIZ</Text>
                    <Text style={[styles.subtitle, { color: colors.text }]}>Entre ton pseudo pour jouer</Text>
                </View>

                <View style={styles.formContainer}>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.backgroundLighter,
                                color: colors.text,
                                borderColor: colors.border,
                            },
                        ]}
                        placeholder="Pseudo"
                        placeholderTextColor={colors.textSecondary}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus={true}
                        maxLength={15}
                    />

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.secondary, opacity: isLoading || !username.trim() ? 0.7 : 1 }]}
                        onPress={handleLogin}
                        disabled={isLoading || !username.trim()}
                    >
                        <Text style={[styles.buttonText, { color: colors.backgroundDarker }]}>
                            {isLoading ? "Chargement..." : "Jouer"}
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
    input: {
        height: 60,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 20,
        fontSize: 18,
        marginBottom: 24,
        fontFamily: "Poppins-Regular",
        textAlign: "center",
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
    },
})

