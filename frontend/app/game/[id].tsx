import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QuestionPhase from '@/components/game/QuestionPhase';
import VotePhase from '@/components/game/VotePhase';
import ResultsPhase from '@/components/game/ResultsPhase';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import { useAuth } from '@/contexts/AuthContext';
import { Player, GamePhase, GameState, Answer, Question } from '@/types/gameTypes';
import gameService from '@/services/queries/game';
import SocketService from '@/services/socketService';
import api, { API_URL } from '@/config/axios';
import axios from 'axios';
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
      const determineEffectivePhase = (serverPhase: string, isTarget: boolean, hasAnswered: boolean, hasVoted: boolean): GamePhase => {
        console.log(`🎮 Détermination phase - Serveur: ${serverPhase}, isTarget: ${isTarget}, hasAnswered: ${hasAnswered}, hasVoted: ${hasVoted}`);
      
        // Validation de la phase pour éviter les erreurs
        if (!serverPhase || typeof serverPhase !== 'string') {
          console.warn(`⚠️ Phase invalide reçue: ${serverPhase}`);
          return GamePhase.WAITING;
        }
      
        switch (serverPhase) {
          case 'question':
            return isTarget ? GamePhase.WAITING : GamePhase.QUESTION;
      
          case 'answer':
            if (isTarget) return GamePhase.WAITING;
            return hasAnswered ? GamePhase.WAITING : GamePhase.ANSWER;
      
          case 'vote':
            if (isTarget && !hasVoted) return GamePhase.VOTE;
            return GamePhase.WAITING_FOR_VOTE;
      
          case 'results':
            return GamePhase.RESULTS;
            
          case 'finished':
            return GamePhase.FINISHED;
          
          case 'waiting':
            return GamePhase.WAITING;
      
          default:
            console.warn(`⚠️ Phase serveur non reconnue: ${serverPhase}, utilisation de WAITING comme fallback`);
            return GamePhase.WAITING;
        }
      };

      const effectivePhase = determineEffectivePhase(
        gameData.game.currentPhase,
        isTargetPlayer,
        gameData.currentUserState?.hasAnswered || false,
        gameData.currentUserState?.hasVoted || false
      );

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
          
          if (data.instantTransition) {
            console.log('⚡ Transition instantanée détectée, mise à jour immédiate');
          }
          
          if (data.type === 'phase_change') {
            console.log(`🎮 Changement de phase: ${data.phase}`);
            
            // Mise à jour immédiate de l'état sans attente
            setGameState(prev => ({
              ...prev,
              phase: PhaseManager.determineEffectivePhase(
                data.phase,
                prev.currentUserState?.isTargetPlayer || false,
                prev.currentUserState?.hasAnswered || false,
                prev.currentUserState?.hasVoted || false
              ),
              game: {
                ...prev.game,
                currentPhase: data.phase
              },
              // Suppression des timers pour un jeu instantané
              timer: null
            }));
            
            // Rafraîchir les données immédiatement
            fetchGameData();
          } else if (data.type === 'new_vote' || data.type === 'new_answer') {
            // Rafraîchissement immédiat pour les votes et réponses
            fetchGameData();
          } else if (data.type === 'new_round') {
            // Passage immédiat au nouveau tour
            setGameState(prev => ({
              ...prev,
              phase: PhaseManager.determineEffectivePhase(
                'question',
                data.question?.targetPlayer?.id === String(user?.id),
                false,
                false
              ),
              currentRound: data.round,
              currentQuestion: data.question,
              // Assurer que la cible est correctement identifiée
              currentUserState: {
                ...prev.currentUserState,
                isTargetPlayer: data.question?.targetPlayer?.id === String(user?.id),
                hasAnswered: false,
                hasVoted: false
              },
              game: {
                ...prev.game,
                currentPhase: 'question',
                currentRound: data.round
              },
              // Pas de timer pour un jeu instantané
              timer: null
            }));
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

    // Rafraîchir les données du jeu régulièrement mais à un intervalle réduit
    const refreshInterval = setInterval(fetchGameData, 5000); // 5 secondes pour maintenir la synchronisation
    
    return () => {
      clearInterval(refreshInterval);
      
      if (id) {
        try {
          // Utiliser la nouvelle méthode leaveGameChannel
          SocketService.leaveGameChannel(id as string)
            .then(() => console.log(`✅ Canal de jeu WebSocket ${id} quitté avec succès`))
            .catch(err => {
              console.error(`⚠️ Erreur lors de la déconnexion WebSocket:`, err);
              console.log(`🧹 Effectuant un nettoyage manuel des salles de jeu...`);
            });
        } catch (error) {
          console.error(`⚠️ Erreur lors de la déconnexion WebSocket:`, error);
        }
      }
      
      // Nettoyage des écouteurs d'événements
      socketCleanup.cleanupEvents();
    };
  }, [id, user, router, fetchGameData]);

  // Dans le composant GameScreen, ajoutons un effet pour détecter les blocages
  useEffect(() => {
    // Ne pas exécuter pendant le chargement initial
    if (!isReady || !gameState || !id) return;
    
    // Fonction de vérification périodique de blocage
    const checkGameProgress = async () => {
      try {
        // Si le gameState a une phase "question" mais l'utilisateur a déjà répondu
        if (gameState.phase === GamePhase.QUESTION && gameState.currentUserState?.hasAnswered) {
          console.log(`🔄 Détection d'incohérence: en phase QUESTION mais a déjà répondu`);
          
          const { checkPhaseAfterAnswer } = await import('@/utils/socketTester');
          const result = await checkPhaseAfterAnswer(id as string);
          
          if (result) {
            console.log(`🔄 Correction appliquée, rafraîchissement des données...`);
            setTimeout(() => fetchGameData(), 500);
          }
        }
        
        // Si phase 'waiting' pendant trop longtemps, vérifier l'état
        if (gameState.phase === GamePhase.WAITING || gameState.phase === GamePhase.WAITING_FOR_VOTE) {
          const { checkAndUnblockGame } = await import('@/utils/socketTester');
          const result = await checkAndUnblockGame(id as string);
          
          if (result) {
            console.log(`🔄 Blocage potentiel corrigé, rafraîchissement des données...`);
            setTimeout(() => fetchGameData(), 500);
          }
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la vérification de progression:`, error);
      }
    };
    
    // Vérifier immédiatement en cas de hasAnswered en phase Question
    if (gameState.phase === GamePhase.QUESTION && gameState.currentUserState?.hasAnswered) {
      checkGameProgress();
    }
    
    // Vérifier périodiquement les blocages potentiels
    const progressCheck = setInterval(checkGameProgress, 10000); // toutes les 10 secondes
    
    return () => {
      clearInterval(progressCheck);
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
      console.log("🎮 Tentative de soumission de réponse via WebSocket...");
      setIsSubmitting(true);
      
      // Assurer que la connexion WebSocket est bien établie
      await gameService.ensureSocketConnection(id as string);
      
      // Attendre un bref moment pour que la connexion WebSocket soit stable
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Ajout d'un log pour vérifier ce qui est envoyé
      console.log(`🔍 Paramètres de soumission - gameId: ${id}, questionId: ${gameState.currentQuestion.id}, réponse: ${answer.substring(0, 20)}...`);
      
      // Utiliser la méthode WebSocket optimisée avec gestion d'erreur améliorée
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
      
      // Rafraîchir les données après un court délai pour refléter les changements
      setTimeout(() => {
        fetchGameData();
      }, 1000);
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
      
      // Attendre un bref moment pour que la connexion soit stable
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Ajout d'un log pour vérifier ce qui est envoyé
      console.log(`🔍 Paramètres de vote - gameId: ${id}, answerId: ${answerId}, questionId: ${gameState.currentQuestion.id}`);
      
      // Utiliser la méthode WebSocket optimisée
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
      
      // Analyse détaillée de l'erreur
      let errorMessage = "Impossible d'enregistrer votre vote. Veuillez réessayer.";
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsSubmitting(false);
      
      // Rafraîchir les données après un court délai pour refléter les changements
      setTimeout(() => {
        fetchGameData();
      }, 1000);
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
      console.log("🎮 Tentative de passage au tour suivant via HTTP...");
      setIsSubmitting(true);
      
      const userId = await UserIdManager.getUserId();
      
      // Utiliser directement HTTP sans tenter d'abord via WebSocket
      try {
        const response = await api.post(`/games/${id}/next-round`, { 
          user_id: userId,
          force_advance: true 
        }, { 
          headers: { 'X-Direct-HTTP': 'true' },
          timeout: 10000
        });
        
        if (response.data?.status === 'success') {
          console.log("✅ Passage au tour suivant réussi via HTTP");
          Alert.alert("Succès", "Passage au tour suivant effectué!");
          
          // Forcer une mise à jour des données du jeu
          setTimeout(() => fetchGameData(), 1000);
        } else {
          throw new Error(response.data?.message || "La requête HTTP a échoué");
        }
      } catch (error) {
        console.error("❌ Erreur lors du passage au tour suivant:", error);
        
        // En cas d'échec, nouvelle tentative avec des paramètres légèrement différents
        try {
          console.log("🔄 Seconde tentative HTTP avec paramètres alternatifs...");
          
          const retryResponse = await api.post(`/games/${id}/next-round`, { 
            user_id: userId,
            force_advance: true,
            retry: true
          }, { 
            headers: { 'X-Retry': 'true' },
            timeout: 15000
          });
          
          if (retryResponse.data?.status === 'success') {
            console.log("✅ Passage au tour suivant réussi via seconde tentative HTTP");
            Alert.alert("Succès", "Passage au tour suivant effectué via méthode alternative!");
            
            // Forcer une mise à jour des données du jeu
            setTimeout(() => fetchGameData(), 1500);
          } else {
            throw new Error("Échec de toutes les tentatives");
          }
        } catch (retryError) {
          console.error("❌ Échec de la seconde tentative:", retryError);
          Alert.alert(
            "Erreur",
            "Impossible de passer au tour suivant. Veuillez réessayer.",
            [{ text: "OK" }]
          );
        }
      }
    } catch (outerError) {
      console.error("❌ Erreur externe:", outerError);
      Alert.alert("Erreur", "Une erreur inattendue s'est produite.");
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

    // Vérifier si la phase est valide
    const validPhases = Object.values(GamePhase);
    if (!validPhases.includes(gameState.phase as GamePhase)) {
      console.error(`❌ Phase inconnue détectée lors du rendu: ${gameState.phase}`);
      // Utiliser une phase de secours adaptée au contexte
      return (
        <View style={styles.waitingContainer}>
          <Text style={styles.messageTitle}>Synchronisation en cours...</Text>
          <Text style={styles.messageText}>
            Le jeu est en cours de synchronisation. Veuillez patienter un instant.
          </Text>
        </View>
      );
    }

    // Ne pas autoriser de changement d'interface pendant la phase resultats
    if (gameState.phase === GamePhase.RESULTS) {
      // Stocker les informations d'hôte au cas où la salle serait supprimée plus tard
      if (gameState.game?.hostId) {
        try {
          AsyncStorage.setItem(`@game_host_${id}`, JSON.stringify({
            hostId: String(gameState.game.hostId),
            timestamp: Date.now()
          }));
          console.log(`💾 Informations d'hôte stockées localement pour le jeu ${id}`);
        } catch (error) {
          console.warn(`⚠️ Erreur lors du stockage des infos d'hôte:`, error);
        }
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
          gameId={id} // Passer l'ID du jeu directement
        />
      );
    }

    switch (gameState.phase) {
      case GamePhase.LOADING:
        return <LoadingOverlay message="Préparation de la partie" />;
          
      case GamePhase.QUESTION:
        if (gameState.currentUserState?.isTargetPlayer) {
          return (
            <View style={styles.waitingContainer}>
              <Text style={styles.messageTitle}>Cette question vous concerne !</Text>
              <Text style={styles.messageText}>
                Vous ne pouvez pas répondre car la question parle de vous. 
                Attendez que les autres joueurs répondent.
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
            isSubmitting={isSubmitting}
            hasAnswered={gameState.currentUserState?.hasAnswered}
          />
        );
          
      case GamePhase.WAITING:
        return (
          <View style={styles.waitingContainer}>
            <LoadingOverlay 
              message={`Attente des autres joueurs...`}
              showSpinner={true}
            />
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
          
      case GamePhase.VOTE:
        if (!gameState.currentQuestion) {
          return <LoadingOverlay message="Chargement des données de vote..." />;
        }
        
        const isTargetPlayer = Boolean(gameState.currentUserState?.isTargetPlayer);
        const hasVoted = Boolean(gameState.currentUserState?.hasVoted);
        
        console.log(`🎯 Phase VOTE - Utilisateur ${user?.id} ${isTargetPlayer ? 'EST' : "n'est pas"} la cible. hasVoted=${hasVoted}`);
        
        if (isTargetPlayer && !hasVoted) {
          return (
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 18, textAlign: 'center', marginTop: 10, marginBottom: 10 }}>
                C'est votre tour de voter!
              </Text>
              <VotePhase 
                answers={gameState.answers.filter(answer => !answer.isOwnAnswer)}
                question={gameState.currentQuestion}
                onVote={handleVote}
                timer={gameState.timer}
                isTargetPlayer={true}
                hasVoted={false}
              />
            </View>
          );
        }
        
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
        return (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingTitle}>C'est au tour de {gameState.targetPlayer?.name} de voter !</Text>
            <Text style={styles.waitingText}>
              {gameState.targetPlayer?.name} est en train de choisir sa réponse préférée.
            </Text>
            <LoadingOverlay 
              message="Attente du vote..."
              showSpinner={true}
            />
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
      
      default:
        return <Text>Erreur: Phase de jeu inconnue</Text>;
    }
  };

  const loadGame = async (gameId: string) => {
    try {
      const gameData = await gameService.getGameState(gameId);
      
      if (gameData.game.currentPhase === 'results') {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
