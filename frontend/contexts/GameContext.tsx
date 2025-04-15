import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { GamePhase, GameState } from '../types/gameTypes';
import gameService from '../services/queries/game';
import SocketService from '../services/socketService';
import { useAuth } from './AuthContext';
import { Alert } from 'react-native';
import Toast from '@/components/common/Toast';
import { PhaseManager } from '../utils/phaseManager';
import HostChecker from '../utils/hostChecker';

type GameContextType = {
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;
  loadGame: (gameId: string) => Promise<void>;
  submitAnswer: (gameId: string, answer: string) => Promise<void>;
  submitVote: (gameId: string, answerId: string) => Promise<void>;
  nextRound: (gameId: string) => Promise<void>;
  setTimer: (timer: { duration: number; startTime: number }) => void;
  forceCheckPhase: (gameId: string) => Promise<boolean>;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

const determineEffectivePhase = (
  serverPhase: string, 
  isTarget: boolean, 
  hasAnswered: boolean, 
  hasVoted: boolean
): GamePhase => {
  console.log('🎮 Détermination phase:', { serverPhase, isTarget, hasAnswered, hasVoted });

  switch (serverPhase) {
    case 'question':
      return GamePhase.QUESTION;
      
    case 'answer':
      if (isTarget) {
        return GamePhase.WAITING;  
      }
      return hasAnswered ? GamePhase.WAITING : GamePhase.ANSWER;

    case 'vote':
      if (isTarget && !hasVoted) {
        return GamePhase.VOTE;
      } else {
        return GamePhase.WAITING;
      }

    case 'results':
      return GamePhase.RESULTS;

    default:
      return GamePhase.WAITING;
  }
};

function gameStateReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'UPDATE_PHASE': {
      const phase = determineEffectivePhase(
        action.serverPhase,
        state.currentUserState?.isTargetPlayer || false,
        state.currentUserState?.hasAnswered || false,
        state.currentUserState?.hasVoted || false
      );
      
      console.log(`🔄 Mise à jour de phase: ${state.phase} → ${phase} (serveur: ${action.serverPhase})`);
      console.log(`👤 État utilisateur: isTarget=${state.currentUserState?.isTargetPlayer}, hasAnswered=${state.currentUserState?.hasAnswered}, hasVoted=${state.currentUserState?.hasVoted}`);
      
      const shouldUpdateTimer = action.timer && 
        (state.phase !== phase || !state.timer || 
        state.timer.startTime !== action.timer.startTime);

      return {
        ...state,
        phase,
        currentPhase: action.serverPhase,
        timer: shouldUpdateTimer ? action.timer : state.timer,
        currentUserState: {
          ...state.currentUserState,
          hasAnswered: action.serverPhase === 'results' ? false : state.currentUserState?.hasAnswered || false,
          hasVoted: action.serverPhase === 'results' ? false : state.currentUserState?.hasVoted || false,
        }
      };
    }
      
    case 'FORCE_REFRESH_GAME': {
      console.log(`🔄 Forçage du rafraîchissement de l'état du jeu`);
      return {
        ...state,
        lastRefreshed: Date.now()
      };
    }
      
    default:
      return state;
  }
}

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ visible: false, message: '', type: 'info' });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ visible: true, message, type });
  };

  const loadGame = async (gameId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(`🎮 Chargement du jeu ${gameId}...`);
      const gameData = await gameService.getGameState(gameId);

      if (gameData.game.currentPhase === 'answer' && gameData.currentUserState?.isTargetPlayer) {
        console.log('👀 Utilisateur est la cible pendant la phase de réponse');
      }

      const shouldResetState = gameData.game.currentPhase !== gameState?.game?.currentPhase;

      const targetPlayer = gameData.currentQuestion?.targetPlayer 
        ? {
          id: gameData.currentQuestion.targetPlayer.id.toString(),
          name: gameData.currentQuestion.targetPlayer.displayName || gameData.currentQuestion.targetPlayer.username,
          avatar: gameData.currentQuestion.targetPlayer.avatar || null,
        } 
        : null;

      const currentQuestion = gameData.currentQuestion 
        ? {
          id: gameData.currentQuestion.id,
          text: gameData.currentQuestion.text,
          theme: gameData.game.gameMode,
          roundNumber: gameData.currentQuestion.roundNumber,
        }
        : null;

      // Utiliser PhaseManager pour déterminer la phase effective avec plus de logs
      const effectivePhase = PhaseManager.determineEffectivePhase(
        gameData.game.currentPhase,
        Boolean(gameData.currentUserState?.isTargetPlayer),
        Boolean(gameData.currentUserState?.hasAnswered),
        Boolean(gameData.currentUserState?.hasVoted)
      );

      console.log(`🔄 [GameContext] Transition de phase:
        - Phase serveur: ${gameData.game.currentPhase}
        - Phase effective: ${effectivePhase}
        - isTarget: ${Boolean(gameData.currentUserState?.isTargetPlayer)}
        - hasAnswered: ${Boolean(gameData.currentUserState?.hasAnswered)}
        - hasVoted: ${Boolean(gameData.currentUserState?.hasVoted)}
      `);

      const updatedGameState = {
        ...gameState,
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
          hasAnswered: shouldResetState ? false : (gameState?.currentUserState?.hasAnswered || false),
          hasVoted: shouldResetState ? false : (gameState?.currentUserState?.hasVoted || false),
          isTargetPlayer: Boolean(gameData.currentUserState?.isTargetPlayer),
        },
        game: gameData.game,
      };

      setGameState(updatedGameState);

      console.log('✅ GameContext: Jeu chargé avec succès');

    } catch (error) {
      console.error('❌ GameContext: Erreur lors du chargement du jeu:', error);
      setError('Impossible de charger le jeu');
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async (gameId: string, answer: string) => {
    if (!gameState?.currentQuestion?.id) {
      showToast("Question non disponible", "error");
      return;
    }

    setIsSubmitting(true);
    let success = false;

    try {
      console.log('🎮 GameContext: Soumission de réponse...');
      
      // Vérifier que l'utilisateur peut répondre
      if (gameState.currentUserState?.isTargetPlayer) {
        showToast("Vous êtes la cible, vous ne pouvez pas répondre", "error");
        return;
      }

      await gameService.ensureSocketConnection(gameId);
      success = await gameService.submitAnswer(
        gameId,
        gameState.currentQuestion.id,
        answer
      );

      if (success) {
        setGameState(prev => ({
          ...prev,
          currentUserState: {
            ...prev.currentUserState,
            hasAnswered: true
          }
        }));
        showToast("Réponse soumise avec succès", "success");
        
        // Forcer un rafraîchissement après un court délai
        setTimeout(() => fetchGameData(), 500);
      }
    } catch (error) {
      console.error('❌ GameContext: Erreur lors de la soumission:', error);
      showToast("Impossible de soumettre votre réponse. Réessayez.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitVote = async (gameId: string, answerId: string) => {
    if (!gameState?.currentQuestion?.id) {
      setError('Question non disponible');
      return;
    }

    try {
      console.log('🎮 GameContext: Soumission du vote...');
      setIsSubmitting(true);
      
      // Ajouter un feedback utilisateur immédiat
      showToast("Envoi de votre vote en cours...", "info");
      
      // Utiliser directement la méthode de service qui utilise HTTP REST
      await gameService.submitVote(gameId, answerId, gameState.currentQuestion.id.toString());
      
      setGameState(prev => ({
        ...prev,
        currentUserState: {
          ...prev.currentUserState,
          hasVoted: true,
        },
        phase: GamePhase.WAITING,
      }));
      
      showToast("Vote enregistré avec succès", "success");
      console.log('✅ GameContext: Vote soumis avec succès');
      
      // Rafraîchir l'état du jeu pour confirmer le vote
      setTimeout(() => fetchGameData(), 1000);
    } catch (error) {
      console.error('❌ GameContext: Erreur lors de la soumission du vote:', error);
      setError('Erreur lors de la soumission du vote');
      showToast("Impossible d'enregistrer votre vote. Veuillez réessayer.", "error");
      
      // Essayer une dernier fois avec testVoteSubmission comme solution de secours
      try {
        console.log('🔄 GameContext: Tentative de secours avec testVoteSubmission...');
        const { testVoteSubmission } = await import('@/utils/socketTester');
        const result = await testVoteSubmission(gameId, answerId, gameState.currentQuestion.id.toString());
        
        if (result) {
          setGameState(prev => ({
            ...prev,
            currentUserState: {
              ...prev.currentUserState,
              hasVoted: true,
            },
            phase: GamePhase.WAITING,
          }));
          
          showToast("Vote enregistré avec succès", "success");
          console.log('✅ GameContext: Vote soumis avec succès via solution de secours');
          
          // Rafraîchir l'état du jeu pour confirmer le vote
          setTimeout(() => fetchGameData(), 1000);
          return;
        }
      } catch (fallbackError) {
        console.error('❌ GameContext: Échec de la solution de secours:', fallbackError);
      }
      
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextRound = async (gameId: string) => {
    const validPhases = ['results', 'vote'];
    if (!validPhases.includes(gameState?.phase || '')) {
      showToast("Impossible de passer au tour suivant dans cette phase", "warning");
      return;
    }

    const handleNextRound = useCallback(() => {
      if (isSubmitting) return;
      
      setIsSubmitting(true);
      
      try {
        console.log("🎮 Tentative de passage au tour suivant...");
        
        // Raccourcir le timeout et ajouter une notification d'erreur plus claire
        Promise.race([
          gameService.nextRound(gameId as string),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout lors du passage au tour suivant')), 8000)
          )
        ]).then(() => {
          console.log("✅ Passage au tour suivant initié avec succès");
          // Forcer la mise à jour de l'état après un court délai
          setTimeout(() => fetchGameData(), 1000);
        }).catch((error) => {
          console.error("❌ Erreur lors du passage au tour suivant:", error);
          Alert.alert(
            "Erreur",
            "Le passage au tour suivant a échoué. Veuillez réessayer.",
            [{ text: "OK" }]
          );
        }).finally(() => {
          setIsSubmitting(false);
        });
      } catch (error) {
        console.error("❌ Erreur lors du passage au tour suivant:", error);
        setIsSubmitting(false);
      }
    }, [gameId, isSubmitting, fetchGameData]);
    
    handleNextRound();
  };

  const setTimer = (timer: { duration: number; startTime: number }) => {
    setGameState(prevState => ({
      ...prevState,
      timer,
    }));
  };

  useEffect(() => {
    if (!gameState?.game?.id) return;

    console.log(`🎮 Mise en place des écouteurs WebSocket pour le jeu ${gameState.game.id}...`);

    const setupSocketConnection = async () => {
      try {
        await gameService.ensureSocketConnection(gameState.game.id);
        
        const socket = await SocketService.getInstanceAsync();
        
        const handleGameUpdate = (data: any) => {
          console.log(`🎮 Mise à jour du jeu reçue:`, data.type);
          
          switch (data.type) {
            case 'phase_change':
              console.log(`🔄 Changement de phase: ${data.phase}`);
              setGameState(prevState => {
                if (!prevState) return prevState;
                
                // Vérifier si le joueur est la cible dans la phase de vote
                if (data.phase === 'vote' && data.targetPlayerId && user?.id) {
                  const isTarget = String(data.targetPlayerId) === String(user.id);
                  if (isTarget) {
                    console.log("🎯 Utilisateur cible détecté, passage direct en phase de vote");
                    // Charger immédiatement les données pour éviter les délais
                    setTimeout(() => loadGame(gameState.game.id), 200);
                    return {
                      ...prevState,
                      phase: GamePhase.VOTE,
                      game: {
                        ...prevState.game,
                        currentPhase: data.phase
                      },
                      timer: data.timer || prevState.timer,
                      currentUserState: {
                        ...prevState.currentUserState,
                        isTargetPlayer: true,
                        hasVoted: false
                      }
                    };
                  }
                }
                
                const effectivePhase = determineEffectivePhase(
                  data.phase,
                  prevState.currentUserState?.isTargetPlayer || false,
                  prevState.currentUserState?.hasAnswered || false,
                  prevState.currentUserState?.hasVoted || false
                );
                
                return {
                  ...prevState,
                  phase: effectivePhase,
                  game: {
                    ...prevState.game,
                    currentPhase: data.phase
                  },
                  timer: data.timer || prevState.timer
                };
              });
              
              setTimeout(() => loadGame(gameState.game.id), 800);
              break;
            
            case 'target_player_vote':
              // Traitement spécial lorsque le joueur cible doit voter
              // Vérifier si l'utilisateur actuel est le joueur cible
              const userId = user?.id;
              console.log(`🎯 Notification de vote pour joueur cible reçue. UserId: ${userId}, TargetId: ${data.targetPlayerId}`);
              
              if (userId && String(userId) === String(data.targetPlayerId)) {
                console.log("✅ Utilisateur identifié comme cible, affichage immédiat écran de vote");
                
                setGameState(prevState => {
                  if (!prevState) return prevState;
                  
                  // S'assurer que les réponses sont à jour
                  const updatedAnswers = data.answers || prevState.answers;
                  
                  return {
                    ...prevState,
                    phase: GamePhase.VOTE,
                    timer: data.timer || prevState.timer,
                    answers: updatedAnswers,
                    currentUserState: {
                      ...prevState.currentUserState,
                      isTargetPlayer: true,
                      hasVoted: false
                    }
                  };
                });
              } else {
                console.log("👀 Utilisateur non ciblé, attente du vote");
                
                setGameState(prevState => {
                  if (!prevState) return prevState;
                  
                  return {
                    ...prevState,
                    phase: GamePhase.WAITING_FOR_VOTE,
                    timer: data.timer || prevState.timer,
                    currentUserState: {
                      ...prevState.currentUserState,
                      isTargetPlayer: false
                    }
                  };
                });
              }
              break;
              
            case 'new_answer':
            case 'new_vote':
              setTimeout(() => loadGame(gameState.game.id), 500);
              break;
              
            case 'new_round':
              console.log(`🎮 Nouveau tour: ${data.round}`);
              setGameState(prevState => {
                if (!prevState) return prevState;
                
                return {
                  ...prevState,
                  phase: GamePhase.QUESTION,
                  currentRound: data.round,
                  currentQuestion: data.question ? {
                    id: data.question.id,
                    text: data.question.text,
                    theme: prevState.theme,
                    roundNumber: data.round
                  } : prevState.currentQuestion,
                  targetPlayer: data.question?.targetPlayer ? {
                    id: String(data.question.targetPlayer.id),
                    name: data.question.targetPlayer.displayName || data.question.targetPlayer.username,
                    avatar: data.question.targetPlayer.avatar || null
                  } : prevState.targetPlayer,
                  timer: data.timer || prevState.timer,
                  currentUserState: {
                    ...prevState.currentUserState,
                    hasAnswered: false,
                    hasVoted: false,
                    isTargetPlayer: prevState.currentUserState?.isTargetPlayer && 
                      data.question?.targetPlayer ? 
                      String(data.question.targetPlayer.id) === String(user?.id) : 
                      prevState.currentUserState?.isTargetPlayer
                  }
                };
              });
              
              setTimeout(() => loadGame(gameState.game.id), 1000);
              break;
          }
        };
        
        socket.on('game:update', handleGameUpdate);
        
        return () => {
          socket.off('game:update', handleGameUpdate);
          console.log(`🔇 Écouteurs WebSocket nettoyés pour le jeu ${gameState.game.id}`);
        };
      } catch (error) {
        console.error('❌ Erreur lors de la mise en place de la connexion WebSocket:', error);
      }
    };
    
    const cleanupFunction = setupSocketConnection();
    
    return () => {
      if (typeof cleanupFunction === 'function') {
        cleanupFunction();
      }
    };
  }, [gameState?.game?.id, user]);

  const forceCheckPhase = async (gameId: string) => {
    try {
      console.log(`🔄 Tentative de vérification forcée de phase pour le jeu ${gameId}`);
      await SocketService.forcePhaseCheck(gameId);
      
      setTimeout(() => loadGame(gameId), 800);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification forcée de phase:', error);
      return false;
    }
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        isLoading,
        error,
        loadGame,
        submitAnswer,
        submitVote,
        nextRound,
        setTimer,
        forceCheckPhase
      }}
    >
      {children}
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onHide={() => setToast(prev => ({ ...prev, visible: false }))}
        />
      )}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
