import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
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
import gameDebugger from '../../utils/gameDebugger';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      
      // Assurer que l'ID utilisateur est disponible dans les en-têtes API 
      try {
        if (user && user.id) {
          api.defaults.headers.userId = user.id;
          console.log(`👤 ID utilisateur ${user.id} défini dans les headers API`);
        } else {
          // Essayer de récupérer l'ID utilisateur depuis AsyncStorage
          const storedUserId = await AsyncStorage.getItem('@current_user_id');
          if (storedUserId) {
            api.defaults.headers.userId = storedUserId;
            console.log(`👤 ID utilisateur ${storedUserId} récupéré depuis AsyncStorage`);
          } else {
            console.warn('⚠️ ID utilisateur non disponible dans les en-têtes ni dans AsyncStorage');
          }
        }
      } catch (err) {
        console.warn('⚠️ Erreur lors de la définition/récupération de l\'ID utilisateur:', err);
      }
      
      // S'assurer que la connection WebSocket est active
      await gameService.ensureSocketConnection(id as string);
      
      const gameData = await gameService.getGameState(id as string);
      console.log('✅ Données du jeu récupérées:', gameData);
      
      if (!isReady) {
        try {
          console.log(`🎮 Tentative de rejoindre le canal WebSocket pour le jeu ${id}`);
          await SocketService.joinGameChannel(id as string);
          console.log(`✅ Demande WebSocket pour rejoindre le jeu ${id} envoyée`);
        } catch (socketError) {
          console.error('⚠️ Erreur lors de la connexion WebSocket au jeu:', socketError);
          // Ne pas bloquer le chargement du jeu si la connexion WebSocket échoue
        }
      }
      
      const targetPlayer = gameData.currentQuestion?.targetPlayer 
        ? {
            id: String(gameData.currentQuestion.targetPlayer.id),
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
      
      // CORRECTION CRITIQUE: Garantir que la comparaison est effectuée avec des chaînes
      // Note: nous utilisons l'état corrigé du service pour sécuriser cette partie
      const isTargetPlayer = gameData.currentUserState?.isTargetPlayer || false;
      
      // Vérification supplémentaire de cohérence
      const userIdStr = String(user?.id || '');
      const targetIdStr = targetPlayer ? String(targetPlayer.id) : '';
      const detectedAsTarget = userIdStr === targetIdStr;
      
      if (detectedAsTarget !== isTargetPlayer) {
        console.warn(`⚠️ Incohérence entre la détection locale (${detectedAsTarget}) et l'état du serveur (${isTargetPlayer})`);
        console.log(`🔍 Détails - ID utilisateur: ${userIdStr}, ID cible: ${targetIdStr}`);
      }

      // Déterminer la phase effective en fonction de l'état du jeu et du joueur
      let effectivePhase = GamePhase.WAITING;
      
      if (gameData.game.currentPhase === 'question') {
        effectivePhase = GamePhase.QUESTION;
      } else if (gameData.game.currentPhase === 'answer') {
        // En phase de réponse, le joueur cible doit toujours être en attente
        if (isTargetPlayer) {
          effectivePhase = GamePhase.WAITING;
          console.log("👀 Joueur cible en attente pendant la phase de réponse");
        } else if (gameData.currentUserState?.hasAnswered) {
          effectivePhase = GamePhase.WAITING;
          console.log("✓ Joueur a déjà répondu, en attente");
        } else {
          effectivePhase = GamePhase.ANSWER;
          console.log("📝 Joueur doit répondre");
        }
      } else if (gameData.game.currentPhase === 'vote') {
        // En phase de vote, seul le joueur cible peut voter
        if (isTargetPlayer) {
          effectivePhase = GamePhase.VOTE;
          console.log("🎯 Joueur ciblé entre en phase de vote");
        } else {
          effectivePhase = GamePhase.WAITING;
          console.log("⏱️ Joueur non-cible en attente pendant que le joueur ciblé vote");
        }
      } else if (gameData.game.currentPhase === 'results') {
        effectivePhase = GamePhase.RESULTS;
        console.log("🎯 Affichage des résultats");
      }

      console.log(`🎮 Phase effective pour l'UI: ${effectivePhase}, Phase serveur: ${gameData.game.currentPhase}`);
      
      // Construction du nouvel état du jeu
      const newGameState: GameState = {
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
        currentUserState: {
          ...gameData.currentUserState,
          isTargetPlayer  // Utiliser notre valeur calculée qui est fiable
        },
        game: gameData.game
      };
      
      // Analyser l'état du jeu pour détecter d'éventuels problèmes
      const targetPlayerCheck = gameDebugger.debugTargetPlayerState(newGameState, user?.id);
      gameDebugger.analyzeGameState(newGameState);
      
      // Si une incohérence est détectée, corriger l'état du jeu
      if (targetPlayerCheck?.hasInconsistency && targetPlayerCheck.correctValue !== undefined) {
        console.log('🔧 Correction automatique de l\'état isTargetPlayer appliquée');
        newGameState.currentUserState.isTargetPlayer = targetPlayerCheck.correctValue;
      }
      
      setGameState(newGameState);
      setIsReady(true);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des données du jeu:', error);
      
      // Gestion spécifique des erreurs
      const axiosError = error as any;
      if (axiosError?.response?.status === 404) {
        setLoadingError('Partie introuvable. Elle est peut-être terminée ou n\'existe pas.');
      } else if (axiosError?.response?.status === 401) {
        setLoadingError('Session expirée. Veuillez vous reconnecter.');
        setTimeout(() => {
          router.replace('/auth/login');
        }, 2000);
      } else if (axiosError?.message?.includes('Network Error')) {
        setLoadingError('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
        // Vérifier la connexion internet
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          // Si connecté à internet, le problème est probablement côté serveur
          console.log('🌐 Connexion internet détectée, problème probablement côté serveur.');
        }
      } else {
        setLoadingError('Une erreur est survenue. Veuillez réessayer.');
      }
    }
  }, [id, isReady, user]);
  
  useEffect(() => {
    fetchGameData();
    
    let refreshInterval: NodeJS.Timeout;
    let recoveryInterval: NodeJS.Timeout;
    
    // Initialisation asynchrone du socket
    const initSocket = async () => {
      try {
        const socket = await SocketService.getInstanceAsync();
        
        // Gestionnaire d'événements optimisé pour les mises à jour du jeu
        const handleGameUpdate = (data) => {
          console.log('🎮 Mise à jour du jeu reçue:', data);
          
          if (data.type === 'phase_change') {
            console.log(`🎮 Changement de phase: ${data.phase}`);
            
            // En cas de changement vers la phase vote, rafraîchir immédiatement pour obtenir les réponses
            if (data.phase === 'vote') {
              console.log("🎮 Changement vers phase 'vote' détecté - initialisation rafraîchissement");
              setTimeout(() => fetchGameData(), 500);
              return;
            }
            
            // Déterminer la nouvelle phase en fonction de l'état actuel et de la nouvelle phase serveur
            let newPhase;
            switch(data.phase) {
              case 'results':
                newPhase = GamePhase.RESULTS;
                break;
              case 'answer':
                if (gameState.currentUserState?.isTargetPlayer) {
                  newPhase = GamePhase.WAITING;
                } else {
                  newPhase = GamePhase.ANSWER;
                }
                break;
              case 'question':
                newPhase = GamePhase.QUESTION;
                break;
              default:
                newPhase = GamePhase.WAITING;
            }
            
            setGameState(prev => ({
              ...prev,
              phase: newPhase,
              timer: data.timer || prev.timer
            }));
            
            // Mettre à jour les réponses si fournies dans l'événement
            if (data.answers && Array.isArray(data.answers) && data.phase === 'vote') {
              setGameState(prev => ({
                ...prev,
                answers: data.answers.map(answer => ({
                  ...answer,
                  isOwnAnswer: answer.playerId === user?.id
                }))
              }));
              console.log(`✅ Réponses mises à jour: ${data.answers.length} réponses reçues`);
            }
            
            // Rafraîchir les données complètes après un court délai
            setTimeout(fetchGameData, 500);
          } else if (data.type === 'phase_reminder' || data.type === 'new_answer' || data.type === 'new_vote') {
            // Rafraîchir les données pour tout autre type d'événement important
            fetchGameData();
          }
        };
        
        socket.on('game:update', handleGameUpdate);
        socket.on('reconnect', () => {
          console.log('🔄 Socket reconnecté, rafraîchissement des données...');
          fetchGameData();
        });

        // Retourner les nettoyeurs d'événements
        return {
          cleanupEvents: () => {
            socket.off('game:update', handleGameUpdate);
            socket.off('reconnect');
          }
        };
      } catch (socketError) {
        console.error('❌ Erreur lors de l\'initialisation du socket:', socketError);
        return { cleanupEvents: () => {} };
      }
    };
    
    // Variable pour stocker les fonctions de nettoyage 
    let socketCleanup = { cleanupEvents: () => {} };
    
    // Initialiser le socket de manière asynchrone
    initSocket().then(cleanup => {
      socketCleanup = cleanup;
    });

    // Intervalle de récupération pour les cas où le jeu reste bloqué en phase d'attente
    recoveryInterval = setInterval(() => {
      const currentTime = Date.now();
      
      if (gameState.phase === GamePhase.WAITING && 
          (!gameState.timer || 
           (gameState.timer && currentTime > gameState.timer.startTime + (gameState.timer.duration * 1000) + 5000))) {
        console.log('⚠️ Détection possible blocage en phase d\'attente - forçage actualisation');
        fetchGameData();
      }
    }, 5000);
    
    // Intervalle de rafraîchissement normal pour garder les données à jour
    refreshInterval = setInterval(fetchGameData, 15000);
    
    return () => {
      clearInterval(refreshInterval);
      clearInterval(recoveryInterval);
      
      if (id) {
        try {
          SocketService.leaveGameChannel(id as string);
          console.log(`✅ Canal de jeu WebSocket ${id} quitté`);
        } catch (error) {
          console.error('⚠️ Erreur lors de la déconnexion WebSocket:', error);
        }
      }
      
      // Nettoyage des écouteurs d'événements
      socketCleanup.cleanupEvents();
    };
  }, [id, user, router, fetchGameData]);
  
  const handleSubmitAnswer = async (answer: string) => {
    if (!user || !gameState.currentQuestion) return;
    
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
      
      setIsSubmitting(true);
      
      await gameService.submitAnswer(id as string, gameState.currentQuestion.id, answer);
      
      Alert.alert("Réponse envoyée", "En attente des autres joueurs...");
      
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.WAITING,
        currentUserState: {
          ...prev.currentUserState,
          hasAnswered: true
        }
      }));
      
      setTimeout(() => {
        fetchGameData();
      }, 1000);
    } catch (error) {
      console.error("❌ Erreur lors de la soumission de la réponse:", error);
      
      let errorMessage = "Impossible d'envoyer votre réponse. Veuillez réessayer.";
      if (error.message && typeof error.message === 'string' && error.message.includes("Ce n'est pas le moment")) {
        errorMessage = "Le délai de réponse est écoulé. Veuillez attendre la prochaine question.";
        fetchGameData();
      }
      
      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsSubmitting(false);
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
    
    const validPhases = [GamePhase.RESULTS, GamePhase.VOTE];
    if (!validPhases.includes(gameState.phase)) {
      console.error(`❌ Tentative de passage au tour suivant dans une phase non autorisée: ${gameState.phase}`);
      Alert.alert(
        "Action impossible", 
        "Vous ne pouvez passer au tour suivant que pendant les phases de résultat ou de vote.",
        [{ text: "OK" }]
      );
      return;
    }
    
    try {
      console.log("🎮 Tentative de passage au tour suivant...");
      
      setIsSubmitting(true);
      
      await gameService.nextRound(id as string);
      
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.LOADING,
      }));
      
      setTimeout(() => {
        if (typeof fetchGameData === 'function') {
          fetchGameData();
        }
      }, 1500);
      
    } catch (error) {
      console.error("❌ Erreur lors du passage au tour suivant:", error);
      
      let errorMessage = "Impossible de passer au tour suivant.";
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("Ce n'est pas le moment")) {
          errorMessage = "Ce n'est pas encore le moment de passer au tour suivant. Veuillez attendre la fin de la phase actuelle.";
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        "Erreur", 
        errorMessage,
        [
          {
            text: 'Actualiser',
            onPress: () => {
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
        
        const isTargetInQuestionPhase = Boolean(gameState.currentUserState?.isTargetPlayer);
        
        if (isTargetInQuestionPhase) {
          console.log("🎯 Utilisateur identifié comme cible pendant la phase QUESTION - affichage message spécial");
          return (
            <View style={styles.messageContainer}>
              <Text style={styles.messageTitle}>Cette question est à propos de vous</Text>
              <Text style={styles.messageText}>
                Cette question vous concerne. Les autres joueurs sont en train de la lire et vont ensuite y répondre.
                Vous pourrez voir et voter pour leurs réponses plus tard.
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
        
        const isTarget = Boolean(gameState.currentUserState?.isTargetPlayer);
        
        if (isTarget) {
          console.log("🎯 Utilisateur identifié comme cible de la question - affichage message spécial");
          return (
            <View style={styles.messageContainer}>
              <Text style={styles.messageTitle}>Cette question est à propos de vous</Text>
              <Text style={styles.messageText}>
                Vous ne pouvez pas répondre à une question qui vous concerne.
                Attendez que les autres joueurs finissent de répondre.
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
        
        return (
          <AnswerPhase
            question={gameState.currentQuestion}
            onSubmit={handleSubmitAnswer}
            timer={gameState.timer}
            isSubmitting={isSubmitting}
            isTargetPlayer={isTarget}
          />
        );
        
      case GamePhase.WAITING:
        return (
          <View style={styles.waitingContainer}>
            <LoadingOverlay 
              message={`Attente des autres joueurs...`}
              showSpinner={true}
              retryFunction={fetchGameData}
            />
            {gameState.timer && (
              <View style={styles.timerContainer}>
                <GameTimer 
                  duration={gameState.timer.duration}
                  startTime={gameState.timer.startTime}
                  onComplete={() => {
                    fetchGameData();
                  }}
                />
              </View>
            )}
          </View>
        );
        
      case GamePhase.VOTE:
        if (!gameState.currentQuestion) {
          return <LoadingOverlay message="Chargement des données de vote..." />;
        }
        
        const isTargetPlayer = gameState.targetPlayer && user ? 
          (gameState.targetPlayer.id === user.id.toString()) : 
          Boolean(gameState.currentUserState?.isTargetPlayer);
        const hasVoted = Boolean(gameState.currentUserState?.hasVoted);
        
        gameDebugger.analyzeVotingState(gameState, user?.id);
        
        if (!isTargetPlayer) {
          console.log(`🔍 Phase VOTE - Utilisateur ${user?.id} n'est pas la cible (${gameState.targetPlayer?.id})`);
          
          if (hasVoted) {
            return (
              <View style={styles.messageContainer}>
                <Text style={styles.messageTitle}>Vote enregistré</Text>
                <Text style={styles.messageText}>
                  Votre vote a été enregistré avec succès. Attendez que le joueur ciblé fasse son choix.
                </Text>
                {gameState.timer && (
                  <View style={styles.timerContainer}>
                    <GameTimer 
                      duration={gameState.timer.duration}
                      startTime={gameState.timer.startTime}
                      onComplete={() => fetchGameData()}
                    />
                  </View>
                )}
              </View>
            );
          }
          
          return (
            <View style={styles.messageContainer}>
              <Text style={styles.messageTitle}>Phase de vote</Text>
              <Text style={styles.messageText}>
                {gameState.targetPlayer?.name} est en train de voter pour la meilleure réponse.
                Veuillez patienter...
              </Text>
              {gameState.timer && (
                <View style={styles.timerContainer}>
                  <GameTimer 
                    duration={gameState.timer.duration}
                    startTime={gameState.timer.startTime}
                  />
                </View>
              )}
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={fetchGameData}
              >
                <Text style={styles.refreshButtonText}>Actualiser</Text>
              </TouchableOpacity>
            </View>
          );
        }
        
        console.log(`🎯 Phase VOTE - Utilisateur ${user?.id} EST la cible. Affichage interface de vote.`);
        
        return (
          <VotePhase 
            answers={gameState.answers.filter(answer => !answer.isOwnAnswer)}
            question={gameState.currentQuestion}
            onVote={handleVote}
            timer={gameState.timer}
            isTargetPlayer={true}
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
    left: 0,
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
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  refreshButton: {
    marginTop: 20,
    backgroundColor: 'rgba(93, 109, 255, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
