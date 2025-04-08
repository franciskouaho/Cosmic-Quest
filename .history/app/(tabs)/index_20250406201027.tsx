"use client"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, useColorScheme } from "react-native"
import { useAuth } from "../../contexts/AuthContext"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import Colors from "../../constants/Colors"
import GameCategoryCard from "../../components/game/GameCategoryCard"

export default function HomeScreen() {
    const colorScheme = useColorScheme() ?? "dark"
    const colors = Colors[colorScheme]
    const { user } = useAuth()
    const router = useRouter()

    const handleJoinGame = () => {
        router.push("/game/join")
    }

    const recentGames = [
        {
            id: "1",
            title: "Breaking Bad",
            image: require("../../assets/images/categories/breaking-bad.png"),
            progress: 30,
        },
        {
            id: "2",
            title: "Guess the Logo",
            image: require("../../assets/images/categories/logos.png"),
            progress: 65,
        },
        {
            id: "3",
            title: "Name the Flag",
            image: require("../../assets/images/categories/flags.png"),
            progress: 20,
        },
    ]

    const gameCategories = [
        {
            id: "1",
            title: "Culture Générale",
            image: require("../../assets/images/categories/general.png"),
            gradient: ["#28AF6E", "#39C988"],
        },
        {
            id: "2",
            title: "Saint-Valentin",
            image: require("../../assets/images/categories/valentine.png"),
            gradient: ["#7D04FC", "#891CFC"],
        },
    ]

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <View>
                    <Text style={[styles.greeting, { color: colors.text }]}>Hello, {user?.username} 👋</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Let's play quiz</Text>
                </View>
                <View style={styles.profileContainer}>
                    <Image source={{ uri: user?.avatar }} style={styles.avatar} />
                    <View style={styles.notificationBadge}>
                        <Text style={styles.notificationText}>2</Text>
                    </View>
                </View>
            </View>

            <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.backgroundLighter }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rank</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>892</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.backgroundLighter }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Level</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{user?.level || 1}</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.backgroundLighter }]}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>XP</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{user?.xp || 0}</Text>
                </View>
            </View>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Plays</Text>
                    <TouchableOpacity>
                        <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentGamesScroll}>
                    {recentGames.map((game) => (
                        <TouchableOpacity
                            key={game.id}
                            style={[styles.recentGameCard, { backgroundColor: colors.backgroundLighter }]}
                        >
                            <Image source={game.image} style={styles.recentGameImage} />
                            <Text style={[styles.recentGameTitle, { color: colors.text }]}>{game.title}</Text>
                            <View style={styles.progressContainer}>
                                <View style={[styles.progressBar, { backgroundColor: colors.backgroundDarker, width: "100%" }]}>
                                    <View
                                        style={[styles.progressFill, { backgroundColor: colors.primary, width: `${game.progress}%` }]}
                                    />
                                </View>
                                <Text style={[styles.progressText, { color: colors.textSecondary }]}>{game.progress}%</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <TouchableOpacity style={[styles.joinRoomButton, { backgroundColor: colors.primary }]} onPress={handleJoinGame}>
                <Text style={[styles.joinRoomText, { color: colors.text }]}>Create and join room here</Text>
                <Text style={[styles.joinRoomSubtext, { color: colors.text }]}>Join a room quickly with friends</Text>
                <View style={styles.joinButtonIcon}>
                    <Feather name="share-2" size={24} color={colors.text} />
                </View>
            </TouchableOpacity>

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Start playing</Text>
                <View style={styles.categoriesGrid}>
                    {gameCategories.map((category) => (
                        <GameCategoryCard
                            key={category.id}
                            title={category.title}
                            image={category.image}
                            gradientColors={category.gradient}
                            onPress={() => router.push("/game/create")}
                        />
                    ))}
                </View>
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 80,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    greeting: {
        fontSize: 22,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
    subtitle: {
        fontSize: 16,
        marginTop: 4,
        fontFamily: "Poppins-Regular",
    },
    profileContainer: {
        position: "relative",
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    notificationBadge: {
        position: "absolute",
        top: -5,
        right: -5,
        backgroundColor: "#FF5757",
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    notificationText: {
        color: "white",
        fontSize: 12,
        fontWeight: "bold",
    },
    statsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 4,
        alignItems: "center",
    },
    statLabel: {
        fontSize: 14,
        marginBottom: 4,
        fontFamily: "Poppins-Regular",
    },
    statValue: {
        fontSize: 24,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: "Poppins-SemiBold",
    },
    viewAll: {
        fontSize: 14,
        fontFamily: "Poppins-Medium",
    },
    recentGamesScroll: {
        marginLeft: -8,
    },
    recentGameCard: {
        width: 120,
        borderRadius: 12,
        padding: 12,
        marginLeft: 8,
    },
    recentGameImage: {
        width: "100%",
        height: 60,
        borderRadius: 8,
        marginBottom: 8,
    },
    recentGameTitle: {
        fontSize: 14,
        fontWeight: "500",
        marginBottom: 8,
        fontFamily: "Poppins-Medium",
    },
    progressContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
        flex: 1,
        marginRight: 8,
    },
    progressFill: {
        height: "100%",
        borderRadius: 2,
    },
    progressText: {
        fontSize: 12,
        fontFamily: "Poppins-Regular",
    },
    joinRoomButton: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        position: "relative",
    },
    joinRoomText: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 4,
        fontFamily: "Poppins-Bold",
    },
    joinRoomSubtext: {
        fontSize: 14,
        opacity: 0.8,
        fontFamily: "Poppins-Regular",
    },
    joinButtonIcon: {
        position: "absolute",
        right: 16,
        top: "50%",
        marginTop: -12,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    categoriesGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginTop: 8,
    },
})

