import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QuestionPhase from '@/components/game/QuestionPhase';
import AnswerPhase from '@/components/game/AnswerPhase';
import VotePhase from '@/components/game/VotePhase';
import ResultsPhase from '@/components/game/ResultsPhase';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import { useAuth } from '@/contexts/AuthContext';
import { Player, GamePhase, GameState, Answer, Question } from '@/types/gameTypes';
import gameService from '@/services/queries/game';
import SocketService from '@/services/socketService';
import api from '@/config/axios';
import NetInfo from '@react-native-community/netinfo';
import GameTimer from '@/components/game/GameTimer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserIdManager from '@/utils/userIdManager';

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
          await UserIdManager.setUserId(user.id);
          console.log(`👤 ID utilisateur ${user.id} défini dans les headers API`);
        } else {
          // Essayer de récupérer l'ID utilisateur depuis UserIdManager
          const storedUserId = await UserIdManager.getUserId();
          if (storedUserId) {
            console.log(`👤 ID utilisateur ${storedUserId} récupéré depuis UserIdManager`);
          } else {
            console.warn('⚠️ ID utilisateur non disponible dans les en-têtes ni dans UserIdManager');
          }
        }
      } catch (err) {
        console.warn('⚠️ Erreur lors de la définition/récupération de l\'ID utilisateur:', err);
      }
      
      // S'assurer que la connection WebSocket est active
      await gameService.ensureSocketConnection(id as string);
      
      const gameData = await gameService.getGameState(id as string);
      
      // Si gameData est un état minimal de récupération, essayer de forcer une vérification d'état
      if (gameData?.recovered) {
        console.log('⚠️ Récupération avec état minimal détectée, tentative de récupération complète...');
        try {
          const socket = await SocketService.getInstanceAsync();
          socket.emit('game:force_check', { gameId: id });
          console.log('🔄 Demande de vérification forcée envoyée');
        } catch (socketError) {
          console.error('❌ Erreur lors de la vérification forcée:', socketError);
        }
      } else {
        console.log('✅ Données du jeu récupérées avec succès');
      }
      
      if (!isReady) {
        try {
          console.log(`🎮 Tentative de rejoindre le canal WebSocket pour le jeu ${id}`);
          await SocketService.joinGameChannel(id as string);
          console.log(`✅ Demande WebSocket pour rejoindre le jeu ${id} envoyée`);
        } catch (socketError) {
          console.warn('⚠️ Erreur lors de la connexion WebSocket au jeu:', socketError);
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
      const effectivePhase = (() => {
        // Phase serveur reçue
        const serverPhase = gameData.game.currentPhase;
        const isTarget = isTargetPlayer; // Utiliser la variable corrigée
        const hasAnswered = gameData.currentUserState?.hasAnswered || false;
        const hasVoted = gameData.currentUserState?.hasVoted || false;

        // Log pour debug
        console.log(`🎮 Détermination phase - Serveur: ${serverPhase}, isTarget: ${isTarget}, hasAnswered: ${hasAnswered}, hasVoted: ${hasVoted}`);

        switch (serverPhase) {
          case 'question':
            return GamePhase.QUESTION;

          case 'answer':
            if (isTarget) {
              return GamePhase.WAITING;
            }
            return hasAnswered ? GamePhase.WAITING : GamePhase.ANSWER;

          case 'vote':
            // CORRECTION: Seul le joueur cible qui n'a pas encore voté doit voir l'écran de vote
            if (isTarget && !hasVoted) {
              return GamePhase.VOTE; // Le joueur cible doit voter
            } else if (!isTarget && !hasVoted) {
              // CORRECTION IMPORTANTE: Les autres joueurs ne votent pas dans cette phase, uniquement la cible
              // mais ils doivent quand même voir autre chose que l'écran d'attente
              return GamePhase.WAITING_FOR_VOTE;
            } else {
              // Pour les joueurs qui ont déjà voté, ils sont en attente
              return GamePhase.WAITING;
            }

          case 'results':
            return GamePhase.RESULTS;

          default:
            return GamePhase.WAITING;
        }
      })();

      // Afficher un log détaillé pour le débogage
      console.log(`🎮 Phase serveur: ${gameData.game.currentPhase}, Phase UI: ${effectivePhase}, isTarget: ${isTargetPlayer}, hasVoted: ${gameData.currentUserState?.hasVoted}`);
      
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
      
      // Vérifier si l'utilisateur est la cible et corriger si nécessaire
      const targetMismatch = detectedAsTarget !== isTargetPlayer;
      if (targetMismatch) {
        console.log('🔧 Correction automatique de l\'état isTargetPlayer appliquée');
        newGameState.currentUserState.isTargetPlayer = detectedAsTarget;
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
    
    const initSocket = async () => {
      try {
        // S'assurer que l'ID utilisateur est défini dans api avant tout
        if (user && user.id) {
          await UserIdManager.setUserId(user.id);
          console.log(`👤 [Socket Init] ID utilisateur ${user.id} défini`);
        } else {
          // Essayer de récupérer l'ID depuis le gestionnaire
          const storedId = await UserIdManager.getUserId();
          if (storedId) {
            console.log(`👤 [Socket Init] ID utilisateur ${storedId} récupéré du stockage`);
          }
        }
        
        const socket = await SocketService.getInstanceAsync();
        
        // Gestionnaire d'événements optimisé pour les mises à jour du jeu
        const handleGameUpdate = (data) => {
          console.log('🎮 Mise à jour du jeu reçue:', data);
          
          if (data.type === 'phase_change') {
            console.log(`🎮 Changement de phase: ${data.phase}`);
            
            // Mise à jour immédiate de l'état sans attente
            setGameState(prev => ({
              ...prev,
              phase: data.phase === 'answer' && prev.currentUserState?.isTargetPlayer 
                ? GamePhase.WAITING 
                : data.phase,
              game: {
                ...prev.game,
                currentPhase: data.phase
              },
              timer: data.timer || prev.timer
            }));
            
            // Rafraîchir les données après un court délai
            setTimeout(fetchGameData, 500);
          } else if (data.type === 'new_vote' || data.type === 'new_answer') {
            // Rafraîchissement plus rapide pour les votes et réponses
            setTimeout(fetchGameData, 300);
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

    // Réduire l'intervalle de rafraîchissement automatique
    refreshInterval = setInterval(fetchGameData, 15000); // 15 secondes au lieu de 45
    
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
      
      // Nettoyage des écouteurs d'événements
      socketCleanup.cleanupEvents();
    };
  }, [id, user, router, fetchGameData]);

  // Dans le composant GameScreen, modifions l'effet pour mieux gérer les blocages
  useEffect(() => {
    // Ne pas exécuter pendant le chargement initial
    if (!isReady || !gameState || !id) return;
    
    // Compteur pour les situations d'attente prolongées
    let waitingTime = 0;
    let unblockAttempted = false;
    
    // Vérifier si nous sommes dans une situation d'attente potentiellement bloquée
    const checkIfStuck = async () => {
      // Si nous sommes déjà en phase de vote ou de résultats, pas besoin de vérifier
      if ((gameState.phase !== 'waiting' && gameState.phase !== GamePhase.WAITING) || 
          (gameState.game?.currentPhase !== 'answer')) {
        waitingTime = 0;
        unblockAttempted = false;
        return;
      }
      
      // On incrémente le temps d'attente
      waitingTime += 5;
      
      // Après 15 secondes d'attente, vérifier si nous sommes bloqués
      if (waitingTime >= 15) {
        console.log(`⚠️ Situation d'attente prolongée détectée: ${waitingTime} secondes`);
        
        // Vérifier si nous sommes potentiellement bloqués en phase answer
        if (gameState.game?.currentPhase === 'answer') {
          const nonTargetPlayers = gameState.players?.filter(p => 
            p.id !== gameState.targetPlayer?.id
          ).length || 0;
          
          const answersCount = gameState.answers?.length || 0;
          
          // Si toutes les réponses sont disponibles mais nous sommes toujours en phase answer
          if (answersCount >= nonTargetPlayers && nonTargetPlayers > 0) {
            console.log(`⚠️ BLOCAGE DÉTECTÉ: Toutes les réponses (${answersCount}/${nonTargetPlayers}) sont fournies mais toujours en phase answer`);
            
            if (!unblockAttempted) {
              console.log(`🔓 Tentative de déblocage du jeu...`);
              unblockAttempted = true;
              
              try {
                // Tentative de récupération sans utiliser gameDebugger
                await SocketService.forcePhaseCheck(id as string);
                console.log(`✅ Demande de vérification de phase envoyée pour le jeu ${id}`);
                
                // Rafraîchir les données après un court délai
                setTimeout(() => {
                  fetchGameData();
                }, 2000);
                
                return;
              } catch (error) {
                console.error(`❌ Erreur lors de la tentative de déblocage:`, error);
              }
            }
          }
        }
        
        // Si après 15 secondes nous sommes toujours bloqués, forcer un rafraîchissement
        if (waitingTime >= 15) {
          console.log(`🔄 Forçage d'un rafraîchissement après attente prolongée (${waitingTime}s)`);
          fetchGameData();
          waitingTime = 0;
        }
      }
    };
    
    // Vérifier toutes les 5 secondes
    const stuckInterval = setInterval(checkIfStuck, 5000);
    
    return () => {
      clearInterval(stuckInterval);
    };
  }, [isReady, gameState, id, fetchGameData]);
  
  const handleSubmitAnswer = async (answer: string) => {
    // Vérifier l'ID utilisateur avant de soumettre
    const userId = await UserIdManager.getUserId();
    if (!userId) {
      console.warn('⚠️ ID utilisateur non disponible, tentative de récupération');
      if (user && user.id) {
        await UserIdManager.setUserId(user.id);
      }
    }
    
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
      
      // Assurer que la connexion WebSocket est bien établie
      await gameService.ensureSocketConnection(id as string);
      
      // Utiliser uniquement WebSocket pour soumettre la réponse
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
      
    } catch (error) {
      console.error("❌ Erreur lors de la soumission de la réponse:", error);
      
      // Analyse détaillée de l'erreur
      let errorMessage = "Impossible d'envoyer votre réponse. Veuillez réessayer.";
      
      if (error.message) {
        if (error.message.includes("cible de cette question")) {
          errorMessage = "Vous êtes la cible de cette question et ne pouvez pas y répondre.";
        } else if (error.message.includes("déjà répondu")) { 
          errorMessage = "Vous avez déjà répondu à cette question.";
          
          // Mettre à jour l'état pour refléter que l'utilisateur a déjà répondu
          setGameState(prev => ({
            ...prev,
            phase: GamePhase.WAITING,
            currentUserState: {
              ...prev.currentUserState,
              hasAnswered: true
            }
          }));
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsSubmitting(false);
      
      // Rafraîchir les données après un court délai
      setTimeout(() => {
        fetchGameData();
      }, 1500);
    }
  };
  
  const handleVote = async (answerId: string) => {
    if (!gameState.currentQuestion) {
      Alert.alert("Erreur", "Question non disponible");
      return;
    }
    
    try {
      console.log("🎮 Tentative de vote pour la réponse ID:", answerId);
      setIsSubmitting(true);
      
      // Assurer que la connexion WebSocket est bien établie
      await gameService.ensureSocketConnection(id as string);
      
      await gameService.submitVote(id as string, answerId, gameState.currentQuestion.id.toString());
      
      Alert.alert("Vote enregistré", "En attente des résultats...");
      
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.WAITING,
        currentUserState: {
          ...prev.currentUserState,
          hasVoted: true
        }
      }));
    } catch (error) {
      console.error("❌ Erreur lors du vote:", error);
      Alert.alert("Erreur", "Impossible d'enregistrer votre vote. Veuillez réessayer.");
    } finally {
      setIsSubmitting(false);
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
    // S'assurer que nous avons un état de jeu valide
    if (!gameState || !gameState.phase) {
      return <LoadingOverlay message="Chargement de la partie..." />;
    }

    // Pour le débogage : afficher des informations sur la phase actuelle
    console.log(`🎮 Rendu de la phase: ${gameState.phase} (serveur: ${gameState.game?.currentPhase})`);
    console.log(`👤 État joueur: isTarget=${gameState.currentUserState?.isTargetPlayer}, hasVoted=${gameState.currentUserState?.hasVoted}`);

    // Ne pas autoriser de changement d'interface pendant la phase resultats
    if (gameState.phase === GamePhase.RESULTS) {
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
    }

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
                  onComplete={() => fetchGameData()}
                />
              </View>
            )}
          </View>
        );
          
      case GamePhase.VOTE:
        if (!gameState.currentQuestion) {
          return <LoadingOverlay message="Chargement des données de vote..." />;
        }
        
        // CORRECTION: S'assurer que le composant VotePhase reçoit les bonnes props
        const isTargetPlayer = Boolean(gameState.currentUserState?.isTargetPlayer);
        const hasVoted = Boolean(gameState.currentUserState?.hasVoted);
        
        // Log critique pour débogage
        console.log(`🎯 Phase VOTE - Utilisateur ${user?.id} ${isTargetPlayer ? 'EST' : "n'est pas"} la cible. hasVoted=${hasVoted}`);
        
        return (
          <VotePhase 
            answers={gameState.answers.filter(answer => !answer.isOwnAnswer)}
            question={gameState.currentQuestion}
            onVote={handleVote}
            timer={gameState.timer}
            isTargetPlayer={isTargetPlayer}
            hasVoted={hasVoted}
          />
        );
          
      case GamePhase.WAITING_FOR_VOTE:
        // Nouvel écran pour les non-cibles pendant la phase de vote
        return (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingTitle}>C'est au tour de {gameState.targetPlayer?.name} de voter !</Text>
            <Text style={styles.waitingText}>
              {gameState.targetPlayer?.name} est en train de choisir sa réponse préférée.
            </Text>
            <LoadingOverlay 
              message="Attente du vote..."
              showSpinner={true}
              retryFunction={fetchGameData}
            />
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
          
      default:
        return <Text>Erreur: Phase de jeu inconnue</Text>;
    }
  };

  const loadGame = async (gameId: string) => {
    try {
      const gameData = await gameService.getGameState(gameId);
      
      if (gameData.game.currentPhase === 'results') {
        // Forcer l'affichage des résultats pour tous les joueurs
        setGameState(prev => ({
          ...prev,
          ...gameData,
          phase: GamePhase.RESULTS,
        }));
      } else {
        setGameState(prev => ({
          ...prev,
          ...gameData,
        }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
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
  waitingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  waitingText: {
    fontSize: 16,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 20,
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
