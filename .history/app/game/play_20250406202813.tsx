"use client"

import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Image, useColorScheme, Animated } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useGame } from "../../contexts/GameContext"
import { useRouter } from "expo-router"
import Colors from "../../constants/Colors"

export default function GamePlayScreen() {
    const colorScheme = useColorScheme() ?? "dark"
    const colors = Colors[colorScheme]
    const { room, currentQuestion, timeLeft, userAnswered, submitAnswer } = useGame()
    const router = useRouter()
    
    const [selectedOption, setSelectedOption] = useState<string | null>(null)
    const [animation] = useState(new Animated.Value(0))
    const [timeAnimation] = useState(new Animated.Value(1))

    useEffect(() => {
        if (currentQuestion) {
            setSelectedOption(null)
            // Reset and start animation for new question
            animation.setValue(0)
            Animated.timing(animation, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start()
        }
    }, [currentQuestion])

    useEffect(() => {
        // Reset time animation when new question appears
        if (currentQuestion && timeLeft === currentQuestion.timeLimit) {
            timeAnimation.setValue(1)
        }
        
        // Animate time bar
        Animated.timing(timeAnimation, {
            toValue: timeLeft / (currentQuestion?.timeLimit || 30),
            duration: 1000,
            useNativeDriver: false,
        }).start()
    }, [timeLeft, currentQuestion])

    const handleSelectOption = (optionId: string) => {
        if (!userAnswered) {
            setSelectedOption(optionId)
            submitAnswer(currentQuestion!.id, optionId)
        }
    }

    if (!currentQuestion) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.loadingText, { color: colors.text }]}>Chargement de la question...</Text>
            </View>
        )
    }

    const getOptionStyle = (optionId: string) => {
        if (!selectedOption) return {}
        
        if (selectedOption === optionId) {
            return { backgroundColor: colors.primary, borderColor: colors.primary }
        }
        return {}
    }
    
    const getOptionTextStyle = (optionId: string) => {
        if (!selectedOption) return {}
        
        if (selectedOption === optionId) {
            return { color: colors.text }
        }
        return {}
    }

    return (
        <LinearGradient colors={[colors.gradient.purple.from, colors.gradient.purple.to]} style={styles.container}>
            <View style={styles.header}>
                <View style={styles.roundInfo}>
                    <Text style={[styles.roundText, { color: colors.text }]}>
                        Round {room?.currentRound || 1}/{room?.totalRounds || 10}
                    </Text>
                </View>
                
                <View style={styles.timeContainer}>
                    <View style={[styles.timeBar, { backgroundColor: colors.backgroundDarker }]}>
                        <Animated.View 
                            style={[
                                styles.timeProgress, 
                                { 
                                    backgroundColor: timeLeft < 10 ? colors.error : colors.secondary,
                                    width: timeAnimation.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%']
                                    })
                                }
                            ]} 
                        />
                    </View>
                    <Text style={[styles.timeText, { color: colors.text }]}>{timeLeft}s</Text>
                </View>
            </View>

            <Animated.View 
                style={[
                    styles.questionContainer, 
                    { 
                        backgroundColor: colors.backgroundLighter,
                        opacity: animation,
                        transform: [
                            {
                                translateY: animation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [50, 0]
                                })
                            }
                        ]
                    }
                ]}
            >
                {currentQuestion.image && (
                    <Image 
                        source={{ uri: currentQuestion.image }} 
                        style={styles.questionImage}
                        resizeMode="cover"
                    />
                )}
                
                <Text style={[styles.questionText, { color: colors.text }]}>
                    {currentQuestion.text}
                </Text>
                
                <Text style={[styles.categoryTag, { backgroundColor: colors.primary, color: colors.text }]}>
                    {currentQuestion.category}
                </Text>
            </Animated.View>

            <View style={styles.optionsContainer}>
                {currentQuestion.options.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.optionButton,
                            { backgroundColor: colors.backgroundLighter, borderColor: colors.border },
                            getOptionStyle(option.id)
                        ]}
                        onPress={() => handleSelectOption(option.id)}
                        disabled={userAnswered}
                    >
                        <Text 
                            style={[
                                styles.optionText, 
                                { color: colors.text },
                                getOptionTextStyle(option.id)
                            ]}
                        >
                            {option.text}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {userAnswered && (
                <View style={[styles.waitingContainer, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.waitingText, { color: colors.text }]}>
                        En attente des autres joueurs...
                    </Text>
                </View>
            )}
        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    loadingText: {
        fontSize: 18,
        textAlign: "center",
        marginTop: 100,
        fontFamily: "Poppins-Regular",
    },
    header: {
        marginTop: 50,
        marginBottom: 20,
    },
    roundInfo: {
        alignItems: "center",
        marginBottom: 16,
    },
    roundText: {
        fontSize: 18,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
    timeContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    timeBar: {
        flex: 1,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
        overflow: "hidden",
    },
    timeProgress: {
        height: "100%",
        borderRadius: 5,
    },
    timeText: {
        fontSize: 16,
        fontWeight: "bold",
        minWidth: 40,
        textAlign: "right",
        fontFamily: "Poppins-Bold",
    },
    questionContainer: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    questionImage: {
        width: "100%",
        height: 150,
        borderRadius: 8,
        marginBottom: 16,
    },
    questionText: {
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 16,
        fontFamily: "Poppins-Bold",
    },
    categoryTag: {
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        fontSize: 12,
        fontWeight: "500",
        fontFamily: "Poppins-Medium",
    },
    optionsContainer: {
        flex: 1,
    },
    optionButton: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
    },
    optionText: {
        fontSize: 16,
        fontFamily: "Poppins-Regular",
    },
    waitingContainer: {
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 20,
    },
    waitingText: {
        fontSize: 16,
        fontWeight: "500",
        fontFamily: "Poppins-Medium",
    },
})
