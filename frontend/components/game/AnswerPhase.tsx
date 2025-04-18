import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { AnswerPhaseProps } from '@/types/game';

export const AnswerPhase: React.FC<AnswerPhaseProps> = ({
    question,
    targetPlayer,
    onSubmit,
    round,
    totalRounds,
    timer,
    hasAnswered
}) => {
    const [answer, setAnswer] = useState('');

    const handleSubmit = async () => {
        if (answer.trim()) {
            await onSubmit(answer.trim());
        }
    };

    if (hasAnswered) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>Votre réponse a été enregistrée !</Text>
                <Text style={styles.waitingText}>En attente des autres joueurs...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.roundText}>Round {round} sur {totalRounds}</Text>
            <Text style={styles.questionText}>{question.text}</Text>
            <Text style={styles.targetText}>À propos de: {targetPlayer.name}</Text>
            
            <TextInput
                style={styles.input}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Votre réponse..."
                multiline
                numberOfLines={4}
            />

            <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={!answer.trim()}
            >
                <Text style={styles.submitButtonText}>Envoyer</Text>
            </TouchableOpacity>

            {timer !== null && (
                <Text style={styles.timerText}>Temps restant: {timer}s</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        alignItems: 'center',
    },
    roundText: {
        fontSize: 18,
        marginBottom: 10,
    },
    questionText: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    targetText: {
        fontSize: 18,
        marginBottom: 20,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginBottom: 20,
        minHeight: 100,
    },
    submitButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 5,
        width: '100%',
        alignItems: 'center',
    },
    submitButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    timerText: {
        marginTop: 20,
        fontSize: 16,
    },
    message: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    waitingText: {
        fontSize: 16,
        color: '#666',
    },
}); 