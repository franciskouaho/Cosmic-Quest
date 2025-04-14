import api from '@/config/axios';
import UserIdManager from './userIdManager';
import SocketService from '@/services/socketService';

/**
 * Utilitaire pour vérifier si l'utilisateur est l'hôte d'une partie ou d'une salle
 */
class HostChecker {
  // Cache des résultats de vérification d'hôte pour éviter des requêtes répétées
  private static hostCache: Record<string, {isHost: boolean; timestamp: number; hostId?: string}> = {};
  private static cacheTTL = 30000; // 30 secondes

  /**
   * Vérifie si l'utilisateur courant est l'hôte d'une partie en privilégiant WebSocket
   * @param gameId ID de la partie
   * @returns true si l'utilisateur est l'hôte, false sinon
   */
  static async isCurrentUserHost(gameId: string | number): Promise<boolean> {
    if (!gameId) {
      console.warn('⚠️ HostChecker: gameId manquant pour la vérification de l\'hôte');
      return false;
    }

    const cacheKey = String(gameId);
    const userId = await UserIdManager.getUserId();
    if (!userId) {
      console.warn('⚠️ HostChecker: ID utilisateur non disponible');
      return false;
    }

    // Vérifier d'abord le cache
    const cachedResult = this.hostCache[cacheKey];
    if (cachedResult && Date.now() - cachedResult.timestamp < this.cacheTTL) {
      console.log(`👑 [Cache] Résultat hôte pour ${gameId}: ${cachedResult.isHost}`);
      return cachedResult.isHost;
    }

    try {
      // Essayer d'abord via WebSocket pour une réponse plus rapide
      try {
        console.log(`🔌 HostChecker: Tentative via WebSocket pour le jeu ${gameId}`);
        const socket = await SocketService.getInstanceAsync();
        
        if (socket.connected) {
          // Utiliser une Promise pour convertir le callback Socket.IO en async/await
          const checkResult = await new Promise<boolean>((resolve) => {
            socket.emit('game:check_host', { gameId, userId }, (response: any) => {
              if (response && typeof response.isHost === 'boolean') {
                // Mettre en cache le résultat
                this.hostCache[cacheKey] = { 
                  isHost: response.isHost, 
                  timestamp: Date.now(),
                  hostId: response.hostId
                };
                
                console.log(`👑 [WebSocket] L'utilisateur ${userId} ${response.isHost ? 'EST' : 'N\'EST PAS'} l'hôte du jeu ${gameId}`);
                resolve(response.isHost);
              } else {
                // En cas de réponse incorrecte, continuer avec l'API REST
                resolve(null);
              }
            });
            
            // Timeout pour éviter de bloquer si pas de réponse
            setTimeout(() => resolve(null), 1500);
          });
          
          // Si on a une réponse valide, la retourner directement
          if (checkResult !== null) {
            return checkResult;
          }
        }
      } catch (socketError) {
        console.warn(`⚠️ HostChecker: Échec via WebSocket: ${socketError.message}`);
        // Continuer avec la méthode HTTP
      }

      // Si WebSocket échoue ou n'est pas disponible, utiliser l'API REST
      console.log(`🔍 HostChecker: Vérification via REST API pour ${gameId}`);
      
      // Récupérer les infos du jeu
      try {
        const response = await api.get(`/games/${gameId}`);
        
        if (response.data?.data?.game) {
          const game = response.data.data.game;
          
          // Si le jeu a un hostId direct
          if (game.hostId) {
            const isHost = String(game.hostId) === String(userId);
            this.hostCache[cacheKey] = { 
              isHost, 
              timestamp: Date.now(),
              hostId: String(game.hostId)
            };
            
            console.log(`👑 HostChecker: L'utilisateur ${userId} ${isHost ? 'EST' : 'N\'EST PAS'} l'hôte du jeu ${gameId}`);
            return isHost;
          }
          
          // Si le jeu a un roomId, essayer via la salle
          if (game.roomId) {
            try {
              return await this.checkRoomHost(game.roomId, userId);
            } catch (roomError) {
              if (roomError.response?.status === 404) {
                // Si la salle n'existe plus mais que nous sommes dans un jeu,
                // conserver l'état d'hôte basé sur la validation WebSocket
                
                // Essayer de récupérer l'information d'hôte depuis le stockage local
                try {
                  const gameHostInfo = await this.getGameHostFromStorage(gameId);
                  if (gameHostInfo) {
                    const isHost = gameHostInfo.hostId === String(userId);
                    this.hostCache[cacheKey] = { 
                      isHost, 
                      timestamp: Date.now(),
                      hostId: gameHostInfo.hostId
                    };
                    
                    console.log(`👑 [LocalStorage] L'utilisateur ${userId} ${isHost ? 'EST' : 'N\'EST PAS'} l'hôte du jeu ${gameId}`);
                    return isHost;
                  }
                } catch (storageError) {
                  console.warn(`⚠️ Erreur lors de la récupération du stockage: ${storageError.message}`);
                }
                
                // Si aucune information n'est disponible, supposer que l'utilisateur n'est pas l'hôte
                this.hostCache[cacheKey] = { isHost: false, timestamp: Date.now() };
                return false;
              }
              throw roomError;
            }
          }
        }
      } catch (gameError) {
        console.warn(`⚠️ HostChecker: Erreur lors de la récupération des infos du jeu: ${gameError.message}`);
      }
      
      // Si tout échoue, essayer directement avec roomId = gameId
      try {
        return await this.checkRoomHost(gameId, userId);
      } catch (error) {
        if (error.response?.status === 404) {
          // La salle n'existe plus, stocker un résultat négatif dans le cache
          this.hostCache[cacheKey] = { isHost: false, timestamp: Date.now() };
        }
        throw error;
      }
    } catch (error) {
      console.error(`❌ HostChecker: Erreur lors de la vérification de l'hôte:`, error);
      
      // En cas d'erreur, mettre en cache un résultat négatif pour éviter des requêtes répétées
      this.hostCache[cacheKey] = { isHost: false, timestamp: Date.now() };
      return false;
    }
    
    // Par défaut
    this.hostCache[cacheKey] = { isHost: false, timestamp: Date.now() };
    return false;
  }

  /**
   * Vérifie si un utilisateur est l'hôte d'une salle spécifique
   * @param roomId ID de la salle
   * @param userId ID de l'utilisateur
   * @returns true si l'utilisateur est l'hôte
   */
  private static async checkRoomHost(roomId: string | number, userId: string | number): Promise<boolean> {
    try {
      console.log(`🔍 HostChecker: Vérification via salle ${roomId}`);
      const response = await api.get(`/rooms/${roomId}`);
      
      if (response.data?.data?.room?.hostId) {
        const hostId = response.data.data.room.hostId;
        const isHost = String(hostId) === String(userId);
        
        // Stocker aussi l'information dans le stockage local
        await this.storeGameHostInfo(roomId, {
          hostId: String(hostId),
          timestamp: Date.now()
        });
        
        console.log(`👑 HostChecker: L'utilisateur ${userId} ${isHost ? 'EST' : 'N\'EST PAS'} l'hôte de la salle ${roomId}`);
        return isHost;
      }
      return false;
    } catch (error) {
      if (error.response?.status === 404) {
        console.warn(`⚠️ HostChecker: Salle ${roomId} non trouvée`);
      } else {
        console.error(`❌ HostChecker: Erreur lors de la vérification via la salle:`, error);
      }
      throw error;
    }
  }
  
  /**
   * Stocke les informations d'hôte d'un jeu dans le stockage local
   */
  private static async storeGameHostInfo(gameId: string | number, info: { hostId: string, timestamp: number }): Promise<void> {
    try {
      const { AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const key = `@game_host_${gameId}`;
      await AsyncStorage.setItem(key, JSON.stringify(info));
    } catch (error) {
      console.warn(`⚠️ Erreur lors du stockage d'information d'hôte:`, error);
    }
  }
  
  /**
   * Récupère les informations d'hôte d'un jeu depuis le stockage local
   */
  private static async getGameHostFromStorage(gameId: string | number): Promise<{ hostId: string, timestamp: number } | null> {
    try {
      const { AsyncStorage } = await import('@react-native-async-storage/async-storage');
      const key = `@game_host_${gameId}`;
      const data = await AsyncStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.warn(`⚠️ Erreur lors de la récupération d'information d'hôte:`, error);
      return null;
    }
  }

  /**
   * Invalide le cache pour un gameId spécifique ou pour tous les jeux
   */
  static invalidateCache(gameId?: string | number): void {
    if (gameId) {
      delete this.hostCache[String(gameId)];
    } else {
      this.hostCache = {};
    }
  }
}

export default HostChecker;
