import { Socket } from 'socket.io-client';
import SocketService from './socketService';
import UserIdManager from '@/utils/userIdManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebSocketResponse } from '@/types/gameTypes';
import { PhaseManager } from '../utils/phaseManager';
import api, { API_URL } from '@/config/axios';

class GameWebSocketService {
  private pendingRequests: Map<string, { promise: Promise<any>, timestamp: number }> = new Map();
  private gameStateCache: Map<string, { state: any, timestamp: number }> = new Map();
  private joinedGames: Set<string> = new Set();
  private pendingJoinRequests: Map<string, Promise<void>> = new Map();
  private readonly CACHE_TTL = 3000; // 3 secondes
  private readonly REQUEST_TIMEOUT = 5000; // 5 secondes
  private readonly RECONNECT_DELAY = 1000; // 1 seconde
  private cacheTimeout = 2000; // 2 secondes de cache
  private cacheData: Map<string, { data: any, timestamp: number }> = new Map();
  private phaseChangeTimestamps: Map<string, { phase: string, timestamp: number }> = new Map();
  private static instance: GameWebSocketService;

  // Méthode pour accéder à l'instance singleton
  public static getInstance(): GameWebSocketService {
    if (!GameWebSocketService.instance) {
      GameWebSocketService.instance = new GameWebSocketService();
    }
    return GameWebSocketService.instance;
  }

  /**
   * S'assure que la connexion Socket est établie et que l'utilisateur a rejoint le canal du jeu
   */
  async ensureSocketConnection(gameId: string): Promise<boolean> {
    try {
      // Vérifier si un socket est déjà disponible et connecté
      const socket = await SocketService.getInstanceAsync();
      
      if (!socket.connected) {
        console.log(`⚠️ [GameWebSocket] Socket non connecté, tentative de reconnexion...`);
        
        // Essayer de reconnecter avec un délai d'expiration
        const reconnectPromise = this.reconnect();
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), 2000);
        });
        
        const reconnected = await Promise.race([reconnectPromise, timeoutPromise]);
        if (!reconnected) {
          console.error(`❌ [GameWebSocket] Échec de reconnexion dans le délai imparti`);
          return false;
        }
      }
      
      // S'assurer que l'utilisateur a rejoint le canal du jeu si ce n'est pas déjà fait
      if (!this.joinedGames.has(gameId)) {
        // Vérifier si une requête de jointure est déjà en cours
        if (this.pendingJoinRequests.has(gameId)) {
          console.log(`🔄 [GameWebSocket] Jointure déjà en cours pour ${gameId}, attente...`);
          try {
            await Promise.race([
              this.pendingJoinRequests.get(gameId),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de jointure')), 3000))
            ]);
          } catch (timeoutError) {
            console.warn(`⚠️ [GameWebSocket] Timeout lors de l'attente d'une jointure en cours`);
            this.pendingJoinRequests.delete(gameId);
            return false;
          }
        } else {
          // Stocker la promesse pour la jointure
          const joinPromise = this.joinGameChannel(gameId);
          this.pendingJoinRequests.set(gameId, joinPromise);
          
          try {
            // Utiliser Promise.race pour limiter le temps d'attente
            await Promise.race([
              joinPromise,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout de jointure')), 3000)
              )
            ]);
          } catch (error) {
            console.error(`❌ [GameWebSocket] Erreur ou timeout lors de la jointure au canal:`, error);
            return false;
          } finally {
            // Supprimer la requête en attente
            this.pendingJoinRequests.delete(gameId);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la vérification de la connexion:`, error);
      return false;
    }
  }

  /**
   * Reconnecte le socket si nécessaire
   */
  async reconnect(): Promise<boolean> {
    try {
      console.log(`⚡ [GameWebSocket] Tentative de reconnexion...`);
      return await SocketService.reconnect();
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la reconnexion:`, error);
      return false;
    }
  }
  
  /**
   * Amélioration: Détecte les blocages potentiels basés sur les changements de phase
   */
  detectPhaseLock(gameId: string, currentPhase: string): boolean {
    try {
      const now = Date.now();
      const lastPhaseChange = this.phaseChangeTimestamps.get(gameId);
      
      // Si nous n'avons pas de changement de phase précédent, enregistrer celui-ci
      if (!lastPhaseChange) {
        this.phaseChangeTimestamps.set(gameId, { phase: currentPhase, timestamp: now });
        return false;
      }
      
      // Si la phase a changé, mettre à jour le timestamp
      if (lastPhaseChange.phase !== currentPhase) {
        this.phaseChangeTimestamps.set(gameId, { phase: currentPhase, timestamp: now });
        return false;
      }
      
      // Vérifier si nous sommes bloqués dans la même phase depuis trop longtemps
      const timeSinceLastChange = now - lastPhaseChange.timestamp;
      
      // Différents seuils selon la phase
      const thresholds: Record<string, number> = {
        'answer': 60000,   // 1 minute en phase réponse
        'vote': 45000,     // 45 secondes en phase vote
        'results': 30000,  // 30 secondes en phase résultats
        'question': 20000  // 20 secondes en phase question
      };
      
      const threshold = thresholds[currentPhase] || 60000;
      
      if (timeSinceLastChange > threshold) {
        console.warn(`⚠️ [GameWebSocket] Blocage potentiel détecté: phase ${currentPhase} active depuis ${Math.floor(timeSinceLastChange / 1000)} secondes`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la détection de blocage:`, error);
      return false;
    }
  }
  
  /**
   * Force la transition vers la phase answer pour corriger les blocages
   * @param gameId ID du jeu à modifier
   * @returns Promise<boolean> indiquant si l'opération a réussi
   */
  async forceTransitionToAnswer(gameId: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameWebSocket] Tentative de forcer la phase answer pour le jeu ${gameId}`);
      
      // Attendre que le socket soit connecté
      const socket = await this.ensureSocketConnection(gameId);
      
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
            console.log(`✅ [GameWebSocket] Transition forcée réussie vers phase answer`);
            resolve(true);
          } else {
            console.error(`❌ [GameWebSocket] Échec de la transition forcée:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la transition forcée:`, error);
      return false;
    }
  }

  /**
   * Amélioration: Tente de récupérer d'un blocage de phase
   */
  async recoverFromPhaseLock(gameId: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameWebSocket] Tentative de récupération de blocage pour ${gameId}...`);
      
      // 1. Forcer une vérification de phase sur le serveur via HTTP
      const userId = await UserIdManager.getUserId();
      await api.post(`${API_URL}/games/${gameId}/force-check-phase`, {
        user_id: userId
      });
      
      // 2. Réinitialiser le cache local
      this.clearGameStateCache(gameId);
      
      // 3. Forcer l'obtention d'un nouvel état
      await this.getGameState(gameId);

      console.log(`✅ [GameWebSocket] Récupération de blocage tentée pour ${gameId}`);
      return true;
    } catch (error) {
      console.error(`❌ [GameWebSocket] Échec de récupération de blocage:`, error);
      return false;
    }
  }

  /**
   * Nettoie le cache d'état pour un jeu spécifique
   */
  clearGameStateCache(gameId: string): void {
    this.gameStateCache.delete(gameId);
    this.cacheData.delete(gameId);
    console.log(`🧹 [GameWebSocket] Cache nettoyé pour le jeu ${gameId}`);
  }
  
  /**
   * Vérifie si l'utilisateur actuel est l'hôte de la partie
   * Amélioration pour utiliser les infos en cache si disponibles
   */
  async isUserHost(gameId: string): Promise<boolean> {
    try {
      // Vérifier d'abord dans le cache en mémoire
      const cachedState = this.gameStateCache.get(gameId)?.state;
      
      if (cachedState) {
        const userId = await UserIdManager.getUserId();
        const isHost = String(cachedState.game?.hostId) === String(userId);
        console.log(`🗄️ [GameWebSocket] Utilisation des informations d'hôte en cache pour ${gameId}: ${isHost}`);
        return isHost;
      }
      
      // Si pas en cache, vérifier via AsyncStorage
      try {
        const cachedInfo = await AsyncStorage.getItem(`@game_host_${gameId}`);
        if (cachedInfo) {
          const { hostId, timestamp } = JSON.parse(cachedInfo);
          const userId = await UserIdManager.getUserId();
          
          // N'utiliser le cache que s'il est récent (5 minutes max)
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            const isHost = String(hostId) === String(userId);
            console.log(`🗄️ [GameWebSocket] Utilisation des informations d'hôte persistantes pour ${gameId}: ${isHost}`);
            return isHost;
          }
        }
      } catch (cacheError) {
        console.warn(`⚠️ [GameWebSocket] Erreur lors de la lecture du cache:`, cacheError);
      }
      
      // Si aucune information en cache, vérifier via le serveur
      const socket = await SocketService.getInstanceAsync();
      return new Promise<boolean>((resolve) => {
        const timeoutId = setTimeout(() => {
          console.warn(`⚠️ [GameWebSocket] Timeout lors de la vérification d'hôte, considéré comme non-hôte`);
          resolve(false);
        }, 3000);
        
        socket.emit('game:check_host', { gameId }, (response: any) => {
          clearTimeout(timeoutId);
          resolve(response?.isHost || false);
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la vérification d'hôte:`, error);
      return false;
    }
  }

  /**
   * Rejoint le canal d'un jeu spécifique
   * @param gameId ID du jeu à rejoindre
   * @returns Promise résolu quand le jeu est rejoint
   */
  async joinGameChannel(gameId: string): Promise<void> {
    try {
      console.log(`🎮 [GameWebSocket] Tentative de rejoindre le jeu ${gameId}`);
      
      // S'assurer que la connexion socket est établie
      const socket = await SocketService.getInstanceAsync();
      
      if (!socket.connected) {
        console.warn(`⚠️ [GameWebSocket] Socket non connecté, tentative de reconnexion...`);
        await this.reconnect();
      }
      
      // Récupérer l'ID utilisateur
      const userId = await UserIdManager.getUserId();
      
      return new Promise<void>((resolve, reject) => {
        // Définir un timeout
        const timeoutId = setTimeout(() => {
          console.warn(`⚠️ [GameWebSocket] Timeout lors de la tentative de rejoindre le jeu ${gameId}`);
          reject(new Error('Timeout de connexion'));
        }, 5000);
        
        // Émettre l'événement pour rejoindre le jeu
        socket.emit('join-game', { 
          gameId,
          userId,
          timestamp: Date.now()
        });
        
        // Écouter la confirmation
        socket.once('game:joined', (data) => {
          clearTimeout(timeoutId);
          
          if (data && data.gameId === gameId) {
            console.log(`✅ [GameWebSocket] Jeu ${gameId} rejoint avec succès`);
            this.joinedGames.add(gameId);
            resolve();
          } else {
            reject(new Error('Données de confirmation incorrectes'));
          }
        });
        
        console.log(`📤 [GameWebSocket] Demande de rejoindre le jeu ${gameId} envoyée`);
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la tentative de rejoindre le jeu ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère l'état complet d'un jeu
   * @param gameId ID du jeu
   * @param forceRefresh Forcer une actualisation (ignorer le cache)
   * @returns Promise avec l'état du jeu
   */
  async getGameState(gameId: string, forceRefresh: boolean = false): Promise<any> {
    try {
      console.log(`🎮 [GameWebSocket] Récupération de l'état du jeu ${gameId}${forceRefresh ? ' (forcée)' : ''}`);
      
      // Vérifier le cache si on ne force pas le rafraîchissement
      if (!forceRefresh) {
        const cachedState = this.gameStateCache.get(gameId);
        if (cachedState && Date.now() - cachedState.timestamp < this.CACHE_TTL) {
          console.log(`🗄️ [GameWebSocket] Utilisation du cache pour le jeu ${gameId}`);
          return cachedState.state;
        }
      }
      
      // Assurer que le socket est connecté
      await this.ensureSocketConnection(gameId);
      
      // Récupérer l'ID utilisateur
      const userId = await UserIdManager.getUserId();
      if (!userId) {
        throw new Error("ID utilisateur non disponible");
      }
      
      // Émettre une requête pour obtenir l'état du jeu
      return new Promise((resolve, reject) => {
        const socket = SocketService.getSocketInstance();
        
        if (!socket) {
          reject(new Error("Socket non disponible"));
          return;
        }
        
        // Configurer un timeout
        const timeoutId = setTimeout(() => {
          console.warn(`⚠️ [GameWebSocket] Timeout lors de la récupération de l'état pour ${gameId}`);
          reject(new Error("Timeout lors de la récupération de l'état du jeu"));
        }, this.REQUEST_TIMEOUT);
        
        // Émettre la requête
        socket.emit('game:get_state', { gameId, userId }, (response: any) => {
          clearTimeout(timeoutId);
          
          if (response && response.success) {
            // Sauvegarder dans le cache
            this.gameStateCache.set(gameId, {
              state: response.data,
              timestamp: Date.now()
            });
            
            // Stocker les informations d'hôte si disponibles
            if (response.data?.game?.hostId) {
              this.storeHostInfo(gameId, response.data.game.hostId);
            }
            
            // Mettre à jour le timestamp de phase
            if (response.data?.game?.currentPhase) {
              this.phaseChangeTimestamps.set(gameId, {
                phase: response.data.game.currentPhase,
                timestamp: Date.now()
              });
            }
            
            resolve(response.data);
          } else {
            reject(new Error(response?.error || "Échec de récupération de l'état du jeu"));
          }
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la récupération de l'état du jeu:`, error);
      throw error;
    }
  }

  /**
   * Force une vérification de phase du jeu côté serveur
   * @param gameId ID du jeu
   * @returns Promise<boolean> indiquant si l'opération a réussi
   */
  async forceCheckPhase(gameId: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameWebSocket] Forçage de vérification de phase pour le jeu ${gameId}`);
      
      // Assurer que le socket est connecté
      await this.ensureSocketConnection(gameId);
      
      // Récupérer l'ID utilisateur
      const userId = await UserIdManager.getUserId();
      
      return new Promise<boolean>((resolve) => {
        const socket = SocketService.getSocketInstance();
        
        if (!socket) {
          console.error(`❌ [GameWebSocket] Socket non disponible pour force check`);
          resolve(false);
          return;
        }
        
        // Configurer un timeout
        const timeoutId = setTimeout(() => {
          console.warn(`⚠️ [GameWebSocket] Timeout lors du force check pour ${gameId}`);
          resolve(false);
        }, 5000);
        
        // Émettre la requête
        socket.emit('game:force_check', { gameId, userId }, (response: any) => {
          clearTimeout(timeoutId);
          
          if (response && response.success) {
            console.log(`✅ [GameWebSocket] Vérification forcée réussie pour ${gameId}`);
            
            // Nettoyer le cache pour forcer un rafraîchissement
            this.clearGameStateCache(gameId);
            
            resolve(true);
          } else {
            console.warn(`⚠️ [GameWebSocket] Échec de la vérification forcée: ${response?.error || 'Raison inconnue'}`);
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors du forçage de vérification:`, error);
      return false;
    }
  }

  /**
   * Stocke les informations d'hôte localement
   */
  private async storeHostInfo(gameId: string, hostId: string | number): Promise<void> {
    try {
      const userId = await UserIdManager.getUserId();
      const isHost = String(hostId) === String(userId);
      
      await AsyncStorage.setItem(`@game_host_${gameId}`, JSON.stringify({
        hostId: String(hostId),
        timestamp: Date.now(),
        isHost
      }));
    } catch (error) {
      console.warn(`⚠️ [GameWebSocket] Erreur lors du stockage des infos d'hôte:`, error);
    }
  }
}

// Modification de l'export pour utiliser à la fois l'instance et les méthodes statiques
const gameWebSocketService = new GameWebSocketService();

// Ajout des fonctions statiques pour maintenir la compatibilité avec le code existant
export const isUserHost = async (gameId: string): Promise<boolean> => {
  return await gameWebSocketService.isUserHost(gameId);
};

class InstantGameWebSocketService {
  // Singleton
  private static instance: InstantGameWebSocketService;
  
  // Paramètres optimisés pour un jeu instantané
  private readonly REQUEST_TIMEOUT = 1000; // 1 seconde max pour les requêtes
  private readonly CACHE_TTL = 1000; // 1 seconde de cache
  
  // Cache des états de jeu
  private gameStateCache: Map<string, { state: any, timestamp: number }> = new Map();
  
  // Cache des jointures de jeu
  private joinedGames: Set<string> = new Set();
  
  // Requêtes en attente
  private pendingRequests: Map<string, { promise: Promise<any>, timestamp: number }> = new Map();
  
  constructor() {
    // Nettoyage périodique du cache et des requêtes en attente
    setInterval(() => this.cleanupCache(), 60000);
  }
  
  public static getInstance(): InstantGameWebSocketService {
    if (!InstantGameWebSocketService.instance) {
      InstantGameWebSocketService.instance = new InstantGameWebSocketService();
    }
    return InstantGameWebSocketService.instance;
  }
  
  /**
   * Nettoie le cache et les requêtes en attente
   */
  private cleanupCache(): void {
    const now = Date.now();
    
    // Nettoyer le cache des états
    for (const [key, value] of this.gameStateCache.entries()) {
      if (now - value.timestamp > 60000) { // 1 minute
        this.gameStateCache.delete(key);
      }
    }
    
    // Nettoyer les requêtes en attente
    for (const [key, value] of this.pendingRequests.entries()) {
      if (now - value.timestamp > 10000) { // 10 secondes
        this.pendingRequests.delete(key);
      }
    }
  }
  
  /**
   * Rejoint le canal de jeu immédiatement
   */
  public async joinGameChannel(gameId: string): Promise<boolean> {
    try {
      // Si déjà joint, retourner true immédiatement
      if (this.joinedGames.has(gameId)) {
        return true;
      }
      
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise<boolean>((resolve) => {
        // Timeout rapide pour éviter de bloquer l'interface
        const timeout = setTimeout(() => {
          console.log(`⏱️ Timeout jointure au jeu ${gameId}`);
          resolve(false);
        }, this.REQUEST_TIMEOUT);
        
        socket.emit('join-game', { gameId }, (response: any) => {
          clearTimeout(timeout);
          
          if (response?.success) {
            this.joinedGames.add(gameId);
            resolve(true);
          } else {
            resolve(false);
          }
        });
        
        // Même sans confirmation, considérer comme joint 
        // pour ne pas bloquer l'expérience utilisateur
        this.joinedGames.add(gameId);
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la jointure au jeu ${gameId}:`, error);
      return false;
    }
  }
  
  /**
   * Quitte le canal de jeu
   */
  public async leaveGameChannel(gameId: string): Promise<boolean> {
    try {
      if (!this.joinedGames.has(gameId)) {
        return true; // Déjà quitté
      }
      
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise<boolean>((resolve) => {
        // Timeout rapide
        const timeout = setTimeout(() => {
          this.joinedGames.delete(gameId);
          resolve(true); // Considérer comme succès même en cas de timeout
        }, this.REQUEST_TIMEOUT);
        
        socket.emit('leave-game', { gameId }, () => {
          clearTimeout(timeout);
          this.joinedGames.delete(gameId);
          resolve(true);
        });
        
        // Supprimer du cache de toute façon
        this.joinedGames.delete(gameId);
      });
    } catch (error) {
      console.error(`❌ Erreur lors du départ du jeu ${gameId}:`, error);
      this.joinedGames.delete(gameId);
      return false;
    }
  }
  
  /**
   * Vérifie si l'utilisateur est l'hôte du jeu (optimisé)
   */
  public async isUserHost(gameId: string, userId?: string): Promise<boolean> {
    try {
      // Utiliser l'ID utilisateur fourni ou le récupérer
      const effectiveUserId = userId || await UserIdManager.getUserId();
      
      if (!effectiveUserId) {
        console.error('❌ ID utilisateur non disponible');
        return false;
      }
      
      // Vérifier dans le cache d'hôte
      const cacheKey = `host:${gameId}:${effectiveUserId}`;
      const cachedStatus = this.gameStateCache.get(cacheKey);
      
      if (cachedStatus && Date.now() - cachedStatus.timestamp < this.CACHE_TTL) {
        return cachedStatus.state;
      }
      
      // Vérifier via le socket
      const socket = await SocketService.getInstanceAsync();
      
      // Créer une promesse avec timeout
      const isHost = await Promise.race([
        new Promise<boolean>((resolve) => {
          socket.emit('game:check_host', { gameId, userId: effectiveUserId }, (response: any) => {
            resolve(!!response?.isHost);
          });
        }),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), this.REQUEST_TIMEOUT);
        })
      ]);
      
      // Mettre en cache
      this.gameStateCache.set(cacheKey, { state: isHost, timestamp: Date.now() });
      
      return isHost;
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification d'hôte:`, error);
      return false;
    }
  }
  
  /**
   * Force la vérification de la phase (instantané)
   */
  public async forcePhaseCheck(gameId: string): Promise<boolean> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      // Rejoindre le canal si nécessaire
      if (!this.joinedGames.has(gameId)) {
        await this.joinGameChannel(gameId);
      }
      
      return new Promise<boolean>((resolve) => {
        // Timeout rapide
        const timeout = setTimeout(() => {
          resolve(false);
        }, this.REQUEST_TIMEOUT);
        
        socket.emit('game:force_check', { gameId }, (response: any) => {
          clearTimeout(timeout);
          resolve(!!response?.success);
        });
        
        // Envoyer aussi un event direct pour plus de réactivité
        socket.emit('game:get_state', { gameId });
      });
    } catch (error) {
      console.error(`❌ Erreur lors du forçage de la vérification de phase:`, error);
      return false;
    }
  }
  
  /**
   * Soumission instantanée de réponse
   */
  public async submitAnswer(gameId: string, questionId: string, content: string): Promise<boolean> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise<boolean>((resolve) => {
        // Timeout ultra rapide
        const timeout = setTimeout(() => {
          console.log(`⏱️ Timeout soumission de réponse, considérant comme acceptée`);
          resolve(true); // Considérer comme succès pour éviter de bloquer le joueur
        }, this.REQUEST_TIMEOUT);
        
        socket.emit('game:submit_answer', { gameId, questionId, content }, (response: any) => {
          clearTimeout(timeout);
          resolve(!!response?.success);
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la soumission de réponse:`, error);
      return false;
    }
  }
  
  /**
   * Soumission instantanée de vote
   */
  public async submitVote(gameId: string, answerId: string, questionId: string): Promise<boolean> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise<boolean>((resolve) => {
        // Timeout ultra rapide
        const timeout = setTimeout(() => {
          console.log(`⏱️ Timeout soumission de vote, considérant comme accepté`);
          resolve(true); // Considérer comme succès pour éviter de bloquer le joueur
        }, this.REQUEST_TIMEOUT);
        
        socket.emit('game:submit_vote', { gameId, answerId, questionId }, (response: any) => {
          clearTimeout(timeout);
          resolve(!!response?.success);
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la soumission de vote:`, error);
      return false;
    }
  }
}

// Création d'une instance du service instantané
const instantGameWebSocketService = new InstantGameWebSocketService();

// Exporter l'instance principale comme exportation par défaut
export default gameWebSocketService;

// Exporter le service instantané avec un nom spécifique
export { instantGameWebSocketService as InstantGameWebSocketService };
