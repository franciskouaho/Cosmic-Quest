"use client"

import { useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useGame } from "../../contexts/GameContext"
import Colors from "../../constants/Colors"
import Slider from "@react-native-community/slider"

export default function CreateGameScreen() {
    const colorScheme = useColorScheme() ?? "dark"
    const colors = Colors[colorScheme]
    const router = useRouter()
    const { createRoom } = useGame()

    const [selectedMode, setSelectedMode] = useState("INSIGHT")
    const [rounds, setRounds] = useState(10)
    const [timePerQuestion, setTimePerQuestion] = useState(30)

    const gameModes = [
        { id: "INSIGHT", name: "Culture Générale", icon: "book" },
        { id: "VALENTINE", name: "Saint-Valentin", icon: "heart" },
        { id: "HOT", name: "Hot 🔥", icon: "thermometer" },
        { id: "CUSTOM", name: "Questions Personnalisées", icon: "edit-2" },
    ]

    const handleCreateRoom = () => {
        createRoom(selectedMode, rounds, timePerQuestion)
    }

    return (
        <LinearGradient colors={[colors.gradient.purple.from, colors.gradient.purple.to]} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Créer une partie</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Mode de jeu</Text>
                <View style={styles.gameModeContainer}>
                    {gameModes.map((mode) => (
                        <TouchableOpacity
                            key={mode.id}
                            style={[
                                styles.gameModeButton,
                                {
                                    backgroundColor: selectedMode === mode.id ? colors.secondary : colors.backgroundLighter,
                                    borderColor: selectedMode === mode.id ? colors.secondary : "transparent",
                                },
                            ]}
                            onPress={() => setSelectedMode(mode.id)}
                        >
                            <Feather
                                name={mode.icon}
                                size={24}
                                color={selectedMode === mode.id ? colors.backgroundDarker : colors.text}
                            />
                            <Text
                                style={[
                                    styles.gameModeText,
                                    { color: selectedMode === mode.id ? colors.backgroundDarker : colors.text },
                                ]}
                            >
                                {mode.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Paramètres</Text>

                <View style={[styles.settingContainer, { backgroundColor: colors.backgroundLighter }]}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>Nombre de rounds: {rounds}</Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={5}
                        maximumValue={20}
                        step={1}
                        value={rounds}
                        onValueChange={setRounds}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.secondary}
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>5</Text>
                        <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>20</Text>
                    </View>
                </View>

                <View style={[styles.settingContainer, { backgroundColor: colors.backgroundLighter }]}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                        Temps par question: {timePerQuestion}s
                    </Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={10}
                        maximumValue={60}
                        step={5}
                        value={timePerQuestion}
                        onValueChange={setTimePerQuestion}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={colors.secondary}
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>10s</Text>
                        <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>60s</Text>
                    </View>
                </View>

                <View style={[styles.infoContainer, { backgroundColor: colors.primary }]}>
                    <Feather name="info" size={20} color={colors.text} style={styles.infoIcon} />
                    <Text style={[styles.infoText, { color: colors.text }]}>
                        Vous allez créer une partie que vos amis pourront rejoindre avec un code unique.
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: colors.secondary }]}
                    onPress={handleCreateRoom}
                >
                    <Text style={[styles.createButtonText, { color: colors.backgroundDarker }]}>Créer la partie</Text>
                </TouchableOpacity>
            </ScrollView>
        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 16,
        fontFamily: "Poppins-SemiBold",
    },
    gameModeContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    gameModeButton: {
        width: "48%",
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 2,
    },
    gameModeText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: "500",
        fontFamily: "Poppins-Medium",
    },
    settingContainer: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: "500",
        marginBottom: 12,
        fontFamily: "Poppins-Medium",
    },
    slider: {
        width: "100%",
        height: 40,
    },
    sliderLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    sliderLabel: {
        fontSize: 12,
        fontFamily: "Poppins-Regular",
    },
    infoContainer: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 16,
        marginVertical: 16,
    },
    infoIcon: {
        marginRight: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        fontFamily: "Poppins-Regular",
    },
    createButton: {
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
        marginBottom: 40,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
})
