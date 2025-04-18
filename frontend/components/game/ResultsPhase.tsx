import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Answer, Player, Question } from '@/types/gameTypes';
import GameService from '@/services/queries/game';
import gameWebSocketService from '@/services/gameWebSocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ResultsPhaseProps {
  answers: Answer[];
  scores: Record<string, number>;
  players: Player[];
  question: Question;
  targetPlayer: Player;
  onNextRound: () => Promise<void>;
  isLastRound: boolean;
  timer?: {
    duration: number;
    startTime: number;
  } | null;
  gameId?: string | number;
  isTargetPlayer?: boolean;
  currentPhase: string;
}

interface Score {
  playerId: string | number;
  score: number;
}

const ResultsPhase: React.FC<ResultsPhaseProps> = ({ 
  answers, 
  scores, 
  players, 
  question, 
  targetPlayer,
  onNextRound,
  isLastRound,
  timer,
  gameId,
  isTargetPlayer = false,
  currentPhase
}) => {
  const router = useRouter();
  
  // Trouver la réponse avec le plus de votes
  const winningAnswer = answers.length > 0 
    ? answers.reduce((prev, current) => (prev.votesCount || 0) > (current.votesCount || 0) ? prev : current, answers[0])
    : null;
    
  const winningPlayer = winningAnswer 
    ? players.find(p => p.id === winningAnswer.playerId) 
    : null;
  
  // États pour le contrôle du bouton
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [isUserHost, setIsUserHost] = useState<boolean | null>(null);
  const [isCheckingHost, setIsCheckingHost] = useState(true);
  const [canProceed, setCanProceed] = useState(true);
  
  // Flag
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  
  useEffect(() => {
    setCanProceed(true);
  }, []);
  
  // Vérifier si l'utilisateur est l'hôte de la partie en utilisant uniquement WebSocket
  useEffect(() => {
    const checkIfUserIsHost = async () => {
      setIsCheckingHost(true);
      
      try {
        let effectiveGameId = gameId;
        
        if (!effectiveGameId && answers && answers.length > 0) {
          effectiveGameId = answers[0].gameId;
          
          if (!effectiveGameId && answers[0].questionId) {
            const idParts = String(answers[0].questionId).split('-');
            if (idParts.length > 0) {
              effectiveGameId = idParts[0];
            }
          }
        }
        
        if (!effectiveGameId) {
          console.warn('⚠️ Impossible de déterminer un gameId pour vérifier l\'hôte');
          setIsUserHost(false);
          setIsCheckingHost(false);
          return;
        }
        
        console.log(`🔍 Vérification d'hôte pour la partie ${effectiveGameId}`);
        
        const isHost = await gameWebSocketService.isUserHost(String(effectiveGameId));
        
        console.log(`👑 Résultat vérification hôte: ${isHost ? 'EST' : 'N\'EST PAS'} l'hôte`);
        setIsUserHost(isHost);
      } catch (error) {
        console.error("❌ Erreur lors de la vérification de l'hôte:", error);
        setIsUserHost(false);
      } finally {
        setIsCheckingHost(false);
      }
    };
    
    checkIfUserIsHost();
  }, [gameId, answers, isSynchronizing]);
  
  const handleNextRound = useCallback(async () => {
    console.log('🎮 [ResultsPhase] Début handleNextRound:', {
      phase: currentPhase,
      isButtonDisabled,
      isSynchronizing,
      isUserHost,
      isTargetPlayer,
      hasVotes: answers.some(a => a.votesCount && a.votesCount > 0),
      answersCount: answers.length,
      playersCount: players.length,
      gameId,
      isLastRound
    });

    if (isButtonDisabled || isSynchronizing) {
      console.log('❌ [ResultsPhase] Action bloquée:', {
        isButtonDisabled,
        isSynchronizing
      });
      return;
    }
    
    setIsButtonDisabled(true);
    setIsSynchronizing(true);
    
    try {
      // Vérifier que nous sommes dans une phase valide
      if (currentPhase !== 'results' && currentPhase !== 'vote') {
        console.log('⚠️ [ResultsPhase] Phase invalide:', {
          currentPhase,
          validPhases: ['results', 'vote']
        });
        
        let message = "Vous ne pouvez pas passer au tour suivant pendant cette phase.";
        if (currentPhase === 'question') {
          message = "Veuillez attendre que tous les joueurs aient répondu avant de passer au tour suivant.";
        }
        
        Alert.alert(
          "Action impossible",
          message
        );
        return;
      }
      
      // Si on est en phase vote, vérifier qu'il y a des votes
      if (currentPhase === 'vote' && answers.every(a => !a.votesCount || a.votesCount === 0)) {
        console.log('⚠️ [ResultsPhase] Aucun vote détecté:', {
          answers: answers.map(a => ({
            id: a.id,
            votes: a.votesCount
          }))
        });
        Alert.alert(
          "Action impossible",
          "Veuillez attendre que les votes soient terminés avant de passer au tour suivant."
        );
        return;
      }
      
      // Vérifier que tous les joueurs (sauf la cible) ont répondu
      const expectedAnswers = players.length - 1; // -1 pour la cible qui ne répond pas
      const actualAnswers = answers.length;
      
      console.log('📊 [ResultsPhase] Vérification des réponses:', {
        expectedAnswers,
        actualAnswers,
        playersCount: players.length,
        targetPlayerId: targetPlayer?.id,
        answers: answers.map(a => ({
          id: a.id,
          playerId: a.playerId,
          content: a.content
        }))
      });
      
      if (actualAnswers < expectedAnswers) {
        console.log('⚠️ [ResultsPhase] Nombre insuffisant de réponses:', {
          answersCount: actualAnswers,
          expectedAnswers,
          playersCount: players.length
        });
        Alert.alert(
          "Action impossible",
          "Veuillez attendre que tous les joueurs (sauf la cible) aient répondu avant de passer au tour suivant."
        );
        return;
      }
      
      // Utiliser la méthode nextRound du GameService via HTTP
      if (gameId) {
        console.log('🔄 [ResultsPhase] Appel nextRound avec gameId:', {
          gameId,
          currentPhase,
          isLastRound,
          forceAdvance: isLastRound
        });
        
        await GameService.nextRound(String(gameId));
        console.log('✅ [ResultsPhase] Tour suivant initié avec succès');
        // Rafraîchir l'état du jeu après le passage au tour suivant
        await onNextRound();
      } else {
        console.log('❌ [ResultsPhase] Pas de gameId disponible');
      }
    } catch (error: any) {
      console.error('❌ [ResultsPhase] Erreur lors du passage au tour suivant:', {
        error: error?.response?.data || error,
        status: error?.response?.status,
        phase: currentPhase,
        gameId
      });
      
      let errorMessage = "Le passage au tour suivant a échoué.";
      
      // Gestion spécifique des erreurs du serveur
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
        
        // Ajouter des détails supplémentaires si disponibles
        if (error.response.data.details) {
          const details = error.response.data.details;
          console.log('📝 [ResultsPhase] Détails de l\'erreur:', details);
          
          if (!details.allPlayersAnswered) {
            errorMessage = "Veuillez attendre que tous les joueurs (sauf la cible) aient répondu avant de passer au tour suivant.";
          } else if (!details.hasVotes && details.currentPhase === 'vote') {
            errorMessage = "Veuillez attendre que tous les votes soient enregistrés avant de passer au tour suivant.";
          }
        }
      }
      
      Alert.alert(
        "Action impossible",
        errorMessage
      );
    } finally {
      setIsButtonDisabled(false);
      setIsSynchronizing(false);
      console.log('🏁 [ResultsPhase] Fin handleNextRound');
    }
  }, [onNextRound, isButtonDisabled, isSynchronizing, currentPhase, answers, gameId, players.length, targetPlayer?.id, isLastRound]);

  const getPlayerName = (playerId: string | number) => {
    const searchId = String(playerId);
    const player = players.find(p => String(p.id) === searchId);
    
    if (!player) {
      return "Joueur inconnu";
    }
    
    const name = player.displayName || player.name || player.username;
    return name || "Joueur inconnu";
  };

  const renderPlayerScore = (player: Player) => {
    return (
      <View key={`score-${player.id}`} style={styles.scoreCard}>
        <Text style={styles.playerName}>
          {getPlayerName(player.id)}
        </Text>
        <Text style={styles.scoreText}>
          Score: {player.score || 0}
        </Text>
      </View>
    );
  };

  const renderAnswer = (answer: Answer) => {
    const playerIdStr = String(answer.playerId);
    const player = players.find(p => String(p.id) === playerIdStr);
    
    return (
      <View 
        key={`answer-${answer.id}`}
        style={[
          styles.answerCard, 
          answer === winningAnswer ? styles.winningAnswerCard : null
        ]}
      >
        <View style={styles.answerHeader}>
          <Text style={styles.playerName}>
            {player ? getPlayerName(player.id) : `Joueur ${playerIdStr}`}
          </Text>
        </View>
        <Text style={styles.answerText}>{answer.content}</Text>
        {answer.votesCount && answer.votesCount > 0 && (
          <View key={`votes-${answer.id}`} style={styles.voteCountContainer}>
            <MaterialCommunityIcons name="thumb-up" size={16} color="#b3a5d9" />
            <Text style={styles.voteCount}>{answer.votesCount}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFinalResults = () => {
    const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    const winner = sortedPlayers[0];

    return (
      <View style={styles.finalResultsContainer}>
        <Text style={styles.finalResultsTitle}>Résultats finaux</Text>
        {winner && (
          <View style={styles.winnerSection}>
            <Text style={styles.winnerText}>🎉 Vainqueur: {getPlayerName(winner.id)} 🎉</Text>
            <Text style={styles.winnerScore}>Score final: {winner.score || 0} points</Text>
          </View>
        )}
        <View style={styles.allScores}>
          {sortedPlayers.map((player, index) => (
            <View key={player.id} style={styles.playerRank}>
              <Text style={styles.rankText}>#{index + 1}</Text>
              {renderPlayerScore(player)}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const noVotesMode = answers.every(a => !a.votesCount || a.votesCount === 0);

  const renderNextButton = () => {
    if (isCheckingHost) {
      return (
        <View style={[styles.nextButton, styles.checkingButton]}>
          <ActivityIndicator size="small" color="#ffffff" style={{marginRight: 10}} />
          <Text style={styles.nextButtonText}>Vérification des droits...</Text>
        </View>
      );
    }
    
    if (isUserHost === true || isTargetPlayer) {
      return (
        <TouchableOpacity
          style={[
            styles.nextButton, 
            (!canProceed || isButtonDisabled || isSynchronizing) && styles.disabledButton,
            isUserHost ? styles.hostButton : styles.targetButton
          ]}
          onPress={handleNextRound}
          disabled={!canProceed || isButtonDisabled || isSynchronizing}
        >
          {isSynchronizing ? (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <ActivityIndicator size="small" color="#ffffff" style={{marginRight: 10}} />
              <Text style={styles.nextButtonText}>Synchronisation en cours...</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.nextButtonText}>
                {isLastRound ? 'Voir les résultats finaux' : 'Tour suivant'}
              </Text>
              {!canProceed && (
                <Text style={styles.waitText}>Veuillez patienter...</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    }
    
    return (
      <View style={[styles.nextButton, styles.disabledButton]}>
        <Text style={styles.nextButtonText}>
          En attente que l'hôte ou la cible passe au tour suivant
        </Text>
        <MaterialCommunityIcons name="timer-sand" size={18} color="#b3a5d9" style={{marginTop: 4}} />
      </View>
    );
  };

  if (isLastRound) {
    return renderFinalResults();
  }
  
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
                <Text style={styles.avatarText}>
                  {(targetPlayer.name || targetPlayer.displayName || targetPlayer.username || "?").charAt(0)}
                </Text>
              </View>
              <Text style={styles.targetPlayerName}>
                {targetPlayer.name || targetPlayer.displayName || targetPlayer.username || "Joueur inconnu"}
              </Text>
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
                : "En attente des votes..."}
            </Text>
          </View>
        )}
        
        <View style={styles.allAnswersSection}>
          <Text style={styles.sectionTitle}>Toutes les réponses</Text>
          {answers && answers.length > 0 ? (
            answers.map((answer) => renderAnswer(answer))
          ) : (
            <View style={styles.noAnswersContainer}>
              <Text style={styles.noAnswersText}>Aucune réponse pour ce tour</Text>
            </View>
          )}
        </View>
        
        <View style={styles.scoresSection}>
          <Text style={styles.sectionTitle}>Scores</Text>
          {scores && Object.keys(scores).length > 0 ? (
            Object.entries(scores).map(([playerId, score]) => renderPlayerScore(players.find(p => String(p.id) === playerId) || players[0]))
          ) : (
            <View style={styles.noScoresContainer}>
              <Text style={styles.noScoresText}>Aucun score à afficher</Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        {renderNextButton()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginRight: 12,
  },
  header: {
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
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
    color: '#ffffff',
    marginRight: 8,
  },
  answerText: {
    fontSize: 16,
    color: '#ffffff',
  },
  scoresSection: {
    marginBottom: 20,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
  },
  scoreText: {
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
    flexDirection: 'row',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: 'rgba(105, 78, 214, 0.3)',
    opacity: 0.8,
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
  checkingButton: {
    backgroundColor: 'rgba(105, 78, 214, 0.7)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostButton: {
    backgroundColor: 'rgba(72, 219, 134, 0.7)',
  },
  targetButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.7)',
  },
  noAnswersContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  noScoresContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  noScoresText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#694ED6',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 12,
  },
  playerRank: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  finalResultsContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  finalResultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  winnerSection: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 12,
  },
  winnerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  winnerScore: {
    fontSize: 16,
    color: '#ffffff',
  },
  allScores: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 12,
  },
  gridLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  answersSection: {
    marginTop: 24,
    marginBottom: 20,
  },
});

export default ResultsPhase;
