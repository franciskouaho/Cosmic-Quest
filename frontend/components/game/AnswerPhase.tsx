import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import GameTimer from './GameTimer';

interface AnswerPhaseProps {
  question: {
    id: number;
    text: string;
    theme?: string;
    roundNumber?: number;
    targetPlayer?: {
      id: string | number;
      displayName?: string;
      username?: string;
    };
  };
  onSubmit: (answer: string) => void;
  timer?: {
    duration: number;
    startTime: number;
  } | null;
  isSubmitting?: boolean;
  isTargetPlayer?: boolean; // Ajout de cette prop pour identifier si l'utilisateur est la cible
}

const AnswerPhase: React.FC<AnswerPhaseProps> = ({ 
  question, 
  onSubmit, 
  timer,
  isSubmitting = false,
  isTargetPlayer = false
}) => {
  const [answer, setAnswer] = useState('');
  const [localSubmitting, setLocalSubmitting] = useState(isSubmitting);
  const { user } = useAuth();
  
  // Effet pour synchroniser l'état isSubmitting externe avec l'état local
  useEffect(() => {
    setLocalSubmitting(isSubmitting);
  }, [isSubmitting]);

  // Si l'utilisateur est la cible de la question, afficher un message spécial
  if (isTargetPlayer) {
    return (
      <View style={styles.container}>
        <View style={styles.targetMessageContainer}>
          <Text style={styles.targetTitle}>Cette question est à propos de vous!</Text>
          <Text style={styles.targetMessage}>
            Vous ne pouvez pas répondre à cette question puisqu'elle vous concerne.
            Attendez que les autres joueurs finissent de répondre.
          </Text>
        </View>

        {timer && (
          <View style={styles.timerContainer}>
            <GameTimer 
              duration={timer.duration}
              startTime={timer.startTime}
            />
          </View>
        )}
        
        <View style={styles.questionContainer}>
          <Text style={styles.questionLabel}>Question :</Text>
          <Text style={styles.questionText}>{question.text}</Text>
        </View>
      </View>
    );
  }
  
  const handleSubmit = async () => {
    if (answer.trim() === '') {
      Alert.alert('Erreur', 'Votre réponse ne peut pas être vide');
      return;
    }
    
    if (question.targetPlayer && user && 
        question.targetPlayer.id.toString() === user.id.toString()) {
      Alert.alert('Impossible', 'Vous ne pouvez pas répondre à une question qui vous concerne');
      return;
    }
    
    try {
      setLocalSubmitting(true);
      
      // Log pour déboguer
      console.log('📝 Soumission de réponse:', {
        content: answer,
        question_id: question.id
      });
      
      await onSubmit(answer);
      
    } catch (error) {
      console.error('❌ Erreur lors de la soumission de la réponse:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer votre réponse. Veuillez réessayer.');
      setLocalSubmitting(false);
    }
  };
  
  return (
    <View style={styles.container}>
      {timer && (
        <View style={styles.timerContainer}>
          <GameTimer 
            duration={timer.duration}
            startTime={timer.startTime}
            onComplete={() => {
              if (answer.trim() !== '' && !localSubmitting) {
                handleSubmit();
              }
            }}
          />
        </View>
      )}
      
      <View style={styles.questionContainer}>
        <Text style={styles.questionLabel}>Question :</Text>
        <Text style={styles.questionText}>{question.text}</Text>
      </View>
      
      <TextInput
        style={styles.answerInput}
        placeholder="Votre réponse..."
        placeholderTextColor="#999"
        multiline
        value={answer}
        onChangeText={setAnswer}
        editable={!localSubmitting}
      />
      
      <TouchableOpacity 
        style={[styles.submitButton, (answer.trim() === '' || localSubmitting) && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={answer.trim() === '' || localSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {localSubmitting ? 'Envoi en cours...' : 'Envoyer ma réponse'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  timerContainer: {
    marginBottom: 16,
  },
  questionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  questionLabel: {
    fontSize: 14,
    color: '#b3a5d9',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  answerInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
    color: '#ffffff',
    minHeight: 150,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#8658fe',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(134, 88, 254, 0.5)',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  targetMessageContainer: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  targetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  targetMessage: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default AnswerPhase;
