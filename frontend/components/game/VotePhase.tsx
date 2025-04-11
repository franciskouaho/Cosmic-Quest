import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Answer, Question } from '../../types/gameTypes';
import GameTimer from './GameTimer';

interface VotePhaseProps {
  answers: Answer[];
  question: Question;
  onVote: (answerId: string) => void;
  timer?: {
    duration: number;
    startTime: number;
  } | null;
}

const VotePhase: React.FC<VotePhaseProps> = ({ answers, question, onVote, timer }) => {
  // Filtrer les réponses pour exclure les propres réponses de l'utilisateur
  const filteredAnswers = answers.filter(answer => !answer.isOwnAnswer);
  
  const handleVote = (answer: Answer) => {
    if (answer.isOwnAnswer) {
      Alert.alert("Impossible", "Vous ne pouvez pas voter pour votre propre réponse.");
      return;
    }
    onVote(answer.id.toString());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vote pour la meilleure réponse</Text>
      </View>

      {timer && (
        <View style={styles.timerContainer}>
          <GameTimer 
            duration={timer.duration}
            startTime={timer.startTime}
          />
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          <LinearGradient
            colors={['rgba(105, 78, 214, 0.3)', 'rgba(105, 78, 214, 0.1)']}
            style={styles.cardGradient}
          >
            <Text style={styles.questionText}>{question.text}</Text>
          </LinearGradient>
        </View>

        <Text style={styles.sectionTitle}>Sélectionne ta réponse préférée</Text>

        {filteredAnswers.length > 0 ? filteredAnswers.map((answer) => (
          <TouchableOpacity 
            key={answer.id.toString()}
            style={styles.answerCard}
            onPress={() => handleVote(answer)}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
              style={styles.answerGradient}
            >
              <Text style={styles.answerText}>{answer.content}</Text>
              <View style={styles.voteButton}>
                <MaterialCommunityIcons name="heart" size={24} color="#ff6b6b" />
                <Text style={styles.voteText}>Voter</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )) : (
          <View style={styles.noAnswersContainer}>
            <Text style={styles.noAnswersText}>Aucune réponse disponible pour le moment</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  timerContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  content: {
    flex: 1,
  },
  questionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 25,
  },
  cardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#b3a5d9',
    marginBottom: 16,
  },
  answerCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  answerGradient: {
    padding: 16,
    borderRadius: 12,
  },
  answerText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  voteText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  noAnswersContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  noAnswersText: {
    color: '#b3a5d9',
    textAlign: 'center',
    fontSize: 16,
  }
});

export default VotePhase;
