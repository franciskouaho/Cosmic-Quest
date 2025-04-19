import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QuestionPhase from '@/components/game/QuestionPhase';
import VotePhase from '@/components/game/VotePhase';
import ResultsPhase from '@/components/game/ResultsPhase';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import { useAuth } from '@/contexts/AuthContext';
import { GamePhase, GameState } from '@/types/gameTypes';
import gameService from '@/services/queries/game';
import SocketService from '@/services/socketService';
import api from '@/config/axios';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserIdManager from '@/utils/userIdManager';
import { PhaseManager, ensureCorrectVoteTarget } from '@/utils/phaseManager';

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
  
  const determineEffectivePhase = (serverPhase: string, serverRound: number, currentUser: any): string => {
    console.log('Détermination de la phase effective:', {
      serverPhase,
      serverRound,
      currentUser,
      currentRound: gameState.currentRound,
      phase: gameState.phase
    })

    // Si le serveur est en phase de question et que c'est le tour du joueur actuel
    if (serverPhase === 'question' && serverRound === currentUser?.currentRound) {
      console.log('Phase de question détectée pour le joueur actuel')
      return 'question'
    }

    // Si le serveur est en phase de réponse et que c'est le tour du joueur actuel
    if (serverPhase === 'answer' && serverRound === currentUser?.currentRound) {
      console.log('Phase de réponse détectée pour le joueur actuel')
      return 'answer'
    }

    // Si le serveur est en phase de vote
    if (serverPhase === 'vote') {
      console.log('Phase de vote détectée')
      return 'vote'
    }

    // Si le serveur est en phase de résultats
    if (serverPhase === 'results') {
      console.log('Phase de résultats détectée')
      return 'results'
    }

    // Par défaut, utiliser la phase du serveur
    console.log('Utilisation de la phase du serveur par défaut:', serverPhase)
    return serverPhase
  }

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
      const effectivePhase = determineEffectivePhase(
        gameData.game.currentPhase,
        gameData.game.currentRound,
        gameData.players?.find((p: any) => String(p.id) === String(user?.id))
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
        timer: null,
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
        if (newGameState.currentUserState) {
          newGameState.currentUserState.isTargetPlayer = detectedAsTarget;
        }
      }
      
      // Vérification supplémentaire: pour la phase vote,
      // s'assurer que la cible est correctement identifiée pour l'écran de vote
      if (gameData.game.currentPhase === 'vote' && newGameState.currentQuestion) {
        const questionTargetId = String(newGameState.currentQuestion.targetPlayer?.id || '');
        const currentUserId = String(user?.id || '');
        
        if (questionTargetId === currentUserId) {
          console.log('🎯 Correction supplémentaire: l\'utilisateur est la cible en phase vote');
          
          if (newGameState.currentUserState) {
            newGameState.currentUserState.isTargetPlayer = true;
          } else {
            newGameState.currentUserState = {
              isTargetPlayer: true,
              hasAnswered: false,
              hasVoted: gameData.currentUserState?.hasVoted || false
            };
          }
          
          // Forcer la phase effective à vote si la cible n'a pas encore voté
          if (!newGameState.currentUserState.hasVoted) {
            newGameState.phase = 'vote';
          }
        }
      }
      
      // Appliquer ensuite la correction via ensureCorrectVoteTarget pour les autres cas
      let correctedState = ensureCorrectVoteTarget(newGameState, userIdStr);
      
      // Vérifier si l'état a été modifié, afficher un log
      if (correctedState !== newGameState) {
        console.log('🔄 État corrigé pour la phase vote - Nouveau isTarget:', correctedState.currentUserState?.isTargetPlayer);
      }
      
      setGameState(correctedState);
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
        const handleGameUpdate = (data: any) => {
          console.log('🎮 Mise à jour du jeu reçue:', data);
          
          // Toujours traiter comme transition instantanée
          console.log('⚡ Transition instantanée, mise à jour immédiate');
          
          if (data.type === 'phase_change') {
            console.log(`🎮 Changement de phase: ${data.phase}`);
            
            // Mise à jour immédiate de l'état sans attente
            setGameState(prev => {
              const newState = {
                ...prev,
                phase: PhaseManager.determineEffectivePhase(
                  data.phase,
                  prev.currentUserState?.isTargetPlayer || false,
                  prev.currentUserState?.hasAnswered || false,
                  prev.currentUserState?.hasVoted || false
                ) as GamePhase,
                game: {
                  ...prev.game,
                  currentPhase: data.phase,
                  id: prev.game?.id || '',
                  roomId: prev.game?.roomId || '',
                  hostId: prev.game?.hostId || '',
                  status: prev.game?.status || 'in_progress',
                  gameMode: prev.game?.gameMode || 'standard',
                  currentRound: prev.game?.currentRound || 1,
                  totalRounds: prev.game?.totalRounds || 5,
                  scores: prev.game?.scores || {},
                  createdAt: prev.game?.createdAt || new Date().toISOString()
                },
                // Mettre à jour les scores si fournis
                scores: data.scores || prev.scores,
                // Suppression des timers
                timer: null
              };
              return newState;
            });
            
            // Rafraîchir les données immédiatement
            fetchGameData();
          } else if (data.type === 'target_player_vote') {
            // Gestion spéciale pour le cas où nous avons un message target_player_vote
            console.log(`🎯 Message target_player_vote reçu: targetPlayerId=${data.targetPlayerId}`);
            
            // Vérifier si c'est le joueur cible
            const isCurrentUserTarget = String(data.targetPlayerId) === String(user?.id);
            console.log(`🎯 Ce joueur ${isCurrentUserTarget ? 'EST' : 'n\'est PAS'} la cible.`);
            
            // IMPORTANT: Stockage global de l'ID cible pour les cas où le serveur
            // n'inclut pas cette information dans les objets question/player
            const targetPlayerInfo = { id: data.targetPlayerId };
            
            if (isCurrentUserTarget) {
              // Mettre à jour immédiatement l'état pour le joueur cible
              setGameState(prev => {
                // Créer une copie profonde pour éviter les références
                const newState = JSON.parse(JSON.stringify(prev));
                
                // Configurer la phase et l'état du joueur
                newState.phase = GamePhase.VOTE;
                
                // Définir explicitement le joueur comme cible
                if (!newState.currentUserState) {
                  newState.currentUserState = {};
                }
                newState.currentUserState.isTargetPlayer = true;
                
                // Si targetPlayer n'existe pas encore, le créer
                if (!newState.targetPlayer && data.targetPlayerId) {
                  // Chercher le joueur dans la liste des joueurs si possible
                  const targetPlayerData = newState.players?.find(p => 
                    String(p.id) === String(data.targetPlayerId)
                  );
                  
                  if (targetPlayerData) {
                    newState.targetPlayer = {
                      id: String(targetPlayerData.id),
                      name: targetPlayerData.displayName || targetPlayerData.username || 'Joueur',
                      avatar: targetPlayerData.avatar
                    };
                  } else {
                    // Sinon, créer un objet minimal avec l'ID
                    newState.targetPlayer = { id: String(data.targetPlayerId) };
                  }
                }
                
                // Stocker les réponses si disponibles
                if (data.answers) {
                  newState.answers = data.answers;
                }
                
                // Stocker l'ID cible temporairement
                newState._targetPlayerId = data.targetPlayerId;
                
                return newState;
              });
              
              console.log(`🎯 État mis à jour pour le joueur cible: phase=vote, isTargetPlayer=true`);
            } else {
              // Pour les non-cibles, mettre quand même à jour le targetPlayerId
              setGameState(prev => {
                const newState = JSON.parse(JSON.stringify(prev));
                newState.phase = GamePhase.WAITING_FOR_VOTE;
                newState._targetPlayerId = data.targetPlayerId;
                
                // Si targetPlayer n'existe pas encore mais que nous avons l'info targetPlayerId
                if (!newState.targetPlayer && data.targetPlayerId) {
                  // Chercher le joueur dans la liste des joueurs si possible
                  const targetPlayerData = newState.players?.find(p => 
                    String(p.id) === String(data.targetPlayerId)
                  );
                  
                  if (targetPlayerData) {
                    newState.targetPlayer = {
                      id: String(targetPlayerData.id),
                      name: targetPlayerData.displayName || targetPlayerData.username || 'Joueur',
                      avatar: targetPlayerData.avatar
                    };
                  } else {
                    // Sinon, créer un objet minimal avec l'ID
                    newState.targetPlayer = { id: String(data.targetPlayerId) };
                  }
                }
                
                return newState;
              });
            }
            
            // Rafraîchir les données dans tous les cas
            fetchGameData();
          } else if (data.type === 'vote_submitted') {
            // Rafraîchissement immédiat pour les votes
            fetchGameData();
          } else if (data.type === 'new_round') {
            console.log(`🎮 Nouveau tour détecté: ${data.round}`);
            
            // Passage immédiat au nouveau tour
            setGameState(prev => {
              const newState = {
                ...prev,
                phase: PhaseManager.determineEffectivePhase(
                  'question',
                  prev.currentUserState?.isTargetPlayer || false,
                  prev.currentUserState?.hasAnswered || false,
                  prev.currentUserState?.hasVoted || false
                ) as GamePhase,
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
                  currentRound: data.round,
                  id: prev.game?.id || '',
                  roomId: prev.game?.roomId || '',
                  hostId: prev.game?.hostId || '',
                  status: prev.game?.status || 'in_progress',
                  gameMode: prev.game?.gameMode || 'standard',
                  totalRounds: prev.game?.totalRounds || 5,
                  scores: prev.game?.scores || {},
                  createdAt: prev.game?.createdAt || new Date().toISOString()
                },
                // Supprimer timer
                timer: null
              };
              return newState;
            });
            
            // Forcer un rechargement complet
            setTimeout(() => {
              fetchGameData();
            }, 300);
          } else if (data.type === 'next_round_triggered') {
            console.log(`🎮 Passage au tour suivant déclenché par un autre joueur!`);
            
            // Forcer une mise à jour immédiate pour tous les joueurs
            fetchGameData();
          }
        };
        
        socket.on('game:update', handleGameUpdate);
        socket.on('reconnect', () => {
          console.log('🔄 Socket reconnecté, rafraîchissement des données...');
          fetchGameData();
        });

        // Gérer l'événement de force refresh
        socket.on('game:force_refresh', (data) => {
          console.log('Force refresh received:', data)
          // Forcer une mise à jour immédiate de l'état
          fetchGameData()
        });
        
        // Événement spécifique pour le passage au tour suivant
        socket.on('game:next_round', (data) => {
          console.log('⏭️ Événement next_round reçu:', data);
          // Forcer une mise à jour immédiate pour tous les joueurs
          fetchGameData();
        });

        // Retourner les nettoyeurs d'événements
        return {
          cleanupEvents: () => {
            socket.off('game:update', handleGameUpdate);
            socket.off('reconnect');
            socket.off('game:force_refresh');
            socket.off('game:next_round');
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

    return () => {
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

  useEffect(() => {
    // Ne pas exécuter pendant le chargement initial
    if (!isReady || !gameState || !id) return;
    
    // Fonction de vérification de blocage - à exécuter immédiatement, pas périodiquement
    const checkGameProgress = async () => {
      try {
        // Si le gameState a une phase "question" mais l'utilisateur a déjà répondu
        if (gameState.phase === GamePhase.QUESTION && gameState.currentUserState?.hasAnswered) {
          console.log(`🔄 Détection d'incohérence: en phase QUESTION mais a déjà répondu`);
          
          const { checkPhaseAfterAnswer } = await import('@/utils/socketTester');
          const result = await checkPhaseAfterAnswer(id as string);
          
          if (result) {
            console.log(`🔄 Correction appliquée, rafraîchissement des données...`);
            fetchGameData();
          }
        }
        
        // Vérifier si l'utilisateur est la cible et devrait voir l'écran de vote
        if (gameState.game?.currentPhase === 'answer' && gameState.currentUserState?.isTargetPlayer) {
          console.log(`🎯 Utilisateur est la cible en phase answer, vérification du statut de vote...`);
          
          // Vérifier si toutes les réponses sont arrivées
          const answers = gameState.answers || [];
          const players = gameState.players || [];
          
          // Nombre de joueurs attendus (moins la cible)
          const expectedAnswers = players.length - 1;
          
          if (answers.length >= expectedAnswers) {
            console.log(`🎯 Toutes les réponses sont arrivées (${answers.length}/${expectedAnswers}), transition vers vote...`);
            
            // Tenter de forcer la transition vers la phase vote pour la cible
            try {
              const { forceVotePhaseForTarget } = await import('@/utils/gameStateHelper');
              const success = await forceVotePhaseForTarget(id as string);
              
              if (success) {
                console.log(`✅ Transition vers phase vote réussie pour la cible`);
                fetchGameData();
              }
            } catch (error) {
              console.error(`❌ Erreur lors de la transition vers vote:`, error);
            }
          } else {
            console.log(`⏳ En attente de plus de réponses (${answers.length}/${expectedAnswers}) avant de passer à la phase vote`);
          }
        }
        
        // Si phase 'waiting' trop longtemps, vérifier l'état
        if (gameState.phase === GamePhase.WAITING || gameState.phase === GamePhase.WAITING_FOR_VOTE) {
          const { checkAndUnblockGame } = await import('@/utils/socketTester');
          const result = await checkAndUnblockGame(id as string);
          
          if (result) {
            console.log(`🔄 Blocage potentiel corrigé, rafraîchissement des données...`);
            fetchGameData();
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
    
    // Vérifier immédiatement pour tous les états
    checkGameProgress();
    
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
      fetchGameData();
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
      fetchGameData();
    }
  };
  
  const handleNextRound = async () => {
    if (gameState.currentRound >= gameState.totalRounds) {
      router.push(`/game/results/${id}`);
      return;
    }
    
    const validPhases = [GamePhase.RESULTS, GamePhase.VOTE];
    if (!validPhases.includes(gameState.phase as GamePhase)) {
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
          headers: { 'X-Direct-HTTP': 'true' }
        });
        
        if (response.data?.status === 'success') {
          console.log("✅ Passage au tour suivant réussi via HTTP");
          Alert.alert("Succès", "Passage au tour suivant effectué!");
          
          // Notifier les autres joueurs via WebSocket
          try {
            const { default: gameWebSocketService } = await import('@/services/gameWebSocketService');
            await gameWebSocketService.notifyNextRound(id as string);
            console.log("📣 Notification envoyée aux autres joueurs");
          } catch (notifyError) {
            console.warn("⚠️ Impossible de notifier les autres joueurs:", notifyError);
          }
          
          // Forcer une mise à jour immédiate des données du jeu
          fetchGameData();
        } else {
          throw new Error(response.data?.message || "La requête HTTP a échoué");
        }
      } catch (error: unknown) {
        console.error("❌ Erreur lors du passage au tour suivant:", error);
        const errorMessage = error instanceof Error ? error.message : "Impossible de passer au tour suivant. Veuillez réessayer.";
        Alert.alert("Erreur", errorMessage);
      }
    } catch (error: unknown) {
      console.error("❌ Erreur lors du passage au tour suivant:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur inattendue s'est produite. Veuillez réessayer.";
      Alert.alert("Erreur", errorMessage);
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

    // Correction supplémentaire: utiliser PhaseManager pour s'assurer que la cible voit bien l'écran de vote
    let correctedState = gameState;
    if (gameState.game?.currentPhase === 'vote') {
      // S'assurer que user?.id existe et le convertir explicitement en chaîne
      const userId = user?.id ? String(user.id) : null;
      
      // Vérifie toutes les sources possibles d'ID cible
      const mainTargetId = correctedState.currentQuestion?.targetPlayer?.id;
      const backupTargetId = correctedState.targetPlayer?.id;
      const socketTargetId = (correctedState as any)._targetPlayerId;
      const rawTargetId = (correctedState as any).targetPlayerId;
      
      // Log détaillé des IDs pour debug
      console.log(`🔎 [Vote] Sources d'ID cible disponibles:`, {
        userId,
        mainTargetId,
        backupTargetId,
        socketTargetId,
        rawTargetId
      });
      
      // Essaie chaque source d'ID cible tour à tour
      if (userId && (
        (mainTargetId && String(mainTargetId) === userId) ||
        (backupTargetId && String(backupTargetId) === userId) ||
        (socketTargetId && String(socketTargetId) === userId) ||
        (rawTargetId && String(rawTargetId) === userId)
      )) {
        console.log(`🎯 Détection directe - Utilisateur ${userId} identifié comme cible du vote`);
        correctedState.currentUserState.isTargetPlayer = true;
      }
      
      // Si l'état a été modifié, afficher un log
      if (correctedState !== gameState) {
        console.log('🔄 État corrigé pour la phase vote - Nouveau isTarget:', correctedState.currentUserState?.isTargetPlayer);
      }
    }

    // Vérifier si la phase est valide
    const validPhases = Object.values(GamePhase);
    if (!validPhases.includes(correctedState.phase as GamePhase)) {
      console.error(`❌ Phase inconnue détectée lors du rendu: ${correctedState.phase}`);
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
    if (correctedState.phase === GamePhase.RESULTS) {
      // Stocker les informations d'hôte au cas où la salle serait supprimée plus tard
      if (correctedState.game?.hostId) {
        try {
          AsyncStorage.setItem(`@game_host_${id}`, JSON.stringify({
            hostId: String(correctedState.game.hostId),
            timestamp: Date.now()
          }));
          console.log(`💾 Informations d'hôte stockées localement pour le jeu ${id}`);
        } catch (error) {
          console.warn(`⚠️ Erreur lors du stockage des infos d'hôte:`, error);
        }
      }
      
      return (
        <ResultsPhase 
          answers={correctedState.answers}
          scores={correctedState.scores}
          players={correctedState.players}
          question={correctedState.currentQuestion}
          targetPlayer={correctedState.targetPlayer}
          onNextRound={handleNextRound}
          isLastRound={correctedState.currentRound >= correctedState.totalRounds}
          timer={null}
          gameId={id}
          isTargetPlayer={correctedState.currentUserState?.isTargetPlayer || false}
          currentPhase={correctedState.game?.currentPhase}
        />
      );
    }

    switch (correctedState.phase) {
      case GamePhase.LOADING:
        return <LoadingOverlay message="Préparation de la partie" />;
          
      case GamePhase.QUESTION:
        if (correctedState.currentUserState?.isTargetPlayer) {
          return (
            <View style={styles.waitingContainer}>
              <Text style={styles.messageTitle}>Cette question vous concerne !</Text>
              <Text style={styles.messageText}>
                Vous ne pouvez pas répondre car la question parle de vous. 
                Attendez que les autres joueurs répondent.
              </Text>
            </View>
          );
        }

        return (
          <QuestionPhase 
            question={correctedState.currentQuestion}
            targetPlayer={correctedState.targetPlayer}
            onSubmit={handleSubmitAnswer}
            round={correctedState.currentRound}
            totalRounds={correctedState.totalRounds}
            timer={null}
            isSubmitting={isSubmitting}
            hasAnswered={correctedState.currentUserState?.hasAnswered}
          />
        );
          
      case GamePhase.WAITING:
        return (
          <View style={styles.waitingContainer}>
            <LoadingOverlay 
              message={`Attente des autres joueurs...`}
              showSpinner={true}
            />
          </View>
        );
          
      case GamePhase.VOTE:
        console.log('🎯 [renderGamePhase] Phase VOTE:', {
          currentUserState: gameState.currentUserState,
          targetPlayer: gameState.targetPlayer,
          currentQuestion: gameState.currentQuestion
        });

        // Vérifier si l'utilisateur actuel est le joueur cible
        const isTargetPlayer = gameState.currentUserState?.isTargetPlayer || false;
        const hasVoted = gameState.currentUserState?.hasVoted || false;

        console.log('🔍 [renderGamePhase] État du vote:', {
          userId: user?.id,
          isTargetPlayer,
          hasVoted,
          targetPlayerId: gameState.targetPlayer?.id
        });

        if (isTargetPlayer && !hasVoted) {
          console.log('🎯 [renderGamePhase] Affichage de l\'écran de vote pour le joueur cible');
          return (
            <VotePhase
              answers={gameState.answers || []}
              question={gameState.currentQuestion}
              targetPlayer={gameState.targetPlayer}
              onVote={handleVote}
              isSubmitting={isSubmitting}
            />
          );
        } else {
          console.log('⏳ [renderGamePhase] Affichage de l\'écran d\'attente pour les autres joueurs');
          return (
            <View style={styles.waitingContainer}>
              <Text style={styles.messageTitle}>En attente du vote...</Text>
              <Text style={styles.messageText}>
                {gameState.targetPlayer?.name || 'Un joueur'} est en train de voter.
              </Text>
              <LoadingOverlay 
                message="Attente du vote..."
                showSpinner={true}
              />
            </View>
          );
        }
          
      case GamePhase.WAITING_FOR_VOTE:
        // Utiliser le même écran d'attente doré que pour la phase VOTE
        return (
          <View style={styles.waitingContainer}>
            <Text style={[styles.waitingTitle, { color: '#FFD700' }]}>C'est au tour de {correctedState.targetPlayer?.name} de voter !</Text>
            <Text style={[styles.waitingText, { color: '#FFF0AD' }]}>
              {correctedState.targetPlayer?.name} est en train de choisir sa réponse préférée.
            </Text>
            <LoadingOverlay 
              message="Attente du vote..."
              showSpinner={true}
            />
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
