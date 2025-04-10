import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Answer, Player, Question } from '../../types/gameTypes';

interface ResultsPhaseProps {
  answers: Answer[];
  scores: Record<string, number>;
  players: Player[];
  question: Question;
  targetPlayer: Player;
  onNextRound: () => void;
  isLastRound: boolean;
}

const ResultsPhase: React.FC<ResultsPhaseProps> = ({ 
  answers, 
  scores, 
  players, 
  question, 
  targetPlayer,
  onNextRound,
  isLastRound
}) => {
  const winningAnswer = answers.reduce((prev, current) => (prev.votes > current.votes) ? prev : current);
  const winningPlayer = players.find(p => p.id === winningAnswer.playerId);
  
  // Obtenir le nom du joueur correspondant à chaque réponse
  const getPlayerName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player ? player.name : 'Joueur inconnu';
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Résultats du tour</Text>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
        
        <View style={styles.winnerSection}>
          <Text style={styles.sectionTitle}>Réponse gagnante (+1 point)</Text>
          <View style={styles.winnerCard}>
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 215, 0, 0.1)']}
              style={styles.winnerCardGradient}
            >
              <View style={styles.winnerHeader}>
                <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
                <Text style={styles.winnerName}>{getPlayerName(winningAnswer.playerId)}</Text>
              </View>
              <Text style={styles.winnerAnswer}>{winningAnswer.content}</Text>
            </LinearGradient>
          </View>
        </View>
        
        <View style={styles.allAnswersSection}>
          <Text style={styles.sectionTitle}>Toutes les réponses</Text>
          {answers.map((answer) => (
            <View 
              key={answer.playerId} 
              style={[
                styles.answerCard, 
                answer.playerId === winningAnswer.playerId ? styles.winningAnswerCard : null
              ]}
            >
              <View style={styles.answerHeader}>
                <Text style={styles.playerName}>{getPlayerName(answer.playerId)}</Text>
              </View>
              <Text style={styles.answerText}>{answer.content}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.scoresSection}>
          <Text style={styles.sectionTitle}>Scores actuels</Text>
          {Object.entries(scores)
            .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
            .map(([playerId, score], index) => (
              <View key={playerId} style={styles.scoreRow}>
                <Text style={styles.scoreRank}>{index + 1}</Text>
                <Text style={styles.scoreName}>{getPlayerName(playerId)}</Text>
                <Text style={styles.scoreValue}>{score} pts</Text>
              </View>
            ))
          }
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={onNextRound}
        >
          <Text style={styles.nextButtonText}>
            {isLastRound ? 'Voir les résultats finaux' : 'Tour suivant'}
          </Text>
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
  },
  content: {
    flex: 1,
  },
  questionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  targetPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#694ED6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  targetPlayerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  winnerSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#b3a5d9',
    marginBottom: 12,
  },
  winnerCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  winnerCardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  winnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  winnerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
  },
  winnerAnswer: {
    fontSize: 16,
    color: '#ffffff',
  },
  allAnswersSection: {
    marginBottom: 20,
  },
  answerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  winningAnswerCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  answerHeader: {
    marginBottom: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b3a5d9',
  },
  answerText: {
    fontSize: 16,
    color: '#ffffff',
  },
  scoresSection: {
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  scoreRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#b3a5d9',
    width: 30,
  },
  scoreName: {
    flex: 1,
    fontSize: 16,
    color: '#ffffff',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footer: {
    marginTop: 16,
  },
  nextButton: {
    backgroundColor: '#694ED6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ResultsPhase;
