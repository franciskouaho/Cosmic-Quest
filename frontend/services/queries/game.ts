import api from '@/config/axios';
import { Answer, GameState } from '@/types/gameTypes';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserIdManager from '@/utils/userIdManager';
import GameWebSocketService from '../gameWebSocketService';

class GameService {
  // Cache pour stocker temporairement les états des jeux
  private gameStateCache: Map<string, {state: any, timestamp: number}> = new Map();
  private socketEnabled: boolean = true;
  private socketFailCounter: number = 0;
  private readonly MAX_SOCKET_FAILS = 3;
  private readonly SOCKET_RESET_INTERVAL = 60000; // 1 minute

  constructor() {
    // Vérifier périodiquement si on peut réactiver le socket
    setInterval(() => {
      if (!this.socketEnabled && this.socketFailCounter < this.MAX_SOCKET_FAILS) {
        console.log('🔄 GameService: Tentative de réactivation du WebSocket');
        this.socketEnabled = true;
      }
    }, this.SOCKET_RESET_INTERVAL);
  }

  // Récupérer l'état actuel du jeu, priorité au WebSocket
  async getGameState(gameId: string, retryCount = 0, maxRetries = 3, forceWebSocket = true) {
    console.log(`🎮 GameService: Récupération de l'état du jeu ${gameId}${forceWebSocket ? ' (WebSocket forcé)' : ''}`);

    try {
      // Vérification de la connexion internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.warn('⚠️ Pas de connexion internet disponible');
        
        // En cas de déconnexion, essayer d'utiliser le cache
        const cachedData = this.gameStateCache.get(gameId);
        if (cachedData && Date.now() - cachedData.timestamp < 30000) { // Cache de 30 secondes
          console.log(`🗄️ GameService: Utilisation du cache pour ${gameId} en mode hors ligne`);
          return cachedData.state;
        }
        
        throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
      }

      // Récupérer l'ID utilisateur avant l'appel pour le débogage et les vérifications
      let userId = undefined;
      try {
        userId = await UserIdManager.getUserId();
        console.log(`🔑 ID utilisateur détecté: ${userId || 'Non disponible'}`);
      } catch (err) {
        console.warn('⚠️ Erreur lors de la récupération de l\'ID utilisateur:', err);
      }

      // Essayer d'abord via WebSocket (nouvelle méthode préférée) si le socket est activé
      if (this.socketEnabled || forceWebSocket) {
        try {
          // Vérifier que la connexion WebSocket est bien établie avant de continuer
          await GameWebSocketService.ensureSocketConnection(gameId);
          
          console.log(`🔌 Tentative de récupération via WebSocket pour ${gameId}`);
          const gameData = await GameWebSocketService.getGameState(gameId);
          
          // Réinitialiser le compteur d'échecs puisque ça a fonctionné
          this.socketFailCounter = 0;
          this.socketEnabled = true;
          
          // Correction du statut isTargetPlayer si nécessaire
          if (gameData.currentQuestion?.targetPlayer && userId) {
            const targetId = String(gameData.currentQuestion.targetPlayer.id);
            const userIdStr = String(userId);
            
            const isReallyTarget = targetId === userIdStr;
            
            if (gameData.currentUserState && gameData.currentUserState.isTargetPlayer !== isReallyTarget) {
              console.log(`🔧 Correction d'incohérence isTargetPlayer: ${gameData.currentUserState.isTargetPlayer} => ${isReallyTarget}`);
              gameData.currentUserState.isTargetPlayer = isReallyTarget;
            }
          }
          
          // Mettre en cache l'état du jeu récupéré
          this.gameStateCache.set(gameId, {
            state: gameData,
            timestamp: Date.now()
          });
          
          // Stocker également dans AsyncStorage pour une persistance plus longue
          this.persistGameState(gameId, gameData);
          
          return gameData;
        } catch (wsError) {
          console.error(`❌ Erreur lors de la récupération via WebSocket:`, wsError);
          
          // Incrémenter le compteur d'échecs du WebSocket
          this.socketFailCounter++;
          
          // Si on a dépassé le nombre maximum d'échecs, désactiver temporairement le WebSocket
          if (this.socketFailCounter >= this.MAX_SOCKET_FAILS) {
            console.warn(`⚠️ Trop d'échecs WebSocket (${this.socketFailCounter}). WebSocket temporairement désactivé.`);
            this.socketEnabled = false;
          }
          
          // Si forceWebSocket est activé, on réessaie encore une fois sans forcage avant de passer au REST
          if (forceWebSocket) {
            console.log('🔄 Nouvelle tentative sans forcage WebSocket...');
            return this.getGameState(gameId, retryCount, maxRetries, false);
          }
          
          // Sinon on continue avec fallback REST API
        }
      }
      
      // Vérifier si on a des données en cache récentes avant de passer à l'API REST
      const cachedData = this.gameStateCache.get(gameId);
      if (cachedData && Date.now() - cachedData.timestamp < 5000) { // Cache très récent (5 secondes)
        console.log(`🗄️ GameService: Utilisation du cache récent pour ${gameId} au lieu de l'API REST`);
        return cachedData.state;
      }
      
      // Fallback via REST API comme avant
      console.log(`🔄 Fallback à l'API REST pour récupérer l'état du jeu ${gameId}`);
      
      // Le reste du code reste le même
      const url = `/games/${gameId}`;
      console.log('🔐 API Request: GET', url);
      
      // Appliquer l'ID utilisateur aux headers de manière sécurisée
      if (userId && api && api.defaults) {
        api.defaults.headers.userId = String(userId);
      }
      
      const response = await api.get(url);
      console.log('✅ GameService: État du jeu', gameId, 'récupéré avec succès');
      
      // Vérifier si la réponse est correcte et a les propriétés attendues
      if (!response.data?.data?.game) {
        console.warn('⚠️ Structure de réponse inattendue:', response.data);
        throw new Error('Données de jeu incomplètes');
      }
      
      // Le reste de la méthode reste inchangé pour la manipulation des données
      const gameData = response.data.data;
      
      // Assurer que le joueur cible est correctement identifié
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
      
      // Mettre en cache l'état du jeu récupéré via REST API
      this.gameStateCache.set(gameId, {
        state: gameData,
        timestamp: Date.now()
      });
      
      // Stocker également dans AsyncStorage pour une persistance plus longue
      this.persistGameState(gameId, gameData);
      
      return gameData;
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la récupération de l\'état du jeu', gameId, ':', error);
      
      // Vérifier si on a des données en cache même un peu anciennes
      const cachedData = this.gameStateCache.get(gameId);
      if (cachedData) {
        console.log(`🗄️ GameService: Utilisation du cache comme fallback pour ${gameId}`);
        return cachedData.state;
      }
      
      // Essayer de récupérer depuis AsyncStorage
      try {
        const persistedState = await this.loadPersistedGameState(gameId);
        if (persistedState) {
          console.log(`💾 GameService: État récupéré depuis le stockage persistant pour ${gameId}`);
          return persistedState;
        }
      } catch (storageError) {
        console.error('❌ Erreur lors de la récupération depuis le stockage persistant:', storageError);
      }
      
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
   * Persiste l'état du jeu dans AsyncStorage
   */
  private async persistGameState(gameId: string, state: GameState): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `game_state_${gameId}`, 
        JSON.stringify({
          state,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.warn('⚠️ Erreur lors de la persistence de l\'état du jeu:', error);
    }
  }

  /**
   * Récupère l'état du jeu depuis AsyncStorage
   */
  private async loadPersistedGameState(gameId: string): Promise<GameState | null> {
    try {
      const savedState = await AsyncStorage.getItem(`game_state_${gameId}`);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Vérifier si l'état n'est pas trop ancien (moins de 5 minutes)
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed.state;
        }
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Erreur lors de la récupération de l\'état persitant du jeu:', error);
      return null;
    }
  }

  /**
   * Force l'utilisation du WebSocket pour la prochaine requête
   */
  async resetWebSocketConnection(): Promise<boolean> {
    try {
      console.log('🔄 GameService: Réinitialisation de la connexion WebSocket');
      
      // Réinitialiser le compteur d'échecs
      this.socketFailCounter = 0;
      this.socketEnabled = true;
      
      // Tenter une reconnexion WebSocket
      return await GameWebSocketService.reconnect();
    } catch (error) {
      console.error('❌ Erreur lors de la réinitialisation de la connexion WebSocket:', error);
      return false;
    }
  }

  /**
   * Soumettre une réponse à une question uniquement via WebSocket
   */
  async submitAnswer(gameId: string, questionId: string, content: string) {
    console.log(`🎮 GameService: Soumission de réponse pour le jeu ${gameId}, question ${questionId}`);
    
    try {
      // Récupérer l'ID utilisateur pour le débogage
      const userId = await UserIdManager.getUserId();
      console.log(`👤 GameService: Soumission de réponse par utilisateur ${userId}`);
      
      // S'assurer que la connexion WebSocket est active
      await GameWebSocketService.ensureSocketConnection(gameId);
      
      // Utiliser notre nouvelle méthode WebSocket
      return await GameWebSocketService.submitAnswer(gameId, questionId, content);
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission de la réponse:', error);
      throw error;
    }
  }

  // Soumettre un vote pour une réponse
  async submitVote(gameId: string, answerId: string, questionId: string) {
    console.log(`🎮 GameService: Vote pour la réponse ${answerId} dans le jeu ${gameId}`);
    
    try {
      // Récupérer l'ID utilisateur pour le débogage
      const userId = await UserIdManager.getUserId();
      console.log(`👤 GameService: Soumission de vote par utilisateur ${userId}`);
      
      // S'assurer que la connexion WebSocket est active
      await GameWebSocketService.ensureSocketConnection(gameId);
      
      // Utiliser notre nouvelle méthode WebSocket
      return await GameWebSocketService.submitVote(gameId, answerId, questionId);
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission du vote:', error);
      throw error;
    }
  }

  /**
   * Vérifier si un utilisateur est l'hôte d'une salle ou d'un jeu
   */
  async isUserRoomHost(gameId: string | number, userId: string | number): Promise<boolean> {
    try {
      console.log(`👑 Vérification si utilisateur ${userId} est l'hôte de ${gameId}`);
      
      // S'assurer que la connexion WebSocket est active
      await GameWebSocketService.ensureSocketConnection(String(gameId));
      
      // Utiliser la méthode WebSocket qui a déjà toute la logique nécessaire
      return await GameWebSocketService.isUserHost(String(gameId));
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification de l'hôte:`, error);
      return false;
    }
  }

  /**
   * Passer au tour suivant
   */
  async nextRound(gameId: string) {
    try {
      console.log(`🎮 Tentative de passage au tour suivant pour le jeu ${gameId}`);
      
      // S'assurer que la connexion WebSocket est active
      const socketConnected = await this.ensureSocketConnection(gameId);
      
      if (!socketConnected) {
        console.warn("⚠️ Socket non connecté avant nextRound, tentative de connexion...");
        await this.resetWebSocketConnection();
        await new Promise(resolve => setTimeout(resolve, 800)); // Attente pour établir la connexion
      }
      
      try {
        // Utiliser notre nouvelle méthode WebSocket avec plusieurs tentatives
        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 3) {
          try {
            attempts++;
            console.log(`🎮 Tentative ${attempts}/3 de passage au tour suivant via WebSocket`);
            await GameWebSocketService.nextRound(gameId);
            success = true;
          } catch (attemptError) {
            if (attempts >= 3) throw attemptError;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Attente entre les tentatives
          }
        }
        
        console.log(`✅ Commande de passage au tour suivant envoyée avec succès pour ${gameId}`);
        
        // Invalider le cache pour forcer une mise à jour
        this.gameStateCache.delete(gameId);
        
        return { success: true };
      } catch (wsError) {
        // Si l'erreur est liée au statut d'hôte, on la gère spécialement
        if (wsError.message && wsError.message.includes("l'hôte")) {
          console.warn(`⚠️ Accès refusé: l'utilisateur n'est pas l'hôte`);
          throw wsError; // On fait remonter cette erreur spécifique
        }
        
        // Pour les autres erreurs, on peut essayer une approche différente
        console.warn(`⚠️ Erreur WebSocket, tentative via API REST: ${wsError.message}`);
        
        // Fallback vers l'API REST si possible
        const url = `/games/${gameId}/next-round`;
        const response = await api.post(url);
        
        if (response.data && response.data.status === 'success') {
          // Invalider le cache pour forcer une mise à jour
          this.gameStateCache.delete(gameId);
          
          return { success: true };
        } else {
          throw new Error('Échec du passage au tour suivant via API REST');
        }
      }
    } catch (error) {
      console.error(`❌ Échec du passage au tour suivant:`, error);
      throw error;
    }
  }

  // Ressynchroniser la connection WebSocket si nécessaire
  async ensureSocketConnection(gameId: string) {
    try {
      return await GameWebSocketService.ensureSocketConnection(gameId);
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de la connexion WebSocket:', error);
      return false;
    }
  }

  /**
   * Force la vérification de la phase du jeu
   */
  async forcePhaseCheck(gameId: string): Promise<boolean> {
    try {
      // S'assurer que la connexion WebSocket est active
      await GameWebSocketService.ensureSocketConnection(gameId);
      
      return await GameWebSocketService.forceCheckPhase(gameId);
    } catch (error) {
      console.error('❌ Erreur lors de la vérification forcée de la phase:', error);
      return false;
    }
  }

  /**
   * Nettoyer le cache interne
   */
  clearCache(gameId?: string) {
    if (gameId) {
      this.gameStateCache.delete(gameId);
      console.log(`🧹 Cache effacé pour le jeu ${gameId}`);
    } else {
      this.gameStateCache.clear();
      console.log('🧹 Cache entièrement effacé');
    }
  }
}

const gameService = new GameService();
export default gameService;
