"use client"

import { useState } from "react"
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    useColorScheme,
    Alert,
    Switch,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import Colors from "../../constants/Colors"

export default function CustomQuestionsScreen() {
    const colorScheme = useColorScheme() ?? "dark"
    const colors = Colors[colorScheme]
    const router = useRouter()

    const [questionText, setQuestionText] = useState("")
    const [options, setOptions] = useState([
        { id: "1", text: "", isCorrect: true },
        { id: "2", text: "", isCorrect: false },
        { id: "3", text: "", isCorrect: false },
        { id: "4", text: "", isCorrect: false },
    ])
    const [category, setCategory] = useState("Custom")
    const [isPrivate, setIsPrivate] = useState(false)

    const handleOptionChange = (id, text) => {
        setOptions(
            options.map((option) => (option.id === id ? { ...option, text } : option))
        )
    }

    const handleCorrectOptionChange = (id) => {
        setOptions(
            options.map((option) => ({
                ...option,
                isCorrect: option.id === id,
            }))
        )
    }

    const handleSaveQuestion = () => {
        // Validation
        if (!questionText.trim()) {
            Alert.alert("Erreur", "La question ne peut pas être vide")
            return
        }

        const emptyOptions = options.filter((option) => !option.text.trim())
        if (emptyOptions.length > 0) {
            Alert.alert("Erreur", "Toutes les options doivent être remplies")
            return
        }

        // TODO: Save to server/storage
        Alert.alert("Succès", "Question personnalisée enregistrée avec succès", [
            { text: "OK", onPress: () => router.back() }
        ])
    }

    return (
        <LinearGradient colors={[colors.gradient.purple.from, colors.gradient.purple.to]} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Feather name="arrow-left" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Question personnalisée</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.formSection}>
                    <Text style={[styles.label, { color: colors.text }]}>Question</Text>
                    <TextInput
                        style={[
                            styles.textInput,
                            styles.questionInput,
                            { backgroundColor: colors.backgroundLighter, color: colors.text, borderColor: colors.border },
                        ]}
                        placeholder="Saisissez votre question"
                        placeholderTextColor={colors.textSecondary}
                        value={questionText}
                        onChangeText={setQuestionText}
                        multiline
                    />
                </View>

                <View style={styles.formSection}>
                    <Text style={[styles.label, { color: colors.text }]}>Options de réponse</Text>
                    <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                        Appuyez sur le cercle pour indiquer la bonne réponse
                    </Text>

                    {options.map((option) => (
                        <View key={option.id} style={styles.optionRow}>
                            <TouchableOpacity
                                style={[
                                    styles.radioButton,
                                    { borderColor: colors.primary },
                                    option.isCorrect && { backgroundColor: colors.primary },
                                ]}
                                onPress={() => handleCorrectOptionChange(option.id)}
                            />
                            <TextInput
                                style={[
                                    styles.textInput,
                                    styles.optionInput,
                                    { backgroundColor: colors.backgroundLighter, color: colors.text, borderColor: colors.border },
                                ]}
                                placeholder={`Option ${option.id}`}
                                placeholderTextColor={colors.textSecondary}
                                value={option.text}
                                onChangeText={(text) => handleOptionChange(option.id, text)}
                            />
                        </View>
                    ))}
                </View>

                <View style={styles.formSection}>
                    <Text style={[styles.label, { color: colors.text }]}>Catégorie</Text>
                    <TextInput
                        style={[
                            styles.textInput,
                            { backgroundColor: colors.backgroundLighter, color: colors.text, borderColor: colors.border },
                        ]}
                        placeholder="Catégorie de la question"
                        placeholderTextColor={colors.textSecondary}
                        value={category}
                        onChangeText={setCategory}
                    />
                </View>

                <View style={styles.formSection}>
                    <View style={styles.toggleRow}>
                        <Text style={[styles.label, { color: colors.text }]}>Question privée</Text>
                        <Switch
                            value={isPrivate}
                            onValueChange={setIsPrivate}
                            trackColor={{ false: colors.backgroundDarker, true: colors.primary }}
                            thumbColor={colors.text}
                        />
                    </View>
                    <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                        Les questions privées ne sont visibles que par vous
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.secondary }]}
                    onPress={handleSaveQuestion}
                >
                    <Text style={[styles.saveButtonText, { color: colors.backgroundDarker }]}>Enregistrer</Text>
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
    formSection: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
        fontFamily: "Poppins-SemiBold",
    },
    helpText: {
        fontSize: 12,
        marginBottom: 12,
        fontFamily: "Poppins-Regular",
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        fontFamily: "Poppins-Regular",
    },
    questionInput: {
        minHeight: 100,
        textAlignVertical: "top",
    },
    optionRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    radioButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        marginRight: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    optionInput: {
        flex: 1,
    },
    toggleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    saveButton: {
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
        marginBottom: 40,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "Poppins-Bold",
    },
})
