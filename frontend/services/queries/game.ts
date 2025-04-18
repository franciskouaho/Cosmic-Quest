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

  // Liste des phases valides du jeu
  private readonly VALID_PHASES = ['question', 'answer', 'vote', 'results', 'waiting'] as const;
  private readonly PHASE_TRANSITIONS = {
    'question': ['answer'],
    'answer': ['vote', 'waiting'],
    'vote': ['results'],
    'results': ['question'],
    'waiting': ['question', 'answer', 'vote']
  };

  constructor() {
    // Vérifier périodiquement si on peut réactiver le socket
    setInterval(() => {
      if (!this.socketEnabled && this.socketFailCounter < this.MAX_SOCKET_FAILS) {
        console.log('🔄 GameService: Tentative de réactivation du WebSocket');
        this.socketEnabled = true;
      }
    }, this.SOCKET_RESET_INTERVAL);
  }

  // Vérifier si une phase est valide
  private isValidPhase(phase: string): boolean {
    return this.VALID_PHASES.includes(phase as any);
  }

  // Vérifier si une transition de phase est valide
  private isValidTransition(from: string, to: string): boolean {
    if (!this.isValidPhase(from) || !this.isValidPhase(to)) {
      console.error(`❌ Phase invalide détectée: ${from} -> ${to}`);
      return false;
    }
    return this.PHASE_TRANSITIONS[from]?.includes(to) || false;
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
          
          // Validation de la phase reçue avec plus de tolérance
          if (gameData && gameData.game && gameData.game.currentPhase) {
            const currentPhase = gameData.game.currentPhase;
            
            if (!this.isValidPhase(currentPhase)) {
              console.error(`❌ Phase invalide reçue du serveur: ${currentPhase}`);
              gameData.game.currentPhase = 'question'; // Fallback à la phase par défaut
            }
            
            // Mise à jour du cache avec validation plus souple
            if (this.gameStateCache.has(gameId)) {
              const previousState = this.gameStateCache.get(gameId).state;
              const previousPhase = previousState.game.currentPhase;
              
              if (previousPhase === currentPhase) {
                // Même phase, pas d'avertissement
                console.log(`ℹ️ Phase maintenue: ${currentPhase}`);
              } else if (!this.isValidTransition(previousPhase, currentPhase)) {
                console.warn(`⚠️ Transition de phase non standard: ${previousPhase} -> ${currentPhase}`);
                // On accepte quand même la transition mais on la log
              }
            }

            // Mettre en cache l'état
            this.gameStateCache.set(gameId, {
              state: gameData,
              timestamp: Date.now()
            });
          }
          
          // Stocker également dans AsyncStorage pour une persistance plus longue
          this.persistGameState(gameId, gameData);
          
          return gameData;
        } catch (wsError) {
          console.error(`❌ Erreur lors de la récupération via WebSocket:`, wsError);
          
          // Incrémenter le compteur d'échecs du WebSocket
          this.socketFailCounter++;
          
          // Si on a dépassé le nombre maximum de échecs, désactiver temporairement le WebSocket
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
      
      // Validation de la phase reçue avec plus de tolérance
      if (gameData && gameData.game && gameData.game.currentPhase) {
        const currentPhase = gameData.game.currentPhase;
        
        if (!this.isValidPhase(currentPhase)) {
          console.error(`❌ Phase invalide reçue du serveur: ${currentPhase}`);
          gameData.game.currentPhase = 'question'; // Fallback à la phase par défaut
        }
        
        // Mise à jour du cache avec validation plus souple
        if (this.gameStateCache.has(gameId)) {
          const previousState = this.gameStateCache.get(gameId).state;
          const previousPhase = previousState.game.currentPhase;
          
          if (previousPhase === currentPhase) {
            // Même phase, pas d'avertissement
            console.log(`ℹ️ Phase maintenue: ${currentPhase}`);
          } else if (!this.isValidTransition(previousPhase, currentPhase)) {
            console.warn(`⚠️ Transition de phase non standard: ${previousPhase} -> ${currentPhase}`);
            // On accepte quand même la transition mais on la log
          }
        }

        // Mettre en cache l'état
        this.gameStateCache.set(gameId, {
          state: gameData,
          timestamp: Date.now()
        });
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
   * Soumettre une réponse à une question directement via HTTP REST
   */
  async submitAnswer(gameId: string, questionId: string, content: string) {
    console.log(`🎮 GameService: Soumission de réponse pour le jeu ${gameId}, question ${questionId}`);
    
    try {
      // Récupérer l'ID utilisateur
      const userId = await UserIdManager.getUserId();
      console.log(`👤 GameService: Soumission de réponse par utilisateur ${userId}`);
      
      // Utiliser directement HTTP REST pour une fiabilité maximale
      console.log('🌐 Envoi de la réponse via HTTP REST...');
      
      const response = await api.post(`/games/${gameId}/answer`, {
        question_id: questionId,
        content: content,
        user_id: userId,
      }, {
        timeout: 8000  // Augmenter le timeout pour assurer la réception
      });
      
      if (response.data?.status === 'success') {
        console.log('✅ Réponse soumise avec succès via HTTP');
        return true;
      } else {
        console.error('❌ Réponse du serveur inattendue:', response.data);
        throw new Error(response.data?.error || 'Échec de la soumission via HTTP');
      }
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission de la réponse:', error);
      throw error;
    }
  }

  /**
   * Soumettre un vote pour une réponse directement via HTTP REST
   */
  async submitVote(gameId: string, answerId: string, questionId: string) {
    try {
      const userId = await UserIdManager.getUserId();
      
      const response = await api.post(`/games/${gameId}/vote`, {
        answer_id: answerId,
        question_id: questionId,
        voter_id: userId,
        prevent_auto_progress: true // Pour empêcher la progression automatique
      }, {
        timeout: 12000,  // Timeout augmenté 
        headers: {
          'X-Priority': 'high',
          'X-Vote-Request': 'true'
        }
      });
      
      if (response.data?.status === 'success') {
        console.log('✅ Vote soumis avec succès via HTTP');
        
        // Forcer une mise à jour immédiate de l'état local
        this.gameStateCache.delete(gameId);
        
        // Forcer une mise à jour de l'état du jeu après le vote
        setTimeout(() => this.getGameState(gameId, 0, 1, true), 300);
        setTimeout(() => this.getGameState(gameId, 0, 1, true), 1000);
      } else {
        throw new Error(response.data?.message || "Erreur inconnue lors du vote");
      }
    } catch (error) {
      console.error('❌ Erreur lors de la soumission du vote:', error);
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
      
      // Utiliser la méthode d'instance au lieu de la méthode statique
      return await gameWebSocketService.isUserHost(String(gameId));
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification de l'hôte:`, error);
      return false;
    }
  }

  /**
   * Passer au tour suivant via HTTP uniquement
   */
  async nextRound(gameId: string, forceAdvance: boolean = false): Promise<any> {
    try {
      console.log(`🌐 Passage au tour suivant via HTTP direct pour le jeu ${gameId}`);
      
      // Invalider immédiatement le cache pour forcer un rechargement après
      this.gameStateCache.delete(gameId);
      
      // Récupérer l'ID utilisateur
      const userId = await UserIdManager.getUserId();
      if (!userId) {
        throw new Error("ID utilisateur non disponible");
      }
      
      // Faire la requête HTTP directement
      const response = await api.post(`/games/${gameId}/next-round`, {
        user_id: userId,
        force_advance: forceAdvance
      }, {
        headers: {
          'X-Direct-Method': 'true'
        },
        timeout: 12000 // timeout plus long pour assurer une chance de succès
      });
      
      console.log(`✅ Réponse du serveur pour passage au tour suivant:`, response.data);
      
      if (response.data?.status === 'success') {
        // Forcer un rafraîchissement des données après un court délai
        setTimeout(() => this.getGameState(gameId, 0, 1, true), 800);
        return response.data;
      } else {
        throw new Error(response.data?.message || "Échec du passage au tour suivant");
      }
    } catch (error) {
      console.error(`❌ Erreur lors du passage au tour suivant:`, error);
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
   * Force la transition vers la phase answer
   */
  async forceTransitionToAnswer(gameId: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameService] Tentative de forcer la phase answer pour le jeu ${gameId}`);
      
      // S'assurer que la connexion WebSocket est active
      await this.ensureSocketConnection(gameId);
      
      // Utiliser directement socketService au lieu de GameWebSocketService
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise((resolve, reject) => {
        // Définir un timeout de 5 secondes
        const timeout = setTimeout(() => {
          reject(new Error('Timeout dépassé pour la transition forcée'));
        }, 5000);
        
        // Émettre l'événement pour forcer la phase answer
        socket.emit('game:force_phase', {
          gameId,
          targetPhase: 'answer'
        }, (response: any) => {
          clearTimeout(timeout);
          
          if (response && response.success) {
            console.log(`✅ [GameService] Transition forcée réussie vers phase answer`);
            resolve(true);
          } else {
            console.error(`❌ [GameService] Échec de la transition forcée:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`❌ [GameService] Erreur lors de la transition forcée:`, error);
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
