import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Player, Question } from '../../types/gameTypes';

interface QuestionPhaseProps {
  question: Question;
  targetPlayer: Player;
  onSubmit: (answer: string) => void;
  round: number;
  totalRounds: number;
}

const QuestionPhase: React.FC<QuestionPhaseProps> = ({ 
  question, 
  targetPlayer, 
  onSubmit, 
  round, 
  totalRounds 
}) => {
  const [answer, setAnswer] = useState('');
  
  const handleSubmit = () => {
    const trimmedAnswer = answer.trim();
    if (trimmedAnswer.length > 0) {
      console.log("Soumission de la réponse:", trimmedAnswer);
      onSubmit(trimmedAnswer);
    } else {
      Alert.alert("Réponse requise", "Veuillez entrer une réponse avant de soumettre.");
    }
  };
  
  const isSubmitEnabled = answer.trim().length > 0;
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <Text style={styles.roundText}>Tour {round}/{totalRounds}</Text>
      </View>
      
      <View style={styles.questionCard}>
        <LinearGradient
          colors={['rgba(105, 78, 214, 0.3)', 'rgba(105, 78, 214, 0.1)']}
          style={styles.cardGradient}
        >
          <View style={styles.targetPlayerInfo}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{targetPlayer.name.charAt(0)}</Text>
            </View>
            <Text style={styles.targetPlayerName}>{targetPlayer.name}</Text>
          </View>
          
          <Text style={styles.questionText}>{question.text}</Text>
        </LinearGradient>
      </View>
      
      <View style={styles.answerContainer}>
        <Text style={styles.answerLabel}>Votre réponse</Text>
        <TextInput
          style={styles.answerInput}
          onChangeText={(text) => {
            console.log("Texte saisi:", text);
            setAnswer(text);
          }}
          value={answer}
          placeholder="Tapez votre réponse ici..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          multiline
          maxLength={200}
        />
        
        <TouchableOpacity
          style={[
            styles.submitButton,
            !isSubmitEnabled && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!isSubmitEnabled}
        >
          <Text style={styles.submitButtonText}>Soumettre ma réponse</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  roundText: {
    color: '#b3a5d9',
    fontSize: 16,
    fontWeight: '600',
  },
  questionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardGradient: {
    padding: 20,
    borderRadius: 16,
  },
  targetPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#694ED6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  targetPlayerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  questionText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeight: 32,
  },
  answerContainer: {
    marginBottom: 20,
  },
  answerLabel: {
    color: '#b3a5d9',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  answerInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#694ED6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(105, 78, 214, 0.5)',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QuestionPhase;
