import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Answer, Player, Question } from '@/types/gameTypes';
import GameWebSocketService from '@/services/gameWebSocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  gameId?: string | number;
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
  gameId
}) => {
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
  const [canProceed, setCanProceed] = useState(false);
  
  // Flag indiquant si le jeu est en cours de synchronisation
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  
  useEffect(() => {
    // Attendre un court moment avant de permettre le passage au tour suivant
    const timer = setTimeout(() => {
      setCanProceed(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Vérifier si l'utilisateur est l'hôte de la partie en utilisant uniquement WebSocket
  useEffect(() => {
    const checkIfUserIsHost = async () => {
      setIsCheckingHost(true);
      
      try {
        // Utiliser gameId de props OU extraire des réponses si disponible
        let effectiveGameId = gameId;
        
        if (!effectiveGameId && answers && answers.length > 0) {
          effectiveGameId = answers[0].gameId;
          
          // Si gameId n'est pas directement disponible, essayer de l'extraire du questionId
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
        
        // Corriger l'appel à la méthode isUserHost
        const isHost = await GameWebSocketService.isUserHost(String(effectiveGameId));
        
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
    
    // Re-vérifier périodiquement le statut d'hôte au cas où il y a un changement
    const refreshHostInterval = setInterval(() => {
      if (!isSynchronizing) {
        checkIfUserIsHost();
      }
    }, 15000); // Toutes les 15 secondes
    
    return () => {
      clearInterval(refreshHostInterval);
    };
  }, [gameId, answers, isSynchronizing]);
  
  const handleNextRound = useCallback(() => {
    if (isButtonDisabled || !canProceed || isSynchronizing) return;
    
    setIsButtonDisabled(true);
    setIsSynchronizing(true);
    
    try {
      console.log("🎮 ResultsPhase: Tentative de passage au tour suivant...");
      
      // Réduire le délai minimal et augmenter le timeout
      const minDelay = new Promise(resolve => setTimeout(resolve, 500));
      
      Promise.race([
        Promise.all([onNextRound(), minDelay]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout dépassé')), 12000)
        )
      ]).then(() => {
        console.log("✅ ResultsPhase: Passage au tour suivant initié");
      }).catch((error) => {
        console.error("❌ ResultsPhase: Erreur:", error);
        Alert.alert(
          "Erreur",
          "Le passage au tour suivant a échoué. Nous réessayons automatiquement.",
          [{ text: "OK" }]
        );
      }).finally(() => {
        setTimeout(() => {
          setIsButtonDisabled(false);
          setIsSynchronizing(false);
        }, 1000);
      });
    } catch (error) {
      setIsButtonDisabled(false);
      setIsSynchronizing(false);
    }
  }, [onNextRound, isButtonDisabled, canProceed, isSynchronizing]);

  // Obtenir le nom du joueur correspondant à chaque réponse
  const getPlayerName = (playerId: string | number) => {
    const player = players.find(p => p.id === playerId.toString() || p.id === Number(playerId));
    return player ? (player.name || player.displayName || player.username || "Joueur inconnu") : "Joueur inconnu";
  };
  
  // Pour les parties à 2 joueurs où il n'y a pas de vote (donc pas de gagnant clairement défini)
  const noVotesMode = answers.every(a => !a.votesCount || a.votesCount === 0);

  // Rendu du bouton en fonction du rôle (hôte ou joueur)
  const renderNextButton = () => {
    // Si on vérifie encore si l'utilisateur est l'hôte, montrer un indicateur de chargement
    if (isCheckingHost) {
      return (
        <View style={[styles.nextButton, styles.checkingButton]}>
          <ActivityIndicator size="small" color="#ffffff" style={{marginRight: 10}} />
          <Text style={styles.nextButtonText}>Vérification des droits...</Text>
        </View>
      );
    }
    
    // Si l'utilisateur est l'hôte, montrer le bouton de passage au tour suivant
    if (isUserHost === true) {
      return (
        <TouchableOpacity
          style={[
            styles.nextButton, 
            (!canProceed || isButtonDisabled || isSynchronizing) && styles.disabledButton,
            isUserHost && styles.hostButton
          ]}
          onPress={handleNextRound}
          disabled={!canProceed || isButtonDisabled || isSynchronizing}
        >
          {isSynchronizing ? (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <ActivityIndicator size="small" color="#ffffff" style={{marginRight: 10}} />
              <Text style={styles.nextButtonText}>Synchronisation...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {isLastRound ? 'Voir les résultats finaux' : 'Tour suivant'}
              </Text>
              {!canProceed && (
                <Text style={styles.waitText}>Veuillez patienter...</Text>
              )}
            </>
          )}
        </TouchableOpacity>
      );
    }
    
    // Pour les joueurs normaux, afficher un message d'attente avec le même style
    return (
      <View style={[styles.nextButton, styles.disabledButton]}>
        <Text style={styles.nextButtonText}>
          En attente que l'hôte passe au tour suivant
        </Text>
        <MaterialCommunityIcons name="timer-sand" size={18} color="#b3a5d9" style={{marginTop: 4}} />
      </View>
    );
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
          {answers && answers.length > 0 ? (
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
                { answer.votesCount > 0 && (
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
              .map(([playerId, score], index) => {
                // Trouver le joueur correspondant à cet ID
                const player = players.find(p => p.id === playerId.toString() || p.id === Number(playerId));
                const playerName = player ? (player.name || player.displayName || player.username || "Joueur inconnu") : "Joueur inconnu";
                
                return (
                  <View key={playerId} style={styles.scoreRow}>
                    <Text style={styles.scoreRank}>{index + 1}</Text>
                    <Text style={styles.scoreName}>{playerName}</Text>
                    <Text style={styles.scoreValue}>{score} pts</Text>
                  </View>
                );
              })
          ) : (
            <Text style={styles.noAnswersText}>Aucun score à afficher</Text>
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
});

export default ResultsPhase;
