import SocketService from '@/services/socketService';
import UserIdManager from '@/utils/userIdManager';

class GameWebSocketService {
  /**
   * Rejoint le canal de jeu avec Socket.IO
   */
  async joinGameChannel(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 GameWebSocketService: Tentative de rejoindre le canal de jeu ${gameId}`);
      
      // Nous activons l'initialisation automatique des sockets pour les jeux
      SocketService.setAutoInit(true);
      
      // Récupérer une instance du socket (avec forceInit=true pour s'assurer qu'elle est disponible)
      const socket = await SocketService.getInstanceAsync(true);
      
      if (!socket) {
        console.error('❌ Socket non disponible après tentative d\'initialisation');
        return false;
      }
      
      return new Promise((resolve) => {
        // Définir un délai d'attente
        const timeout = setTimeout(() => {
          console.error(`⏱️ Délai d'attente dépassé pour rejoindre le jeu ${gameId}`);
          resolve(false);
        }, 5000);
        
        // Émettre l'événement pour rejoindre le jeu
        socket.emit('join-game', { gameId }, (response: any) => {
          clearTimeout(timeout);
          
          if (response && response.success !== false) {
            console.log(`✅ Jeu ${gameId} rejoint avec succès`);
            resolve(true);
          } else {
            console.warn(`⚠️ Échec de rejoindre le jeu ${gameId}:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de rejoindre le jeu ${gameId}:`, error);
      return false;
    }
  }
  
  /**
   * Quitte le canal de jeu avec Socket.IO
   */
  async leaveGameChannel(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 GameWebSocketService: Tentative de quitter le canal de jeu ${gameId}`);
      
      // On vérifie d'abord si le socket est connecté
      if (!SocketService.isConnected()) {
        console.log(`ℹ️ Socket déjà déconnecté, rien à faire pour quitter ${gameId}`);
        return true;
      }
      
      const socket = SocketService.getSocketInstance();
      if (!socket) {
        console.warn('⚠️ Socket non disponible, considéré comme déjà quitté');
        return true;
      }
      
      return new Promise((resolve) => {
        // Définir un délai d'attente
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout lors de la tentative de quitter le jeu ${gameId}`);
          resolve(false);
        }, 5000);
        
        // Émettre l'événement pour quitter le jeu
        socket.emit('leave-game', { gameId }, (response: any) => {
          clearTimeout(timeout);
          
          if (response && response.success !== false) {
            console.log(`✅ Jeu ${gameId} quitté avec succès`);
            resolve(true);
          } else {
            console.warn(`⚠️ Échec de quitter le jeu ${gameId}:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de quitter le jeu ${gameId}:`, error);
      return false;
    }
  }
  
  /**
   * Vérifie si l'utilisateur est l'hôte du jeu
   */
  async isUserHost(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 GameWebSocketService: Vérification si l'utilisateur est l'hôte du jeu ${gameId}`);
      
      // Récupérer l'ID utilisateur
      const userId = await UserIdManager.getUserId();
      if (!userId) {
        console.error('❌ ID utilisateur non disponible');
        return false;
      }
      
      // Si le socket n'est pas connecté, on ne peut pas vérifier
      if (!SocketService.isConnected()) {
        console.warn('⚠️ Socket non connecté, impossible de vérifier le statut d\'hôte');
        return false;
      }
      
      const socket = SocketService.getSocketInstance();
      if (!socket) {
        console.warn('⚠️ Socket non disponible, impossible de vérifier le statut d\'hôte');
        return false;
      }
      
      return new Promise((resolve) => {
        // Définir un délai d'attente
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout lors de la vérification du statut d'hôte pour ${gameId}`);
          resolve(false);
        }, 5000);
        
        // Émettre l'événement pour vérifier si l'utilisateur est l'hôte
        socket.emit('game:check_host', { gameId, userId }, (response: any) => {
          clearTimeout(timeout);
          resolve(response?.isHost || false);
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification du statut d'hôte:`, error);
      return false;
    }
  }
}

export default new GameWebSocketService();
