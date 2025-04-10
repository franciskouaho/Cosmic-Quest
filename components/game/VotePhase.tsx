import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Answer, Question } from '../../types/gameTypes';

interface VotePhaseProps {
  answers: Answer[];
  question: Question;
  onVote: (answerId: string) => void;
}

const VotePhase: React.FC<VotePhaseProps> = ({ answers, question, onVote }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  
  const handleVote = () => {
    if (selectedAnswer) {
      onVote(selectedAnswer);
    }
  };
  
  const renderAnswerItem = ({ item }: { item: Answer }) => (
    <TouchableOpacity
      style={[
        styles.answerCard,
        selectedAnswer === item.playerId ? styles.selectedAnswerCard : null
      ]}
      onPress={() => setSelectedAnswer(item.playerId)}
      activeOpacity={0.8}
    >
      <Text style={styles.answerText}>{item.content}</Text>
      
      {selectedAnswer === item.playerId && (
        <View style={styles.selectedIndicator}>
          <MaterialIcons name="check-circle" size={24} color="#694ED6" />
        </View>
      )}
    </TouchableOpacity>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choisissez votre réponse préférée</Text>
      </View>
      
      <View style={styles.questionCard}>
        <LinearGradient
          colors={['rgba(105, 78, 214, 0.3)', 'rgba(105, 78, 214, 0.1)']}
          style={styles.cardGradient}
        >
          <Text style={styles.questionText}>{question.text}</Text>
        </LinearGradient>
      </View>
      
      <View style={styles.answersContainer}>
        <Text style={styles.sectionTitle}>Réponses</Text>
        
        <FlatList
          data={answers}
          renderItem={renderAnswerItem}
          keyExtractor={(item) => item.playerId}
          contentContainerStyle={styles.answersList}
          showsVerticalScrollIndicator={false}
        />
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.voteButton,
            !selectedAnswer && styles.voteButtonDisabled
          ]}
          onPress={handleVote}
          disabled={!selectedAnswer}
        >
          <Text style={styles.voteButtonText}>Voter</Text>
        </TouchableOpacity>
      </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
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
  questionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  answersContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#b3a5d9',
    marginBottom: 16,
  },
  answersList: {
    paddingBottom: 20,
  },
  answerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  selectedAnswerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#694ED6',
    borderWidth: 2,
  },
  answerText: {
    fontSize: 16,
    color: '#ffffff',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  footer: {
    marginTop: 16,
  },
  voteButton: {
    backgroundColor: '#694ED6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  voteButtonDisabled: {
    backgroundColor: 'rgba(105, 78, 214, 0.5)',
  },
  voteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VotePhase;
