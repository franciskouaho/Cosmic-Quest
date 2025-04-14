import api from '@/config/axios';
import { Answer } from '@/types/gameTypes';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocketService from '../socketService';
import UserIdManager from '@/utils/userIdManager';

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
      
      // Récupérer l'ID utilisateur avant l'appel API pour le débogage et les vérifications
      let userId = undefined;
      try {
        // Utiliser notre nouvel utilitaire
        userId = await UserIdManager.getUserId();
        
        if (!userId) {
          console.warn('⚠️ ID utilisateur non disponible pour la requête');
          
          // Dernière tentative avec AsyncStorage direct
          const userData = await AsyncStorage.getItem('@user_data');
          if (userData) {
            const parsedData = JSON.parse(userData);
            userId = parsedData.id;
            // Sauvegarder pour les futures requêtes
            await UserIdManager.setUserId(userId);
          }
        }
        
        console.log(`🔑 ID utilisateur détecté: ${userId || 'Non disponible'}`);
      } catch (err) {
        console.warn('⚠️ Erreur lors de la récupération de l\'ID utilisateur:', err);
      }
      
      // Appliquer l'ID utilisateur aux headers de manière sécurisée
      if (userId && api && api.defaults) {
        api.defaults.headers.userId = String(userId);
      }
      
      try {
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
          const targetId = String(gameData.currentQuestion.targetPlayer.id);
          
          // S'assurer que isTargetPlayer est correctement défini
          if (gameData.currentUserState) {
            // Convertir tous les IDs en string pour comparaison
            const userIdStr = String(userId);
            const targetIdStr = String(targetId);
            
            const isReallyTarget = Boolean(userId && targetIdStr === userIdStr);
            
            console.log(`🎯 Vérification de cible - ID utilisateur: ${userIdStr}, ID cible: ${targetIdStr}, Correspondance: ${isReallyTarget}`);
            
            if (gameData.currentUserState.isTargetPlayer !== isReallyTarget) {
              console.warn(`⚠️ Correction d'incohérence de joueur cible: ${gameData.currentUserState.isTargetPlayer} => ${isReallyTarget}`);
              console.log(`🔍 Détails - ID utilisateur: ${userIdStr}, ID cible: ${targetIdStr}, Types - ID utilisateur: ${typeof userId}, ID cible: ${typeof targetId}`);
              gameData.currentUserState.isTargetPlayer = isReallyTarget;
            }
          }
        }

        // S'assurer que les réponses ont bien la propriété isOwnAnswer
        if (gameData.answers && Array.isArray(gameData.answers) && userId) {
          const userIdStr = String(userId);
          gameData.answers = gameData.answers.map(answer => ({
            ...answer,
            isOwnAnswer: String(answer.playerId) === userIdStr || answer.isOwnAnswer
          }));
        }
        
        return gameData;
      } catch (apiError) {
        // Gérer spécifiquement les erreurs 500
        if (apiError?.response?.status === 500) {
          console.error('❌ Erreur serveur 500 lors de la récupération de l\'état du jeu');
          
          // Si nous avons déjà essayé plusieurs fois, tenter une récupération
          if (retryCount >= 1) {
            console.log('🔄 Tentative de récupération d\'état...');
            
            // Importer dynamiquement l'utilitaire de récupération pour éviter les problèmes de dépendances circulaires
            const { GameStateRecovery } = await import('@/utils/gameStateRecovery');
            
            // Tenter de récupérer l'état via notre service de récupération
            const recovered = await GameStateRecovery.recoverFromPersistentError(gameId);
            
            if (recovered) {
              console.log('✅ Récupération d\'état réussie, nouvelle tentative...');
              // Attendre un peu pour que le serveur se stabilise
              await new Promise(resolve => setTimeout(resolve, 1000));
              // Nouvelle tentative avec compteur réinitialisé
              return this.getGameState(gameId, 0, maxRetries);
            }
            
            // Si la récupération échoue et que nous sommes au dernier essai,
            // construire un état fallback minimal pour éviter un plantage complet
            if (retryCount >= maxRetries - 1) {
              console.log('⚠️ Construction d\'un état minimal pour éviter un plantage');
              const { GameStateRecovery } = await import('@/utils/gameStateRecovery');
              return GameStateRecovery.sanitizeGameState(null, userId);
            }
          }
        }
        throw apiError; // Propager l'erreur pour le traitement normal
      }
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

  /**
   * Soumettre une réponse à une question uniquement via WebSocket
   */
  async submitAnswer(gameId: string, questionId: string, content: string) {
    console.log(`🎮 Soumission de réponse pour le jeu ${gameId}, question ${questionId}`);
    try {
      // Récupérer l'ID utilisateur pour le débogage
      const userId = await UserIdManager.getUserId();
      console.log(`👤 Soumission de réponse par utilisateur ${userId}`);
      
      // Vérifier que la connexion WebSocket est établie
      const socket = await SocketService.getInstanceAsync();
      
      if (!socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative de reconnexion...');
        await this.ensureSocketConnection(gameId);
      }
      
      // Utiliser la méthode du service socket avec le nom d'événement correct
      const result = await SocketService.submitAnswer({
        gameId,
        questionId,
        content
      });
      
      console.log('✅ Réponse soumise avec succès via WebSocket');
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur lors de la soumission de la réponse:', error);
      throw error;
    }
  }

  // Soumettre un vote pour une réponse
  async submitVote(gameId: string, answerId: string, questionId: string) {
    console.log(`🎮 GameService: Vote pour la réponse ${answerId} dans le jeu ${gameId}`);
    try {
      // Récupérer l'ID utilisateur pour le débogage
      const userId = await UserIdManager.getUserId();
      console.log(`👤 Soumission de vote par utilisateur ${userId}`);
      
      // Vérifier que la connexion WebSocket est établie
      const socket = await SocketService.getInstanceAsync();
      
      if (!socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative de reconnexion...');
        await this.ensureSocketConnection(gameId);
      }
      
      // Utiliser la méthode du service socket avec le nom d'événement correct
      const result = await SocketService.submitVote({
        gameId,
        answerId,
        questionId
      });
      
      console.log('✅ Vote soumis avec succès via WebSocket');
      return { success: true };
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission du vote:', error);
      
      // En cas d'échec via WebSocket, essayer en fallback via HTTP
      console.log('🔄 Tentative de fallback via HTTP');
      try {
        const url = `/games/${gameId}/vote`;
        console.log('🔐 API Request (fallback): POST', url);
        
        const response = await api.post(url, {
          answer_id: answerId,
          question_id: questionId
        });
        
        console.log('✅ Vote soumis avec succès via HTTP (fallback)');
        return { success: true };
      } catch (httpError) {
        console.error('❌ Échec du fallback HTTP:', httpError);
        throw error; // Propager l'erreur WebSocket originale
      }
    }
  }

  /**
   * Vérifier si un utilisateur est l'hôte d'une salle
   * @param roomId ID de la salle
   * @param userId ID de l'utilisateur
   * @returns true si l'utilisateur est l'hôte
   */
  async isUserRoomHost(roomId: string | number, userId: string | number): Promise<boolean> {
    try {
      const response = await api.get(`/rooms/${roomId}`);
      if (response.data && response.data.data && response.data.data.room) {
        return String(response.data.data.room.hostId) === String(userId);
      }
      return false;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de l\'hôte de la salle:', error);
      return false;
    }
  }

  /**
   * Passer au tour suivant avec tentative WebSocket prioritaire et meilleure gestion des erreurs
   */
  async nextRound(gameId: string) {
    console.log(`🎮 Tentative de passage au tour suivant pour le jeu ${gameId}`);
    
    try {
      // Récupérer l'ID utilisateur et vérifier s'il est l'hôte
      const userId = await UserIdManager.getUserId();
      let isHost = false;
      
      try {
        // Récupérer les données du jeu pour obtenir l'ID de la salle
        const gameData = await this.getGameState(gameId);
        if (gameData && gameData.game && gameData.game.roomId && userId) {
          isHost = await this.isUserRoomHost(gameData.game.roomId, userId);
          console.log(`👑 Vérification hôte: userId=${userId}, isHost=${isHost}`);
        }
      } catch (hostCheckError) {
        console.warn('⚠️ Erreur lors de la vérification de l\'hôte:', hostCheckError);
      }

      // D'abord, tenter via WebSocket
      try {
        await SocketService.ensureSocketConnection(gameId);
        console.log(`🎮 Tentative de passage au tour suivant via WebSocket...`);
        
        // Si l'utilisateur est l'hôte, on peut utiliser forceAdvance=true en cas d'échec
        try {
          const result = await SocketService.nextRound(gameId, false);
          console.log(`✅ Passage au tour suivant réussi via WebSocket`);
          return { success: true };
        } catch (standardError) {
          // Si l'erreur concerne l'hôte et que l'utilisateur est effectivement l'hôte
          if (standardError.message && standardError.message.includes("l'hôte") && isHost) {
            console.log('🔄 Réessai avec forceAdvance=true en tant qu\'hôte');
            const forcedResult = await SocketService.nextRound(gameId, true);
            console.log(`✅ Passage forcé au tour suivant réussi`);
            return { success: true };
          }
          
          throw standardError;
        }
      } catch (socketError) {
        console.warn(`⚠️ Échec du passage via WebSocket: ${socketError.message}`);
        
        // Si l'erreur concerne les votes ou une phase incorrecte, propager l'erreur
        if (socketError.message && (
          socketError.message.includes('votes') ||
          socketError.message.includes('phase') ||
          socketError.message.includes('impossible')
        )) {
          throw socketError;
        }
        
        // Sinon, essayer via REST API comme fallback
        const response = await api.post(`/games/${gameId}/next-round`);
        console.log(`✅ Passage au tour suivant réussi via API REST`);
        return response.data;
      }
    } catch (error) {
      console.error(`❌ Échec du passage au tour suivant:`, error);
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
          // Tenter une reconnexion forcée avec un délai court
          const socket = await SocketService.getInstanceAsync(true);
          
          // Attendre un bref moment pour que la connexion se stabilise
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Rejoindre le canal de jeu
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
