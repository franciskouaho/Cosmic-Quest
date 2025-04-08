import React from "react"
import { TouchableOpacity, Text, Image, StyleSheet, ImageSourcePropType, useColorScheme } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Colors from "../../constants/Colors"

interface GameCategoryCardProps {
    title: string
    image: ImageSourcePropType
    gradientColors: string[]
    onPress: () => void
}

const GameCategoryCard = ({ title, image, gradientColors, onPress }: GameCategoryCardProps) => {
    const colorScheme = useColorScheme() ?? "dark"
    const colors = Colors[colorScheme]

    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
            <LinearGradient colors={gradientColors} style={styles.gradient}>
                <Image source={image} style={styles.image} resizeMode="contain" />
                <Text style={styles.title}>{title}</Text>
            </LinearGradient>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    container: {
        width: "48%",
        marginBottom: 16,
        borderRadius: 16,
        overflow: "hidden",
    },
    gradient: {
        padding: 16,
        height: 140,
        justifyContent: "space-between",
    },
    image: {
        width: "100%",
        height: 60,
    },
    title: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
        fontFamily: "Poppins-SemiBold",
    },
})

export default GameCategoryCard
