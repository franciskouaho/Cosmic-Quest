"use client"

import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, useColorScheme, Animated } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import {useGame} from "@/contexts/GameContext";
import Colors from "@/constants/Colors";

export default function GameResultsScreen() {
    const colorScheme = useColorScheme() ?? "dark"
    const colors = Colors[colorScheme]
    const { players, resetGame } = useGame()
    const router = useRouter()
    
    const [sortedPlayers, setSortedPlayers] = useState([...players].sort((a, b) => b.score - a.score))
    const scrollY = useRef(new Animated.Value(0)).current

    useEffect(() => {
        setSortedPlayers([...players].sort((a, b) => b.score - a.score))
    }, [players])

    const handlePlayAgain = () => {
        resetGame()
        router.push("/game/join")
    }
    
    const handleHome = () => {
        resetGame()
        router.replace("/(tabs)")
    }

    const renderPlayerItem = ({ item, index }) => {
        const isTop3 = index < 3
        
        return (
            <Animated.View
                style={[
                    styles.playerItem,
                    { 
                        backgroundColor: colors.backgroundLighter,
                        transform: [
                            { 
                                scale: scrollY.interpolate({
                                    inputRange: [-1, 0, index * 100, (index + 1) * 100],
                                    outputRange: [1, 1, 1, 0.95],
                                    extrapolate: 'clamp'
                                }) 
                            }
                        ]
                    }
                ]}
            >
                <View style={styles.rankContainer}>
                    {isTop3 ? (
                        <View style={[styles.medalContainer, { backgroundColor: getMedalColor(index) }]}>
                            <Text style={styles.medalText}>{index + 1}</Text>
                        </View>
                    ) : (
                        <Text style={[styles.rankText, { color: colors.textSecondary }]}>{index + 1}</Text>
                    )}
                </View>
                
                <Image source={{ uri: item.avatar }} style={styles.playerAvatar} />
                
                <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, { color: colors.text }]}>{item.username}</Text>
                    <Text style={[styles.playerCountry, { color: colors.textSecondary }]}>{item.country}</Text>
                </View>
                
                <Text style={[styles.scoreText, { color: colors.primary }]}>{item.score} pts</Text>
            </Animated.View>
        )
    }
    
    const getMedalColor = (index) => {
        switch (index) {
            case 0: return "#FFD700" // Gold
            case 1: return "#C0C0C0" // Silver
            case 2: return "#CD7F32" // Bronze
            default: return colors.primary
        }
    }

    return (
        <LinearGradient colors={[colors.gradient.purple.from, colors.gradient.purple.to]} style={styles.container}>
            <View style={styles.header}>
                {/* Animation de confettis supprimée */}
                
                <Text style={[styles.headerTitle, { color: colors.text }]}>Résultats</Text>
                <Text style={[styles.headerSubtitle, { color: colors.text }]}>
                    La partie est terminée ! Voici les résultats :
                </Text>
            </View>

            <Animated.FlatList
                data={sortedPlayers}
                renderItem={renderPlayerItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
            />

            <View style={styles.buttonsContainer}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.backgroundLighter }]}
                    onPress={handleHome}
                >
                    <Feather name="home" size={20} color={colors.text} />
                    <Text style={[styles.buttonText, { color: colors.text }]}>Accueil</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.button, { backgroundColor: colors.secondary }]}
                    onPress={handlePlayAgain}
                >
                    <Feather name="refresh-cw" size={20} color={colors.backgroundDarker} />
                    <Text style={[styles.buttonText, { color: colors.backgroundDarker }]}>Rejouer</Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    confetti: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 200,
        zIndex: 1,
    },
    confettiImage: {
        width: "100%",
        height: "100%",
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 8,
        fontFamily: "Poppins-Bold",
    },
    headerSubtitle: {
        fontSize: 16,
        textAlign: "center",
        opacity: 0.8,
        fontFamily: "Poppins-Regular",
    },
    listContent: {
        padding: 20,
    },
    playerItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    rankContainer: {
        width: 40,
        alignItems: "center",
    },
    rankText: {
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
    medalContainer: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    medalText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
    playerAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 16,
    },
    playerInfo: {
        flex: 1,
    },
    playerName: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
        fontFamily: "Poppins-SemiBold",
    },
    playerCountry: {
        fontSize: 12,
        fontFamily: "Poppins-Regular",
    },
    scoreText: {
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
    buttonsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 20,
        paddingBottom: 40,
    },
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 30,
        paddingVertical: 16,
        paddingHorizontal: 24,
        flex: 0.48,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "bold",
        marginLeft: 8,
        fontFamily: "Poppins-Bold",
    },
})
