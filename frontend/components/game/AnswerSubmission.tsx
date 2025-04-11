import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
// ...existing imports...
import GameTimer from './GameTimer';

interface AnswerSubmissionProps {
  onSubmit: (answer: string) => void;
  isSubmitting: boolean;
  timer?: {
    duration: number;
    startTime: number;
  };
}

const AnswerSubmission: React.FC<AnswerSubmissionProps> = ({ 
  onSubmit, 
  isSubmitting,
  timer 
}) => {
  const [answer, setAnswer] = useState('');
  
  return (
    <View style={styles.container}>
      {timer && (
        <View style={styles.timerContainer}>
          <GameTimer 
            duration={timer.duration}
            startTime={timer.startTime}
            onComplete={() => {
              // Auto-submit si le temps est écoulé et qu'il y a une réponse
              if (answer.trim().length > 0 && !isSubmitting) {
                onSubmit(answer);
              }
            }}
          />
        </View>
      )}
      
      <TextInput
        style={styles.input}
        placeholder="Votre réponse..."
        placeholderTextColor="#aaa"
        value={answer}
        onChangeText={setAnswer}
        multiline
        maxLength={500}
      />
      
      <TouchableOpacity 
        style={[styles.submitButton, isSubmitting && styles.disabledButton]}
        onPress={() => onSubmit(answer)}
        disabled={isSubmitting || answer.trim().length === 0}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Envoi...' : 'Envoyer'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 15,
  },
  timerContainer: {
    marginBottom: 10,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    marginBottom: 15,
    minHeight: 100,
  },
  submitButton: {
    backgroundColor: '#5D6DFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(93, 109, 255, 0.5)',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default AnswerSubmission;
