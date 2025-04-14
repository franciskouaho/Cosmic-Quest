import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { GamePhase, GameState } from '../types/gameTypes';
import gameService from '../services/queries/game';
import SocketService from '../services/socketService';
import { useAuth } from './AuthContext';
import { Alert } from 'react-native';
import Toast from '@/components/common/Toast';

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

      const updatedGameState = {
        ...gameState,
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
    
    if (gameState.currentUserState?.isTargetPlayer) {
      showToast("Vous êtes la cible de cette question et ne pouvez pas y répondre", "warning");
      return;
    }
    
    try {
      console.log('🎮 GameContext: Soumission de réponse...');
      await gameService.submitAnswer(gameId, gameState.currentQuestion.id, answer);
      
      setGameState(prevState => ({
        ...prevState,
        currentUserState: {
          ...prevState.currentUserState,
          hasAnswered: true,
        },
      }));
      
      showToast("Réponse soumise avec succès", "success");
      console.log('✅ GameContext: Réponse soumise avec succès');
    } catch (error) {
      console.error('❌ GameContext: Erreur lors de la soumission de la réponse:', error);
      showToast("Impossible de soumettre votre réponse", "error");
      throw error;
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
      
      // Assurer que la connexion WebSocket est bien établie avant de soumettre le vote
      await gameService.ensureSocketConnection(gameId);
      
      // Attendre un bref moment pour que la connexion WebSocket soit stable
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Utiliser la méthode mise à jour qui privilégie WebSocket
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
    } catch (error) {
      console.error('❌ GameContext: Erreur lors de la soumission du vote:', error);
      setError('Erreur lors de la soumission du vote');
      showToast("Impossible d'enregistrer votre vote. Veuillez réessayer.", "error");
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

    try {
      console.log('🎮 GameContext: Passage au tour suivant...');
      
      setIsSubmitting(true);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await gameService.nextRound(gameId);
      
      setGameState(prevState => ({
        ...prevState,
        phase: GamePhase.LOADING,
      }));

      setTimeout(() => {
        loadGame(gameId);
      }, 500);
      
    } catch (error) {
      console.error('❌ GameContext: Erreur lors du passage au tour suivant:', error);
      Alert.alert(
        'Information',
        'Veuillez patienter quelques secondes avant de passer au tour suivant',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
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
