import api from '@/config/axios';
import socketService from '@/services/socketService';
import UserIdManager from './userIdManager';

/**
 * Utilitaire pour aider à résoudre les problèmes d'état du jeu
 * et pour forcer des transitions de phase lorsque le jeu est bloqué
 */
export class GameStateHelper {
  /**
   * Force la transition de phase d'un jeu
   * @param gameId ID du jeu
   * @param targetPhase Phase cible ('answer', 'vote', 'results')
   */
  static async forcePhaseTransition(gameId: string, targetPhase: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameStateHelper] Tentative de forcer la phase ${targetPhase} pour le jeu ${gameId}`);
      
      // Méthode 1: Utiliser Socket.IO
      try {
        const socket = await socketService.getInstanceAsync(true);
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`⚠️ [GameStateHelper] Timeout lors de la demande de transition de phase par socket`);
            resolve(false);
          }, 5000);
          
          socket.emit('game:force_phase', { gameId, targetPhase }, (response: any) => {
            clearTimeout(timeout);
            
            if (response && response.success) {
              console.log(`✅ [GameStateHelper] Phase ${targetPhase} forcée avec succès via Socket.IO`);
              resolve(true);
            } else {
              console.warn(`⚠️ [GameStateHelper] Échec de forçage de phase via Socket.IO:`, response?.error || 'Raison inconnue');
              resolve(false);
            }
          });
        });
      } catch (socketError) {
        console.error(`❌ [GameStateHelper] Erreur socket:`, socketError);
        
        // Si échec via socket, essayer la méthode HTTP
        return this.forcePhaseTransitionHttp(gameId, targetPhase);
      }
    } catch (error) {
      console.error(`❌ [GameStateHelper] Erreur lors du forçage de phase:`, error);
      return false;
    }
  }
  
  /**
   * Force la transition de phase via HTTP
   */
  static async forcePhaseTransitionHttp(gameId: string, targetPhase: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameStateHelper] Tentative de forcer la phase ${targetPhase} via HTTP`);
      
      const userId = await UserIdManager.getUserId();
      
      const response = await api.post(`/games/${gameId}/force-phase`, { 
        user_id: userId,
        target_phase: targetPhase 
      });
      
      if (response.data?.success) {
        console.log(`✅ [GameStateHelper] Phase ${targetPhase} forcée avec succès via HTTP`);
        return true;
      } else {
        console.warn(`⚠️ [GameStateHelper] Échec de forçage de phase via HTTP:`, response.data?.error || 'Raison inconnue');
        return false;
      }
    } catch (error) {
      console.error(`❌ [GameStateHelper] Erreur HTTP lors du forçage de phase:`, error);
      return false;
    }
  }
  
  /**
   * Vérifie si un joueur a répondu mais est toujours en phase question
   */
  static async checkAndFixPhaseInconsistency(gameId: string, hasAnswered: boolean, currentPhase: string): Promise<boolean> {
    if (hasAnswered && currentPhase === 'question') {
      console.log(`⚠️ [GameStateHelper] Incohérence détectée: joueur a répondu mais toujours en phase question`);
      return await this.forcePhaseTransition(gameId, 'answer');
    }
    return false;
  }
  
  /**
   * Vérifie si un jeu est bloqué et tente de le débloquer
   */
  static async checkAndUnblockGame(gameId: string): Promise<boolean> {
    try {
      console.log(`🔍 [GameStateHelper] Vérification des blocages pour le jeu ${gameId}`);
      
      // Utiliser HTTP pour vérifier l'état actuel du jeu
      const userId = await UserIdManager.getUserId();
      const response = await api.get(`/games/${gameId}/check-blocked?user_id=${userId}`);
      
      if (response.data?.blocked) {
        console.log(`⚠️ [GameStateHelper] Jeu bloqué détecté: phase=${response.data.currentPhase}`);
        
        // Forcer la transition vers la phase suivante
        const nextPhase = this.getNextPhase(response.data.currentPhase);
        if (nextPhase) {
          return await this.forcePhaseTransition(gameId, nextPhase);
        }
      }
      
      return false;
    } catch (error) {
      console.error(`❌ [GameStateHelper] Erreur lors de la vérification de blocage:`, error);
      return false;
    }
  }
  
  /**
   * Détermine la phase suivante basée sur la phase actuelle
   */
  private static getNextPhase(currentPhase: string): string | null {
    switch (currentPhase) {
      case 'question': return 'answer';
      case 'answer': return 'vote';
      case 'vote': return 'results';
      case 'results': return null; // Nécessite next-round plutôt qu'un changement de phase
      default: return null;
    }
  }

  /**
   * Force la récupération d'un jeu bloqué
   * Approche agressive pour les cas difficiles
   */
  public static async forceGameRecovery(gameId: string): Promise<boolean> {
    console.log(`🚑 Tentative de récupération forcée pour le jeu ${gameId}`);
    
    try {
      // 1. S'assurer que la connexion socket est active
      const socketConnected = await this.ensureSocketConnection();
      if (!socketConnected) {
        console.warn(`⚠️ Impossible d'établir une connexion socket fiable`);
        // Continuer quand même avec les autres approches
      }
      
      // 2. Forcer une transition de phase via HTTP
      try {
        const userId = await UserIdManager.getUserId();
        console.log(`👤 Utilisateur ${userId} tente une récupération forcée`);
        
        // Récupérer l'état actuel du jeu
        const gameState = await gameService.getGameState(gameId);
        const currentPhase = gameState?.game?.currentPhase;
        
        console.log(`🎮 Phase actuelle: ${currentPhase}`);
        
        // Déterminer la phase cible en fonction de la phase actuelle
        let targetPhase;
        if (currentPhase === 'question') {
          targetPhase = 'answer';
        } else if (currentPhase === 'answer') {
          targetPhase = 'vote';
        } else if (currentPhase === 'vote') {
          targetPhase = 'results';
        } else {
          targetPhase = 'question'; // Par défaut, revenir à la question
        }
        
        console.log(`🎯 Transition forcée vers la phase ${targetPhase}`);
        
        // Tenter la transition de phase via différentes méthodes
        let success = false;
        
        // Méthode 1: API directe
        try {
          success = await gameService.forcePhaseTransition(gameId, targetPhase);
          if (success) {
            console.log(`✅ Transition forcée réussie via API directe`);
            return true;
          }
        } catch (apiError) {
          console.warn(`⚠️ Échec de transition via API:`, apiError);
        }
        
        // Méthode 2: Socket special
        if (!success) {
          try {
            const socket = await SocketService.getInstanceAsync(true);
            
            success = await new Promise<boolean>((resolve) => {
              const timeout = setTimeout(() => resolve(false), 3000);
              
              socket.emit('game:force_phase', { 
                gameId,
                targetPhase,
                userId,
                force: true,
                emergency: true
              }, (response: any) => {
                clearTimeout(timeout);
                resolve(response?.success || false);
              });
            });
            
            if (success) {
              console.log(`✅ Transition forcée réussie via Socket special`);
              return true;
            }
          } catch (socketError) {
            console.warn(`⚠️ Échec de transition via Socket:`, socketError);
          }
        }
        
        // Méthode 3: Forcer un rafraîchissement complet via l'API HTTP
        if (!success) {
          try {
            const refreshReq = await fetch(`${API_URL}/games/${gameId}/force-check-phase`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await AsyncStorage.getItem('@auth_token')}`,
                'userId': userId || ''
              },
              body: JSON.stringify({ 
                user_id: userId,
                target_phase: targetPhase,
                force: true
              })
            });
            
            const refreshResult = await refreshReq.json();
            
            if (refreshResult.status === 'success') {
              console.log(`✅ Récupération forcée réussie via HTTP direct`);
              return true;
            }
          } catch (httpError) {
            console.warn(`⚠️ Échec de récupération via HTTP direct:`, httpError);
          }
        }
        
        console.log(`⚠️ Toutes les méthodes de récupération ont échoué`);
        return false;
      } catch (error) {
        console.error(`❌ Erreur lors de la récupération forcée:`, error);
        return false;
      }
    } catch (outerError) {
      console.error(`❌ Erreur critique lors de la récupération:`, outerError);
      return false;
    }
  }

  /**
   * Vérifie si le cache contient des données
   */
  public static hasCachedData(): boolean {
    return this.gameStateCache.size > 0;
  }

  /**
   * S'assure que la connexion socket est établie
   */
  private static async ensureSocketConnection(): Promise<boolean> {
    try {
      // Activer l'auto-init pour les sockets
      SocketService.setAutoInit(true);
      
      try {
        // Essayer d'obtenir le socket avec initialisation forcée
        const socket = await SocketService.getInstanceAsync(true);
        if (socket.connected) {
          return true;
        }
        
        // Si le socket existe mais n'est pas connecté, tenter de le connecter
        socket.connect();
        
        // Attendre jusqu'à 3 secondes pour la connexion
        return await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 3000);
          
          socket.once('connect', () => {
            clearTimeout(timeout);
            resolve(true);
          });
        });
      } catch (error) {
        console.warn(`⚠️ Erreur lors de l'obtention du socket:`, error);
        
        // Tentative de reconnexion directe
        return await SocketService.reconnect();
      }
    } catch (outerError) {
      console.error(`❌ Erreur critique dans ensureSocketConnection:`, outerError);
      return false;
    }
  }
}

export default GameStateHelper;
