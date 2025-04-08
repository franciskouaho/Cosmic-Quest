"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useAuth } from "@/contexts/AuthContext"
import Colors from "@/constants/Colors"

export default function HomeScreen() {
    const colorScheme = useColorScheme() ?? "dark"
    const colors = Colors[colorScheme]
    const { user } = useAuth()
    const router = useRouter()

    const handleJoinGame = () => {
        router.push("/game/join")
    }

    const handleCreateGame = () => {
        router.push("/game/create")
    }

    return (
        <ScrollView 
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
        >
            <View style={styles.header}>
                <Text style={[styles.greeting, { color: colors.text }]}>Bonjour, {user?.username} 👋</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Prêt à jouer ?</Text>
            </View>

            <View style={styles.buttonsContainer}>
                <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.primary }]} 
                    onPress={handleJoinGame}
                >
                    <Feather name="users" size={24} color={colors.text} style={styles.buttonIcon} />
                    <View>
                        <Text style={[styles.buttonTitle, { color: colors.text }]}>Rejoindre une partie</Text>
                        <Text style={[styles.buttonSubtitle, { color: colors.text }]}>Entrez un code de partie</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.secondary }]} 
                    onPress={handleCreateGame}
                >
                    <Feather name="plus-circle" size={24} color={colors.backgroundDarker} style={styles.buttonIcon} />
                    <View>
                        <Text style={[styles.buttonTitle, { color: colors.backgroundDarker }]}>Créer une partie</Text>
                        <Text style={[styles.buttonSubtitle, { color: colors.backgroundDarker }]}>Invitez vos amis</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        padding: 24,
    },
    header: {
        marginTop: 60,
        marginBottom: 40,
    },
    greeting: {
        fontSize: 28,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        fontFamily: "Poppins-Regular",
    },
    buttonsContainer: {
        gap: 20,
    },
    button: {
        padding: 24,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
    },
    buttonIcon: {
        marginRight: 16,
    },
    buttonTitle: {
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
        marginBottom: 4,
    },
    buttonSubtitle: {
        fontSize: 14,
        opacity: 0.8,
        fontFamily: "Poppins-Regular",
    },
})

