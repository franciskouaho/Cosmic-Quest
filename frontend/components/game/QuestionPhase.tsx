import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Question } from '@/types/gameTypes';
import GameTimer from './GameTimer';

type QuestionPhaseProps = {
  question: Question;
  targetPlayer: {
    id: string;
    name?: string;
    avatar?: string;
  };
  onSubmit: (answer: string) => void;
  round: number;
  totalRounds: number;
  timer?: {
    duration: number;
    startTime: number;
  } | null;
};

const QuestionPhase = ({ question, targetPlayer, onSubmit, round, totalRounds, timer }: QuestionPhaseProps) => {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vérifier que les props nécessaires existent
  if (!question || !question.text || !targetPlayer) {
    console.error("⚠️ QuestionPhase: Des propriétés requises sont manquantes:", { question, targetPlayer });
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Erreur: Données de jeu incomplètes</Text>
      </View>
    );
  }

  // Utiliser des valeurs par défaut si certaines propriétés sont manquantes
  const playerName = targetPlayer.name || "Joueur";
  const avatarUrl = targetPlayer.avatar || "https://randomuser.me/api/portraits/lego/1.jpg";
  
  const handleSubmit = () => {
    if (!answer.trim()) return;
    
    setIsSubmitting(true);
    onSubmit(answer.trim());
  };
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(93, 109, 255, 0.2)', 'rgba(93, 109, 255, 0.05)']}
        style={styles.roundBadge}
      >
        <Text style={styles.roundText}>Tour {round}/{totalRounds}</Text>
      </LinearGradient>
      
      {timer && (
        <GameTimer 
          duration={timer.duration}
          startTime={timer.startTime}
        />
      )}
      
      <View style={styles.targetPlayerContainer}>
        <Image 
          source={{ uri: avatarUrl }}
          style={styles.playerAvatar}
          defaultSource={{ uri: "https://randomuser.me/api/portraits/lego/1.jpg" }}
        />
        <Text style={styles.targetPlayerName}>{playerName}</Text>
      </View>
      
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>{question.text}</Text>
      </View>
      
      <View style={styles.answerContainer}>
        <TextInput
          style={styles.answerInput}
          placeholder="Votre réponse..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={answer}
          onChangeText={setAnswer}
          multiline
          maxLength={150}
          disabled={isSubmitting}
        />
        
        <TouchableOpacity 
          style={[styles.submitButton, !answer.trim() && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={!answer.trim() || isSubmitting}
        >
          <MaterialCommunityIcons name="send" size={22} color="white" />
          <Text style={styles.submitButtonText}>Envoyer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  roundBadge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  roundText: {
    color: 'white',
    fontWeight: 'bold',
  },
  targetPlayerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  playerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(93, 109, 255, 0.8)',
    marginBottom: 10,
  },
  targetPlayerName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  questionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    width: '100%',
  },
  questionText: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 28,
  },
  answerContainer: {
    width: '100%',
  },
  answerInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    color: 'white',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  submitButton: {
    backgroundColor: 'rgba(93, 109, 255, 0.8)',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: 'rgba(93, 109, 255, 0.3)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    textAlign: 'center',
  },
});

export default QuestionPhase;
