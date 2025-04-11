import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QuestionPhase from '../../components/game/QuestionPhase';
import AnswerPhase from '../../components/game/AnswerPhase';
import VotePhase from '../../components/game/VotePhase';
import ResultsPhase from '../../components/game/ResultsPhase';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import { useAuth } from '../../contexts/AuthContext';
import { Player, GamePhase, GameState, Answer, Question } from '../../types/gameTypes';
import gameService from '../../services/queries/game';
import SocketService from '@/services/socketService';
import axios from 'axios';
import GameTimer from '../../components/game/GameTimer';

export default function GameScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [gameState, setGameState] = useState<GameState>({
    phase: GamePhase.LOADING,
    currentRound: 1,
    totalRounds: 5,
    targetPlayer: null,
    currentQuestion: null,
    answers: [],
    players: [],
    scores: {},
    theme: 'standard',
    timer: null,
  });
  
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fetchGameData = useCallback(async () => {
    try {
      console.log(`🎮 Récupération des données du jeu ${id}...`);
      
      const gameData = await gameService.getGameState(id as string);
      console.log('✅ Données du jeu récupérées:', gameData);
      
      if (!isReady) {
        try {
          console.log(`🎮 Tentative de rejoindre le canal WebSocket pour le jeu ${id}`);
          SocketService.joinGameChannel(id as string);
          console.log(`✅ Demande WebSocket pour rejoindre le jeu ${id} envoyée`);
        } catch (socketError) {
          console.error('⚠️ Erreur lors de la connexion WebSocket au jeu:', socketError);
        }
      }
      
      const currentUser = user?.id;
      
      const targetPlayer = gameData.currentQuestion?.targetPlayer 
        ? {
            id: gameData.currentQuestion.targetPlayer.id.toString(),
            name: gameData.currentQuestion.targetPlayer.displayName || gameData.currentQuestion.targetPlayer.username || 'Joueur',
            avatar: gameData.currentQuestion.targetPlayer.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg',
          }
        : null;
      
      const currentQuestion = gameData.currentQuestion 
        ? {
            id: gameData.currentQuestion.id,
            text: gameData.currentQuestion.text || 'Question en préparation...',
            theme: gameData.game.gameMode,
            roundNumber: gameData.currentQuestion.roundNumber,
          }
        : null;
      
      const isTargetPlayer = gameData.currentUserState?.isTargetPlayer;
      
      let effectivePhase = GamePhase.WAITING;
      if (gameData.game.currentPhase === 'question') {
        effectivePhase = GamePhase.QUESTION;
      } else if (gameData.game.currentPhase === 'answer') {
        if (isTargetPlayer || gameData.currentUserState?.hasAnswered) {
          effectivePhase = GamePhase.WAITING;
        } else {
          effectivePhase = GamePhase.ANSWER;
        }
      } else if (gameData.game.currentPhase === 'vote') {
        if (gameData.currentUserState?.hasVoted) {
          effectivePhase = GamePhase.WAITING;
        } else {
          effectivePhase = GamePhase.VOTE;
        }
      } else if (gameData.game.currentPhase === 'results') {
        effectivePhase = GamePhase.RESULTS;
      } else {
        effectivePhase = GamePhase.WAITING;
      }
      
      setGameState({
        phase: effectivePhase,
        currentRound: gameData.game.currentRound || 1,
        totalRounds: gameData.game.totalRounds || 5,
        targetPlayer: targetPlayer,
        currentQuestion: currentQuestion,
        answers: gameData.answers || [],
        players: gameData.players || [],
        scores: gameData.game.scores || {},
        theme: gameData.game.gameMode || 'standard',
        timer: gameData.timer || null,
        currentUserState: gameData.currentUserState || {},
      });
      
      setIsReady(true);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des données du jeu:', error);
      
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setLoadingError('Partie introuvable. Elle est peut-être terminée ou n\'existe pas.');
      } else if (axios.isAxiosError(error) && error.response?.status === 401) {
        setLoadingError('Session expirée. Veuillez vous reconnecter.');
        setTimeout(() => {
          router.replace('/auth/login');
        }, 2000);
      } else {
        setLoadingError('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
      }
    }
  }, [id, isReady, user]);
  
  useEffect(() => {
    fetchGameData();
    
    const socket = SocketService.getInstance();
    socket.on('game:update', (data) => {
      console.log('🎮 Mise à jour du jeu reçue:', data);
      
      if (data.type === 'phase_change') {
        console.log(`🎮 Changement de phase: ${data.phase}`);
        
        if (data.timer) {
          console.log(`⏱️ Timer reçu: ${data.timer.duration}s`);
          setGameState(prev => ({
            ...prev,
            timer: data.timer
          }));
        }
        
        fetchGameData();
      } else if (data.type === 'new_round') {
        console.log(`🎮 Nouveau tour: ${data.round}`);
        fetchGameData();
      } else if (data.type === 'new_answer' || data.type === 'new_vote') {
        fetchGameData();
      }
    });
    
    const refreshInterval = setInterval(fetchGameData, 15000);
    
    return () => {
      clearInterval(refreshInterval);
      if (id) {
        try {
          SocketService.leaveGameChannel(id as string);
          console.log(`✅ Canal de jeu WebSocket ${id} quitté`);
        } catch (error) {
          console.error('⚠️ Erreur lors de la déconnexion WebSocket:', error);
        }
      }
      
      socket.off('game:update');
    };
  }, [id, user, router, fetchGameData]);
  
  const handleSubmitAnswer = async (answer: string) => {
    if (!user || !gameState.currentQuestion) return;
    
    // BLOCAGE CRITIQUE: Empêcher la soumission si l'utilisateur est la cible
    if (gameState.currentUserState?.isTargetPlayer) {
      console.log("❌ Soumission bloquée: l'utilisateur est la cible de la question");
      Alert.alert(
        "Action impossible", 
        "Vous êtes la cible de cette question et ne pouvez pas y répondre."
      );
      return;
    }
    
    try {
      console.log("🎮 Tentative de soumission de réponse...");
      
      // Désactiver les interactions pendant la soumission
      setIsSubmitting(true);
      
      await gameService.submitAnswer(id as string, gameState.currentQuestion.id, answer);
      
      Alert.alert("Réponse envoyée", "En attente des autres joueurs...");
      
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.WAITING,
      }));
      
      // Recharger les données après la soumission
      setTimeout(() => {
        fetchGameData();
      }, 1000);
    } catch (error) {
      console.error("❌ Erreur lors de la soumission de la réponse:", error);
      
      let errorMessage = "Impossible d'envoyer votre réponse. Veuillez réessayer.";
      if (error.message && typeof error.message === 'string' && error.message.includes("Ce n'est pas le moment")) {
        errorMessage = "Le délai de réponse est écoulé. Veuillez attendre la prochaine question.";
        
        // Forcer une mise à jour des données du jeu
        fetchGameData();
      }
      
      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsSubmitting(false); // Toujours réactiver les interactions
    }
  };
  
  const handleVote = async (answerId: string) => {
    if (!gameState.currentQuestion) {
      Alert.alert("Erreur", "Question non disponible");
      return;
    }
    
    try {
      console.log("🎮 Tentative de vote pour la réponse ID:", answerId);
      
      await gameService.submitVote(id as string, answerId, gameState.currentQuestion.id.toString());
      
      Alert.alert("Vote enregistré", "En attente des résultats...");
      
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.WAITING,
      }));
    } catch (error) {
      console.error("❌ Erreur lors du vote:", error);
      Alert.alert("Erreur", "Impossible d'enregistrer votre vote. Veuillez réessayer.");
    }
  };
  
  const handleNextRound = async () => {
    if (gameState.currentRound >= gameState.totalRounds) {
      router.push(`/game/results/${id}`);
      return;
    }
    
    try {
      console.log("🎮 Tentative de passage au tour suivant...");
      
      // Désactiver les interactions pendant le traitement
      setIsSubmitting(true);
      
      await gameService.nextRound(id as string);
      
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.LOADING,
      }));
      
      // Recharger les données après un délai pour donner au backend le temps de traiter
      setTimeout(() => {
        if (typeof fetchGameData === 'function') {
          fetchGameData();
        }
      }, 1500);
      
    } catch (error) {
      console.error("❌ Erreur lors du passage au tour suivant:", error);
      Alert.alert(
        "Erreur", 
        "Impossible de passer au tour suivant. Veuillez réessayer.",
        [
          {
            text: 'OK',
            onPress: () => {
              // Recharger les données pour synchroniser l'état
              if (typeof fetchGameData === 'function') {
                fetchGameData();
              }
            }
          }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleQuitGame = () => {
    Alert.alert(
      'Quitter la partie',
      'Êtes-vous sûr de vouloir quitter cette partie ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: () => router.push('/'),
        },
      ]
    );
  };
  
  const renderGamePhase = () => {
    switch (gameState.phase) {
      case GamePhase.LOADING:
        return <LoadingOverlay message="Préparation de la partie" />;
        
      case GamePhase.QUESTION:
        if (!gameState.targetPlayer || !gameState.currentQuestion) {
          return <LoadingOverlay message="Chargement des données de jeu..." />;
        }
        return (
          <QuestionPhase 
            question={gameState.currentQuestion}
            targetPlayer={gameState.targetPlayer}
            onSubmit={handleSubmitAnswer}
            round={gameState.currentRound}
            totalRounds={gameState.totalRounds}
            timer={gameState.timer}
          />
        );
      
      case GamePhase.ANSWER:
        if (!gameState.currentQuestion) {
          return <LoadingOverlay message="Chargement de la question..." />;
        }
        
        // Vérification plus stricte pour la cible de la question
        const isTarget = Boolean(gameState.currentUserState?.isTargetPlayer);
        
        if (isTarget) {
          console.log("🎯 Utilisateur identifié comme cible de la question - affichage message spécial");
          return (
            <View style={styles.messageContainer}>
              <Text style={styles.messageTitle}>Cette question est à propos de vous</Text>
              <Text style={styles.messageText}>
                Vous ne pouvez pas répondre à une question qui vous concerne.
                Regardez les réponses des autres joueurs.
              </Text>
              {gameState.timer && (
                <View style={styles.timerContainer}>
                  <GameTimer 
                    duration={gameState.timer.duration}
                    startTime={gameState.timer.startTime}
                  />
                </View>
              )}
            </View>
          );
        }

        // Utilisateur a déjà répondu, montrer un message d'attente
        if (gameState.currentUserState && gameState.currentUserState.hasAnswered) {
          return (
            <View style={styles.messageContainer}>
              <Text style={styles.messageTitle}>Réponse envoyée</Text>
              <Text style={styles.messageText}>
                Votre réponse a été enregistrée avec succès. Attendez que les autres joueurs terminent.
              </Text>
              {gameState.timer && (
                <View style={styles.timerContainer}>
                  <GameTimer 
                    duration={gameState.timer.duration}
                    startTime={gameState.timer.startTime}
                  />
                </View>
              )}
            </View>
          );
        }
        
        // Cas normal: l'utilisateur peut répondre
        return (
          <AnswerPhase
            question={gameState.currentQuestion}
            onSubmit={handleSubmitAnswer}
            timer={gameState.timer}
            isSubmitting={isSubmitting}
          />
        );
        
      case GamePhase.WAITING:
        return (
          <LoadingOverlay 
            message={`Attente des autres joueurs...`}
          />
        );
        
      case GamePhase.VOTE:
        if (!gameState.currentQuestion) {
          return <LoadingOverlay message="Chargement des données de vote..." />;
        }
        return (
          <VotePhase 
            answers={gameState.answers}
            question={gameState.currentQuestion}
            onVote={handleVote}
            timer={gameState.timer}
          />
        );
        
      case GamePhase.RESULTS:
        if (!gameState.targetPlayer || !gameState.currentQuestion) {
          return <LoadingOverlay message="Chargement des résultats..." />;
        }
        return (
          <ResultsPhase 
            answers={gameState.answers}
            scores={gameState.scores}
            players={gameState.players}
            question={gameState.currentQuestion}
            targetPlayer={gameState.targetPlayer}
            onNextRound={handleNextRound}
            isLastRound={gameState.currentRound >= gameState.totalRounds}
            timer={gameState.timer}
          />
        );
        
      default:
        return <Text>Erreur: Phase de jeu inconnue</Text>;
    }
  };
  
  if (!isReady) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a0933', '#321a5e']}
          style={styles.background}
        />
        <LoadingOverlay message={loadingError || "Chargement de la partie..."} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1a0933', '#321a5e']}
        style={styles.background}
      />
      
      <View style={styles.content}>
        {renderGamePhase()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left:0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 40,
  },
  messageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  messageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 16,
    color: '#e0e0e0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  timerContainer: {
    width: '100%',
    padding: 10,
  },
});
