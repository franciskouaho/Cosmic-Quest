import socketService from '@/services/socketService';
import GameStateHelper from './gameStateHelper';
import gameService from '@/services/queries/game';

/**
 * Teste la connexion socket
 */
export const testSocketConnection = async (): Promise<boolean> => {
  try {
    const socket = await socketService.getInstanceAsync(true);
    return socket && socket.connected;
  } catch (error) {
    console.error('❌ Erreur de connexion socket:', error);
    return false;
  }
};

/**
 * Teste la soumission d'une réponse
 */
export const testSubmitAnswer = async (
  gameId: string,
  questionId: string,
  content: string
): Promise<boolean> => {
  try {
    const socket = await socketService.getInstanceAsync(true);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Timeout lors du test de soumission de réponse');
        resolve(false);
      }, 5000);
      
      socket.emit('game:submit_answer', { gameId, questionId, content }, (response: any) => {
        clearTimeout(timeout);
        console.log('✅ Résultat du test de soumission:', response);
        resolve(!!response?.success);
      });
    });
  } catch (error) {
    console.error('❌ Erreur lors du test de soumission:', error);
    return false;
  }
};

/**
 * Vérifie si un joueur a répondu mais est toujours en phase question
 */
export const checkPhaseAfterAnswer = async (gameId: string): Promise<boolean> => {
  try {
    console.log(`🔍 Vérification de phase après réponse pour le jeu ${gameId}`);
    
    const gameData = await gameService.getGameState(gameId);
    
    // Vérifier l'incohérence: le joueur a répondu mais est toujours en phase question
    if (gameData.currentUserState?.hasAnswered && gameData.game.currentPhase === 'question') {
      console.log(`⚠️ Blocage détecté: A répondu mais toujours en phase question`);
      
      // Tenter de forcer la transition vers la phase réponse
      const success = await gameService.forcePhaseTransition(gameId, 'answer');
      
      if (!success) {
        // Essayer une deuxième approche
        return await GameStateHelper.forcePhaseTransition(gameId, 'answer');
      }
      
      return success;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de phase:', error);
    return false;
  }
};

/**
 * Vérifie et débloque un jeu potentiellement bloqué
 */
export const checkAndUnblockGame = async (gameId: string): Promise<boolean> => {
  try {
    return await GameStateHelper.checkAndUnblockGame(gameId);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de blocage:', error);
    return false;
  }
};

export default {
  testSocketConnection,
  testSubmitAnswer,
  checkPhaseAfterAnswer,
  checkAndUnblockGame
};
