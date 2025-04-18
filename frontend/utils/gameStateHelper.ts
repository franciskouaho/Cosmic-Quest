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
}

export default GameStateHelper;
