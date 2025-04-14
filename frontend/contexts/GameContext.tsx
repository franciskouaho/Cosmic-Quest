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
        // Si l'utilisateur est la cible pendant la phase de réponse, il doit attendre
        return GamePhase.WAITING;  
      }
      return hasAnswered ? GamePhase.WAITING : GamePhase.ANSWER;

    case 'vote':
      // Correction critique: Si l'utilisateur est la cible et n'a pas encore voté, 
      // il DOIT voir l'écran de vote, pas l'écran d'attente
      if (isTarget && !hasVoted) {
        return GamePhase.VOTE;
      } else if (hasVoted) {
        // Si l'utilisateur a voté (qu'il soit cible ou non), il doit attendre
        return GamePhase.WAITING;
      } else {
        // Pour les non-cibles qui n'ont pas voté, ils sont en attente
        return GamePhase.WAITING;
      }

    case 'results':
      return GamePhase.RESULTS;

    default:
      return GamePhase.WAITING;
  }
};

// Mise à jour du reducer pour mieux gérer les changements de phase
function gameStateReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'UPDATE_PHASE': {
      // Déterminer la phase effective avant de mettre à jour l'état
      const phase = determineEffectivePhase(
        action.serverPhase,
        state.currentUserState?.isTargetPlayer || false,
        state.currentUserState?.hasAnswered || false,
        state.currentUserState?.hasVoted || false
      );
      
      // Log plus détaillé pour le débogage
      console.log(`🔄 Mise à jour de phase: ${state.phase} → ${phase} (serveur: ${action.serverPhase})`);
      console.log(`👤 État utilisateur: isTarget=${state.currentUserState?.isTargetPlayer}, hasAnswered=${state.currentUserState?.hasAnswered}, hasVoted=${state.currentUserState?.hasVoted}`);
      
      // Ne pas réinitialiser le timer si déjà présent pour la même phase
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
          // Ne réinitialiser ces états que lors du passage à la phase résultats
          hasAnswered: action.serverPhase === 'results' ? false : state.currentUserState?.hasAnswered || false,
          hasVoted: action.serverPhase === 'results' ? false : state.currentUserState?.hasVoted || false,
        }
      };
    }
      
    case 'FORCE_REFRESH_GAME': {
      // Nouveau cas pour forcer le rafraîchissement du jeu sans attendre
      console.log(`🔄 Forçage du rafraîchissement de l'état du jeu`);
      return {
        ...state,
        lastRefreshed: Date.now() // Ajouter un timestamp pour déclencher un rafraîchissement
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

      // Ajouter validation de phase
      if (gameData.game.currentPhase === 'answer' && gameData.currentUserState?.isTargetPlayer) {
        console.log('👀 Utilisateur est la cible pendant la phase de réponse');
      }

      // Ne pas réinitialiser hasAnswered/hasVoted si toujours dans la même phase
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
    
    // Double vérification avec message de débogage
    if (gameState.currentUserState?.isTargetPlayer) {
      showToast("Vous êtes la cible de cette question et ne pouvez pas y répondre", "warning");
      return;
    }
    
    try {
      console.log('🎮 GameContext: Soumission de réponse...');
      await gameService.submitAnswer(gameId, gameState.currentQuestion.id, answer);
      
      // Mettre à jour l'état pour indiquer que l'utilisateur attend
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
      await gameService.submitVote(gameId, answerId, gameState.currentQuestion.id.toString());
      
      // Mettre à jour l'état pour indiquer que l'utilisateur attend
      setGameState(prevState => ({
        ...prevState,
        currentUserState: {
          ...prevState.currentUserState,
          hasVoted: true,
        },
      }));
      
      console.log('✅ GameContext: Vote soumis avec succès');
    } catch (error) {
      console.error('❌ GameContext: Erreur lors de la soumission du vote:', error);
      setError('Erreur lors de la soumission du vote');
      throw error;
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
      
      // Ajouter un petit délai pour s'assurer que l'état est stabilisé
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await gameService.nextRound(gameId);
      
      // Mettre à jour l'état immédiatement pour une meilleure UX
      setGameState(prevState => ({
        ...prevState,
        phase: GamePhase.LOADING,
      }));

      // Rafraîchir les données après un court délai
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
        setTimer
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
