import AsyncStorage from '@react-native-async-storage/async-storage';
import SocketService from '@/services/socketService';
import GameWebSocketService from '@/services/gameWebSocketService';

/**
 * Utilitaire pour vérifier si l'utilisateur est l'hôte d'une partie ou d'une salle
 */
class HostChecker {
  // Cache des résultats de vérification d'hôte pour éviter des requêtes répétées
  private static hostStatusCache = new Map<string, {isHost: boolean, timestamp: number}>();

  /**
   * Vérifie si l'utilisateur actuel est l'hôte de la partie
   * Utilise un cache à court terme pour éviter les vérifications répétées
   */
  static async isCurrentUserHost(gameId: string | number): Promise<boolean> {
    const cacheTTL = 10000; // 10 seconds cache
    const cacheKey = String(gameId);
    
    try {
      // Vérifier d'abord le cache en mémoire (plus rapide que AsyncStorage)
      const memCached = this.hostStatusCache.get(cacheKey);
      if (memCached && Date.now() - memCached.timestamp < cacheTTL) {
        return memCached.isHost;
      }
      
      // Ensuite vérifier le cache persistant
      const cachedResult = await AsyncStorage.getItem(`@host_status_${cacheKey}`);
      if (cachedResult) {
        const { isHost, timestamp } = JSON.parse(cachedResult);
        if (Date.now() - timestamp < cacheTTL) {
          // Mettre aussi en cache mémoire
          this.hostStatusCache.set(cacheKey, { isHost, timestamp });
          return isHost;
        }
      }
      
      // Essayer d'abord via GameWebSocketService qui est optimisé
      try {
        const result = await GameWebSocketService.isUserHost(String(gameId));
        
        // Mettre en cache les deux résultats
        const cacheData = {
          isHost: result,
          timestamp: Date.now()
        };
        
        this.hostStatusCache.set(cacheKey, cacheData);
        await AsyncStorage.setItem(`@host_status_${cacheKey}`, JSON.stringify(cacheData));
        
        return result;
      } catch (gameServiceError) {
        console.warn('⚠️ Échec vérification hôte via GameWebSocketService, tentative alternative:', gameServiceError);
      }
      
      // Si l'approche optimisée échoue, tenter via le socket directement avec timeout
      const socket = await SocketService.getInstanceAsync();
      const result = await Promise.race([
        new Promise<boolean>((resolve) => {
          socket.emit('game:check_host', { gameId }, (response: any) => {
            resolve(response?.isHost || false);
          });
        }),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000))
      ]);
      
      // Mettre en cache
      const cacheData = {
        isHost: result,
        timestamp: Date.now()
      };
      
      this.hostStatusCache.set(cacheKey, cacheData);
      await AsyncStorage.setItem(`@host_status_${cacheKey}`, JSON.stringify(cacheData));
      
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification host:', error);
      return false;
    }
  }

  /**
   * Nettoie le cache pour une partie spécifique
   * À appeler quand un changement d'hôte est possible
   */
  static async clearHostCache(gameId: string | number): Promise<void> {
    const cacheKey = String(gameId);
    
    try {
      // Supprimer du cache mémoire
      this.hostStatusCache.delete(cacheKey);
      
      // Supprimer du cache persistant
      await AsyncStorage.removeItem(`@host_status_${cacheKey}`);
      
      console.log(`🧹 Cache de statut d'hôte nettoyé pour le jeu ${gameId}`);
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage du cache d\'hôte:', error);
    }
  }

  /**
   * Définit explicitement le statut d'hôte (utilisé pour les cas spéciaux)
   */
  static async setHostStatus(gameId: string | number, isHost: boolean): Promise<void> {
    const cacheKey = String(gameId);
    
    try {
      const cacheData = {
        isHost,
        timestamp: Date.now()
      };
      
      // Sauvegarder dans les deux caches
      this.hostStatusCache.set(cacheKey, cacheData);
      await AsyncStorage.setItem(`@host_status_${cacheKey}`, JSON.stringify(cacheData));
      
      console.log(`👑 Statut d'hôte défini explicitement pour le jeu ${gameId}: ${isHost}`);
    } catch (error) {
      console.error('❌ Erreur lors de la définition du statut d\'hôte:', error);
    }
  }
}

export default HostChecker;
