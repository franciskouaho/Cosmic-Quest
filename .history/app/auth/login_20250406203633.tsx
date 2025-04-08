"use client"

import { useState } from "react"
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Image,
    KeyboardAvoidingView,
    Platform,
    useColorScheme,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import {useAuth} from "@/contexts/AuthContext";
import Colors from "@/constants/Colors";

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
            console.error("Login error:", error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <LinearGradient colors={[colors.gradient.purple.from, colors.gradient.purple.to]} style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
                <View style={styles.logoContainer}>
                    {/*<Image source={require("../../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />*/}
                    <Text style={[styles.title, { color: colors.text }]}>INSIGHT</Text>
                    <Text style={[styles.subtitle, { color: colors.text }]}>play with friends</Text>
                </View>

                <View style={styles.formContainer}>
                    <Text style={[styles.label, { color: colors.text }]}>Choisissez un pseudo</Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.backgroundLighter,
                                color: colors.text,
                                borderColor: colors.border,
                            },
                        ]}
                        placeholder="Votre pseudo"
                        placeholderTextColor={colors.textSecondary}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.secondary, opacity: isLoading ? 0.7 : 1 }]}
                        onPress={handleLogin}
                        disabled={isLoading || !username.trim()}
                    >
                        <Text style={[styles.buttonText, { color: colors.backgroundDarker }]}>
                            {isLoading ? "Chargement..." : "Continuer"}
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
        marginBottom: 60,
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 16,
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
    label: {
        fontSize: 16,
        marginBottom: 8,
        fontFamily: "Poppins-Medium",
    },
    input: {
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 24,
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
    },
})

