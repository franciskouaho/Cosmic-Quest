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
    const cacheTTL = 10000; // 10 seconds cache
    const cacheKey = String(gameId);
    
    try {
      // Check cache first
      const cachedResult = await AsyncStorage.getItem(`@host_status_${cacheKey}`);
      if (cachedResult) {
        const { isHost, timestamp } = JSON.parse(cachedResult);
        if (Date.now() - timestamp < cacheTTL) {
          return isHost;
        }
      }
      
      // Try WebSocket verification
      const socket = await SocketService.getInstanceAsync();
      const result = await Promise.race([
        new Promise((resolve) => {
          socket.emit('game:check_host', { gameId }, (response: any) => {
            resolve(response?.isHost || false);
          });
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), 3000))
      ]);
      
      // Cache the result
      await AsyncStorage.setItem(`@host_status_${cacheKey}`, JSON.stringify({
        isHost: result,
        timestamp: Date.now()
      }));
      
      return result as boolean;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification host:', error);
      return false;
    }
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
