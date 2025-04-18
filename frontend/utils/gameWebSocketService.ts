import socketService from '../services/socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';

class GameWebSocketService {
  private gameHostCache: Map<string, {hostId: string, timestamp: number}> = new Map();
  
  /**
   * Rejoint le canal de jeu avec Socket.IO
   */
  async joinGameChannel(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 [GameWebSocket] Tentative de rejoindre le jeu ${gameId}`);
      return await socketService.joinGameChannel(gameId);
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la connexion au jeu:`, error);
      return false;
    }
  }
  
  /**
   * Quitte le canal de jeu avec Socket.IO
   */
  async leaveGameChannel(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 [GameWebSocket] Tentative de quitter le jeu ${gameId}`);
      return await socketService.leaveGameChannel(gameId);
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la déconnexion du jeu:`, error);
      return false;
    }
  }
  
  /**
   * Vérifie si l'utilisateur est l'hôte du jeu
   */
  async isUserHost(gameId: string, userId: string): Promise<boolean> {
    try {
      console.log(`🔍 Vérification d'hôte pour la partie ${gameId}`);
      
      // Vérifier si nous avons des informations en cache
      const cacheKey = `@game_host_${gameId}`;
      const cachedInfo = await AsyncStorage.getItem(cacheKey);
      
      if (cachedInfo) {
        const cached = JSON.parse(cachedInfo);
        const cacheAge = Date.now() - cached.timestamp;
        
        // Si le cache est récent (moins de 5 minutes)
        if (cacheAge < 5 * 60 * 1000) {
          console.log(`🗄️ [GameWebSocket] Utilisation des informations d'hôte en cache pour ${gameId}: ${cached.hostId === userId}`);
          const isHost = cached.hostId === userId;
          console.log(`👑 Résultat vérification hôte: ${isHost ? 'EST' : "N'EST PAS"} l'hôte`);
          return isHost;
        }
      }
      
      // Si pas de cache ou cache expiré, tenter de vérifier via Socket.IO
      const socket = await socketService.getInstanceAsync();
      
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`⏱️ Timeout lors de la vérification d'hôte, retourne false`);
          resolve(false);
        }, 3000);
        
        socket.emit('game:check_host', { gameId, userId }, (response: any) => {
          clearTimeout(timeout);
          const isHost = !!response?.isHost;
          console.log(`👑 Résultat vérification hôte: ${isHost ? 'EST' : "N'EST PAS"} l'hôte`);
          
          // Mettre en cache pour éviter des requêtes répétées
          AsyncStorage.setItem(cacheKey, JSON.stringify({
            hostId: response?.hostId || null,
            timestamp: Date.now()
          }));
          
          resolve(isHost);
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la vérification d'hôte:`, error);
      return false;
    }
  }
  
  /**
   * Force la vérification de la phase du jeu
   */
  async forcePhaseCheck(gameId: string): Promise<boolean> {
    try {
      return await socketService.forcePhaseCheck(gameId);
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors du forçage de la vérification de phase:`, error);
      return false;
    }
  }
}

export default new GameWebSocketService();
