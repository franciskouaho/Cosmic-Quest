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
      
      // Obtenir une instance du socket
      const socket = await SocketService.getInstanceAsync();
      
      // Créer une promesse pour attendre la confirmation du serveur
      return new Promise((resolve, reject) => {
        // Définir un timeout plus long (5 secondes) pour la confirmation WebSocket
        const timeoutId = setTimeout(() => {
          console.error('⏱️ Timeout WebSocket atteint, la soumission a échoué');
          reject(new Error('Le serveur a mis trop de temps à répondre. Veuillez réessayer.'));
        }, 5000);
        
        // Écouter l'événement de confirmation
        const handleConfirmation = (data) => {
          if (data.questionId === questionId) {
            console.log('✅ Confirmation WebSocket reçue pour la réponse');
            clearTimeout(timeoutId);
            socket.off('answer:confirmation', handleConfirmation);
            resolve({ success: true });
          }
        };
        
        // S'abonner à l'événement de confirmation
        socket.on('answer:confirmation', handleConfirmation);
        
        // Envoyer la réponse via WebSocket
        socket.emit('game:submit_answer', {
          gameId,
          questionId,
          content
        }, (ackData) => {
          if (ackData && ackData.success) {
            console.log('✅ Accusé de réception WebSocket reçu pour la réponse');
            clearTimeout(timeoutId);
            socket.off('answer:confirmation', handleConfirmation);
            resolve({ success: true });
          } else if (ackData && ackData.error) {
            console.error(`❌ Erreur lors de la soumission WebSocket: ${ackData.error}`);
            clearTimeout(timeoutId);
            socket.off('answer:confirmation', handleConfirmation);
            reject(new Error(ackData.error));
          }
        });
      });
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
      
      // Obtenir une instance du socket
      const socket = await SocketService.getInstanceAsync();
      
      // Créer une promesse pour attendre la confirmation du serveur
      return new Promise((resolve, reject) => {
        // Définir un timeout pour la confirmation WebSocket
        const timeoutId = setTimeout(() => {
          console.error('⏱️ Timeout WebSocket atteint, le vote a échoué');
          
          // En cas d'échec WebSocket, essayer en fallback via HTTP
          console.log('🔄 Tentative de fallback via HTTP');
          try {
            const url = `/games/${gameId}/vote`;
            console.log('🔐 API Request (fallback): POST', url);
            
            api.post(url, {
              answer_id: answerId,
              question_id: questionId
            }).then(response => {
              console.log('✅ GameService: Vote soumis avec succès via HTTP (fallback)');
              resolve(response.data);
            }).catch(httpError => {
              console.error('❌ Même le fallback HTTP a échoué:', httpError);
              reject(new Error('Impossible de soumettre votre vote. Veuillez réessayer.'));
            });
          } catch (fallbackError) {
            reject(fallbackError);
          }
        }, 5000);
        
        // Écouter l'événement de confirmation
        const handleConfirmation = (data) => {
          if (data.questionId === questionId) {
            console.log('✅ Confirmation WebSocket reçue pour le vote');
            clearTimeout(timeoutId);
            socket.off('vote:confirmation', handleConfirmation);
            resolve({ success: true });
          }
        };
        
        // S'abonner à l'événement de confirmation
        socket.on('vote:confirmation', handleConfirmation);
        
        // Envoyer le vote via WebSocket
        socket.emit('game:submit_vote', {
          gameId,
          answerId,
          questionId
        }, (ackData) => {
          if (ackData && ackData.success) {
            console.log('✅ Accusé de réception WebSocket reçu pour le vote');
            clearTimeout(timeoutId);
            socket.off('vote:confirmation', handleConfirmation);
            resolve({ success: true });
          } else if (ackData && ackData.error) {
            console.error(`❌ Erreur lors de la soumission du vote WebSocket: ${ackData.error}`);
            clearTimeout(timeoutId);
            socket.off('vote:confirmation', handleConfirmation);
            reject(new Error(ackData.error));
          }
        });
      });
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission du vote:', error);
      
      // En dernier recours, essayer via HTTP
      const url = `/games/${gameId}/vote`;
      console.log('🔐 API Request (dernier recours): POST', url);
      
      const response = await api.post(url, {
        answer_id: answerId,
        question_id: questionId
      });
      
      console.log('✅ GameService: Vote soumis avec succès via HTTP (dernier recours)');
      return response.data;
    }
  }

  // Passer au tour suivant
  async nextRound(gameId: string, retryCount = 0, maxRetries = 3) {
    try {
      const gameState = await this.getGameState(gameId);
      
      if (gameState.game.currentPhase !== 'vote' && gameState.game.currentPhase !== 'results') {
        console.warn(`⚠️ Phase incorrecte pour passage au tour suivant: ${gameState.game.currentPhase}`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        const freshState = await this.getGameState(gameId);
        
        if (freshState.game.currentPhase !== 'vote' && freshState.game.currentPhase !== 'results') {
          throw new Error("Veuillez attendre la fin des votes avant de passer au tour suivant");
        }
      }

      const url = `/games/${gameId}/next-round`;
      const response = await api.post(url);
      
      return response.data;
    } catch (error) {
      if (retryCount < maxRetries) {
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
