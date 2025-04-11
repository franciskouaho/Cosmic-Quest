import React, { useState, useEffect } from 'react';
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
  timer?: {
    duration: number;
    startTime: number;
  } | null;
}

const ResultsPhase: React.FC<ResultsPhaseProps> = ({ 
  answers, 
  scores, 
  players, 
  question, 
  targetPlayer,
  onNextRound,
  isLastRound,
  timer
}) => {
  // Trouver la réponse avec le plus de votes
  const winningAnswer = answers.length > 0 
    ? answers.reduce((prev, current) => (prev.votesCount || 0) > (current.votesCount || 0) ? prev : current, answers[0])
    : null;
    
  const winningPlayer = winningAnswer 
    ? players.find(p => p.id === winningAnswer.playerId) 
    : null;
  
  // États pour éviter les double-clics accidentels
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  
  // Permettre le bouton "Tour suivant" après un délai pour éviter le passage prématuré
  const [canProceed, setCanProceed] = useState(false);
  
  useEffect(() => {
    // Attendre 3 secondes avant de permettre le passage au tour suivant
    const timer = setTimeout(() => {
      setCanProceed(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleNextRound = () => {
    if (isButtonDisabled) return;
    
    setIsButtonDisabled(true);
    onNextRound();
    
    // Réactiver le bouton après 2 secondes pour éviter les clics multiples
    setTimeout(() => {
      setIsButtonDisabled(false);
    }, 2000);
  };

  // Obtenir le nom du joueur correspondant à chaque réponse
  const getPlayerName = (playerId: string | number) => {
    const player = players.find(p => p.id === playerId);
    return player ? (player.name || player.displayName || player.username) : 'Joueur inconnu';
  };
  
  // Pour les parties à 2 joueurs où il n'y a pas de vote (donc pas de gagnant clairement défini)
  const noVotesMode = answers.every(a => !a.votesCount || a.votesCount === 0);
  
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
                <Text style={styles.avatarText}>{(targetPlayer.name || targetPlayer.displayName || targetPlayer.username || "?").charAt(0)}</Text>
              </View>
              <Text style={styles.targetPlayerName}>{targetPlayer.name || targetPlayer.displayName || targetPlayer.username}</Text>
            </View>
            
            <Text style={styles.questionText}>{question.text}</Text>
          </LinearGradient>
        </View>
        
        {winningAnswer && !noVotesMode ? (
          <View style={styles.winnerSection}>
            <Text style={styles.sectionTitle}>Réponse gagnante</Text>
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
        ) : (
          <View style={styles.messageSection}>
            <Text style={styles.messageText}>
              {noVotesMode 
                ? "Aucun vote pour ce tour. Passons au suivant!" 
                : "Pas de réponse gagnante pour ce tour."}
            </Text>
          </View>
        )}
        
        <View style={styles.allAnswersSection}>
          <Text style={styles.sectionTitle}>Toutes les réponses</Text>
          {answers.length > 0 ? (
            answers.map((answer) => (
              <View 
                key={answer.id} 
                style={[
                  styles.answerCard, 
                  answer === winningAnswer ? styles.winningAnswerCard : null
                ]}
              >
                <View style={styles.answerHeader}>
                  <Text style={styles.playerName}>{getPlayerName(answer.playerId)}</Text>
                </View>
                <Text style={styles.answerText}>{answer.content}</Text>
                {answer.votesCount > 0 && (
                  <View style={styles.voteCountContainer}>
                    <MaterialCommunityIcons name="thumb-up" size={16} color="#b3a5d9" />
                    <Text style={styles.voteCount}>{answer.votesCount}</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.noAnswersText}>Aucune réponse pour ce tour</Text>
          )}
        </View>
        
        <View style={styles.scoresSection}>
          <Text style={styles.sectionTitle}>Scores actuels</Text>
          {Object.entries(scores).length > 0 ? (
            Object.entries(scores)
              .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
              .map(([playerId, score], index) => (
                <View key={playerId} style={styles.scoreRow}>
                  <Text style={styles.scoreRank}>{index + 1}</Text>
                  <Text style={styles.scoreName}>{getPlayerName(playerId)}</Text>
                  <Text style={styles.scoreValue}>{score} pts</Text>
                </View>
              ))
          ) : (
            <Text style={styles.noAnswersText}>Aucun score à afficher</Text>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton, 
            (!canProceed || isButtonDisabled) && styles.disabledButton
          ]}
          onPress={handleNextRound}
          disabled={!canProceed || isButtonDisabled}
        >
          <Text style={styles.nextButtonText}>
            {isLastRound ? 'Voir les résultats finaux' : 'Tour suivant'}
          </Text>
          {!canProceed && (
            <Text style={styles.waitText}>Veuillez patienter...</Text>
          )}
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
  disabledButton: {
    backgroundColor: 'rgba(105, 78, 214, 0.5)',
  },
  waitText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  messageSection: {
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  messageText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  voteCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  voteCount: {
    fontSize: 14,
    color: '#b3a5d9',
    marginLeft: 4,
  },
  noAnswersText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
});

export default ResultsPhase;
