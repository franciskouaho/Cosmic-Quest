import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { GamePhase, GameState } from '../types/gameTypes';
import gameService from '../services/queries/game';
import SocketService from '../services/socketService';
import { useAuth } from './AuthContext';
import { Alert } from 'react-native';

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

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const loadGame = async (gameId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      console.log(`🎮 GameContext: Chargement du jeu ${gameId}...`);
      const gameData = await gameService.getGameState(gameId);

      // Formater les données du jeu pour le frontend
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

      // Déterminer la phase actuelle
      const isTargetPlayer = Boolean(gameData.currentUserState?.isTargetPlayer);
      let effectivePhase = GamePhase.WAITING;

      if (gameData.game.currentPhase === 'question') {
        effectivePhase = GamePhase.QUESTION;
      } else if (gameData.game.currentPhase === 'answer') {
        // IMPORTANT: Forcer la phase d'attente si l'utilisateur est la cible
        if (isTargetPlayer) {
          console.log('👉 Utilisateur identifié comme cible - forçage de la phase WAITING');
          effectivePhase = GamePhase.WAITING;
        } else if (gameData.currentUserState?.hasAnswered) {
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
      }

      // Ajouter un log pour confirmer l'état de isTargetPlayer
      console.log(`🎮 État utilisateur: isTarget=${isTargetPlayer}, hasAnswered=${gameData.currentUserState?.hasAnswered}, phase=${effectivePhase}`);

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
        currentUserState: {
          hasAnswered: gameData.currentUserState?.hasAnswered || false,
          hasVoted: gameData.currentUserState?.hasVoted || false,
          isTargetPlayer: isTargetPlayer,
        }
      });

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
      setError('Question non disponible');
      Alert.alert('Erreur', 'Impossible de soumettre votre réponse: question non disponible');
      return;
    }
    
    // Double vérification avec message de débogage
    if (gameState.currentUserState?.isTargetPlayer) {
      console.error('⛔ GameContext: Tentative de réponse bloquée - utilisateur est la cible');
      setError('Action non autorisée');
      Alert.alert('Impossible', 'Vous êtes la cible de cette question et ne pouvez pas y répondre');
      return;
    }
    
    try {
      console.log('🎮 GameContext: Soumission de réponse...');
      await gameService.submitAnswer(gameId, gameState.currentQuestion.id, answer);
      
      // Mettre à jour l'état pour indiquer que l'utilisateur attend
      setGameState(prev => prev ? { ...prev, phase: GamePhase.WAITING } : null);
      
      console.log('✅ GameContext: Réponse soumise avec succès');
    } catch (error) {
      console.error('❌ GameContext: Erreur lors de la soumission de la réponse:', error);
      setError('Erreur lors de la soumission de la réponse');
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
      setGameState(prev => prev ? { ...prev, phase: GamePhase.WAITING } : null);
      
      console.log('✅ GameContext: Vote soumis avec succès');
    } catch (error) {
      console.error('❌ GameContext: Erreur lors de la soumission du vote:', error);
      setError('Erreur lors de la soumission du vote');
      throw error;
    }
  };

  const nextRound = async (gameId: string) => {
    try {
      console.log('🎮 GameContext: Passage au tour suivant...');
      await gameService.nextRound(gameId);
      
      // Mettre à jour l'état pour indiquer le chargement
      setGameState(prev => prev ? { ...prev, phase: GamePhase.LOADING } : null);
      
      console.log('✅ GameContext: Tour suivant lancé avec succès');
    } catch (error) {
      console.error('❌ GameContext: Erreur lors du passage au tour suivant:', error);
      setError('Erreur lors du passage au tour suivant');
      throw error;
    }
  };

  const setTimer = (timer: { duration: number; startTime: number }) => {
    setGameState(prev => prev ? { ...prev, timer } : null);
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
