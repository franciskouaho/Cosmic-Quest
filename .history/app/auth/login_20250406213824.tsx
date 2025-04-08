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
                                styles.input,pseudo"
                                {holderTextColor="rgba(255,255,255,0.6)"
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                    color: colors.tertiary,
                                    borderColor: 'transparent',
                                },rrect={false}
                            ]}toFocus={true}
                            placeholder="Ton pseudo"
                            placeholderTextColor="rgba(255, 255, 255, 0.6)"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}{ backgroundColor: colors.secondary, opacity: isLoading || !username.trim() ? 0.7 : 1 }]}
                            autoFocus={true}}
                            maxLength={15}g || !username.trim()}
                        />
                    </View>xt style={[styles.buttonText, { color: colors.backgroundDarker }]}>
                            {isLoading ? "Chargement..." : "JOUER"}
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.secondary, opacity: isLoading || !username.trim() ? 0.7 : 1 }]}
                        onPress={handleLogin}
                        disabled={isLoading || !username.trim()}
                    >uppression des fonctionnalités supplémentaires */}
                        <Text style={[styles.buttonText, { color: colors.backgroundDarker }]}>
                            {isLoading ? "Chargement..." : "JOUER"}
                        </Text>
                    </TouchableOpacity>
                </View>
                tyleSheet.create({
                <View style={styles.featuresContainer}>
                    <Text style={styles.featuresTitle}>Mode Soirée entre amis</Text>
                    <View style={styles.featureRow}>
                        <View style={styles.featureItem}>
                            <Feather name="check-circle" size={20} color="#6C41EC" />
                            <Text style={styles.featureText}>Questions coquines</Text>
                        </View>",
                        <View style={styles.featureItem}>
                            <Feather name="check-circle" size={20} color="#6C41EC" />
                            <Text style={styles.featureText}>Mode Hot</Text>
                        </View>
                    </View>
                    <View style={styles.featureRow}>
                        <View style={styles.featureItem}>
                            <Feather name="check-circle" size={20} color="#6C41EC" />
                            <Text style={styles.featureText}>Soirées fun</Text>
                        </View>ld",
                        <View style={styles.featureItem}>
                            <Feather name="check-circle" size={20} color="#6C41EC" />
                            <Text style={styles.featureText}>Jeux à boire</Text>
                        </View>
                    </View>s-Regular",
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    ),
}   inputContainer: {
        flexDirection: "row",
const styles = StyleSheet.create({
    container: {ndColor: "rgba(255,255,255,0.1)",
        flex: 1,dius: 16,
    },  paddingHorizontal: 16,
    content: {Bottom: 20,
        flex: 1,
        padding: 24,
        justifyContent: "center",
    },
    logoContainer: {
        alignItems: "center",
        marginBottom: 40,
    },  borderWidth: 1,
    title: {ingHorizontal: 20,
        fontSize: 42,
        fontWeight: "bold",
        letterSpacing: 2,ins-Regular",
        fontFamily: "Poppins-Bold",
    },
    subtitle: {
        fontSize: 18,al: 16,
        opacity: 0.8, 30,
        fontFamily: "Poppins-Regular",
    },
    formContainer: {
        width: "100%",
    },  fontWeight: "bold",
    inputContainer: {Poppins-Bold",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 16,        paddingHorizontal: 16,        marginBottom: 20,        height: 60,    },    inputIcon: {        marginRight: 12,    },    inputField: {        flex: 1,        fontSize: 18,        height: '100%',        fontFamily: "Poppins-Regular",    },    button: {        paddingVertical: 16,        borderRadius: 30,        alignItems: "center",    },    buttonText: {        fontSize: 18,        fontWeight: "bold",        fontFamily: "Poppins-Bold",    },    featuresContainer: {        alignItems: "center",    },    featuresTitle: {        fontSize: 18,        fontWeight: "bold",        color: "white",        marginBottom: 16,    },    featureRow: {        flexDirection: "row",        justifyContent: "space-between",        width: "100%",        marginBottom: 12,    },    featureItem: {        flexDirection: "row",        alignItems: "center",        width: "48%",    },    featureText: {        marginLeft: 8,        color: "rgba(255,255,255,0.8)",        fontSize: 16,    }})