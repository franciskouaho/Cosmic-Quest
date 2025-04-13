import api from '@/config/axios';
import { Answer } from '@/types/gameTypes';
import NetInfo from '@react-native-community/netinfo';
import SocketService from '../socketService';

class GameService {
  // Récupérer l'état actuel du jeu avec mécanisme de réessai
  async getGameState(gameId: string, retryCount = 0, maxRetries = 3) {
    console.log(`🎮 GameService: Récupération de l'état du jeu ${gameId}`);
    try {
      // Vérification de la connexion internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.warn('⚠️ Pas de connexion internet disponible');
        throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
      }

      const url = `/games/${gameId}`;
      console.log('🔐 API Request: GET', url);
      
      const response = await api.get(url);
      console.log('✅ GameService: État du jeu', gameId, 'récupéré avec succès');
      
      // Vérifier si la réponse est correcte et a les propriétés attendues
      if (!response.data?.data?.game) {
        console.warn('⚠️ Structure de réponse inattendue:', response.data);
        throw new Error('Données de jeu incomplètes');
      }
      
      // Assurer que le joueur cible est correctement identifié
      const gameData = response.data.data;
      if (gameData.currentQuestion?.targetPlayer) {
        const targetId = gameData.currentQuestion.targetPlayer.id.toString();
        // S'assurer que isTargetPlayer est correctement défini
        if (gameData.currentUserState) {
          const userId = api.defaults.headers.userId;
          const isReallyTarget = targetId === userId?.toString();
          if (gameData.currentUserState.isTargetPlayer !== isReallyTarget) {
            console.warn(`⚠️ Correction d'incohérence de joueur cible: ${gameData.currentUserState.isTargetPlayer} => ${isReallyTarget}`);
            gameData.currentUserState.isTargetPlayer = isReallyTarget;
          }
        }
      }

      // S'assurer que les réponses ont bien la propriété isOwnAnswer
      if (gameData.answers && Array.isArray(gameData.answers)) {
        const userId = api.defaults.headers.userId;
        gameData.answers = gameData.answers.map(answer => ({
          ...answer,
          isOwnAnswer: answer.playerId === userId || answer.isOwnAnswer
        }));
      }
      
      return gameData;
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la récupération de l\'état du jeu', gameId, ':', error);
      
      // Si nous n'avons pas atteint le nombre maximum de tentatives, réessayer
      if (retryCount < maxRetries) {
        console.log(`🔄 GameService: Tentative #${retryCount + 1}/${maxRetries} pour récupérer l'état du jeu ${gameId}`);
        // Attendre un peu avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.getGameState(gameId, retryCount + 1, maxRetries);
      }
      
      throw error;
    }
  }

  // Soumettre une réponse à une question
  async submitAnswer(gameId: string, questionId: number | string, content: string) {
    console.log(`🎮 GameService: Soumission de réponse pour jeu ${gameId}, question ${questionId}`);
    try {
      const url = `/games/${gameId}/answer`;
      console.log('🔐 API Request: POST', url);
      
      const response = await api.post(url, {
        question_id: questionId,
        content: content
      });
      
      console.log('✅ GameService: Réponse soumise avec succès');
      return response.data;
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission de la réponse:', error);
      throw error;
    }
  }

  // Soumettre un vote pour une réponse
  async submitVote(gameId: string, answerId: string, questionId: string) {
    console.log(`🎮 GameService: Vote pour la réponse ${answerId} dans le jeu ${gameId}`);
    try {
      const url = `/games/${gameId}/vote`;
      console.log('🔐 API Request: POST', url);
      
      const response = await api.post(url, {
        answer_id: answerId,
        question_id: questionId
      });
      
      console.log('✅ GameService: Vote soumis avec succès');
      return response.data;
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission du vote:', error);
      throw error;
    }
  }

  // Passer au tour suivant
  async nextRound(gameId: string, retryCount = 0, maxRetries = 2) {
    console.log(`🎮 GameService: Passage au tour suivant pour le jeu ${gameId}`);
    try {
      const url = `/games/${gameId}/next-round`;
      console.log('🔐 API Request: POST', url);
      
      const response = await api.post(url);
      
      console.log('✅ GameService: Passage au tour suivant réussi');
      return response.data;
    } catch (error) {
      console.error('❌ GameService: Erreur lors du passage au tour suivant:', error);
      
      // Si nous n'avons pas atteint le nombre maximum de tentatives, réessayer
      if (retryCount < maxRetries) {
        console.log(`🔄 GameService: Tentative #${retryCount + 1}/${maxRetries} pour passer au tour suivant ${gameId}`);
        // Attendre un peu avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.nextRound(gameId, retryCount + 1, maxRetries);
      }
      
      throw error;
    }
  }

  // Ressynchroniser la connection WebSocket si nécessaire
  async ensureSocketConnection(gameId: string) {
    try {
      const diagnose = SocketService.diagnose();
      console.log(`🔌 Diagnostic WebSocket: ${diagnose.status}`);
      
      if (diagnose.status !== 'connected' || diagnose.details.currentGame !== gameId) {
        console.log(`🔌 Reconnexion WebSocket au jeu ${gameId}`);
        
        try {
          // Utiliser l'initialisation asynchrone qui est plus fiable
          const socket = await SocketService.getInstanceAsync();
          await SocketService.joinGameChannel(gameId);
          console.log(`✅ Reconnexion WebSocket réussie pour le jeu ${gameId}`);
          return true;
        } catch (socketError) {
          console.error('❌ Erreur lors de la réinitialisation du socket:', socketError);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de la connexion WebSocket:', error);
      return false;
    }
  }
}

const gameService = new GameService();
export default gameService;
