import api from '@/config/axios';
import socketService from '@/services/socketService';
import UserIdManager from './userIdManager';
import { PhaseManager } from './phaseManager';

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
      
      // Vérifier d'abord l'état actuel du jeu pour détecter des transitions non standards
      try {
        const gameState = await gameService.getGameState(gameId);
        const currentPhase = gameState?.game?.currentPhase;
        
        if (currentPhase && !PhaseManager.isValidTransition(currentPhase, targetPhase)) {
          console.warn(`⚠️ [GameStateHelper] Tentative de transition non standard: ${currentPhase} -> ${targetPhase}`);
          // Continuer quand même avec la transition
        }
      } catch (error) {
        console.warn(`⚠️ [GameStateHelper] Impossible de vérifier l'état actuel avant transition:`, error);
        // Continuer avec la transition
      }
      
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
              
              // Invalider le cache après une transition réussie
              gameService.invalidateGameState(gameId);
              
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
        target_phase: targetPhase,
        force_transition: true // Ajouter un flag pour forcer même les transitions non standards
      });
      
      if (response.data?.success) {
        console.log(`✅ [GameStateHelper] Phase ${targetPhase} forcée avec succès via HTTP`);
        
        // Invalider le cache après une transition réussie
        gameService.invalidateGameState(gameId);
        
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
    
    // Aussi vérifier les transitions incohérentes
    if (currentPhase === 'question' && this.getNextPhase(currentPhase) === 'answer') {
      // Vérifier si tous les joueurs ont répondu
      try {
        const gameState = await gameService.getGameState(gameId);
        const players = gameState?.players || [];
        const answers = gameState?.answers || [];
        const targetPlayerId = gameState?.currentQuestion?.targetPlayer?.id;
        
        // Compter les joueurs qui peuvent répondre (tous sauf la cible)
        const nonTargetPlayersCount = players.filter(p => p.id !== targetPlayerId).length;
        
        if (answers.length >= nonTargetPlayersCount) {
          console.log(`⚠️ [GameStateHelper] Tous les joueurs ont répondu mais toujours en phase question`);
          return await this.forcePhaseTransition(gameId, 'answer');
        }
      } catch (error) {
        console.error(`❌ [GameStateHelper] Erreur lors de la vérification des réponses:`, error);
      }
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
    return PhaseManager.getNextPhase(currentPhase);
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
   * Force spécifiquement la phase de vote pour l'utilisateur ciblé
   * @param gameId ID du jeu
   * @returns Promise<boolean> indiquant si l'opération a réussi
   */
  static async forceVotePhaseForTarget(gameId: string): Promise<boolean> {
    try {
      console.log(`🎯 [GameStateHelper] Tentative de forcer la phase de vote pour la cible dans le jeu ${gameId}`);
      
      // Vérifier d'abord si la phase actuelle est "answer"
      const gameStateCheck = await gameService.getGameState(gameId);
      if (gameStateCheck?.game?.currentPhase !== 'answer') {
        console.log(`⚠️ [GameStateHelper] La phase actuelle n'est pas 'answer' mais '${gameStateCheck?.game?.currentPhase}', vérification si l'action est nécessaire`);
        
        // Si déjà en phase vote, c'est un succès
        if (gameStateCheck?.game?.currentPhase === 'vote') {
          console.log(`✅ [GameStateHelper] Déjà en phase vote, aucune action nécessaire`);
          return true;
        }
      }
      
      // Vérifier si l'utilisateur actuel est la cible de la question
      const userId = await UserIdManager.getUserId();
      const isTarget = gameStateCheck?.currentUserState?.isTargetPlayer || 
                       (gameStateCheck?.currentQuestion?.targetPlayer && 
                        String(gameStateCheck.currentQuestion.targetPlayer.id) === String(userId));
                        
      if (!isTarget) {
        console.log(`ℹ️ [GameStateHelper] L'utilisateur n'est pas la cible, transition normale`);
        return await this.forcePhaseTransition(gameId, 'vote');
      }
      
      console.log(`🎯 [GameStateHelper] L'utilisateur est la cible, utilisation de méthode spéciale`);
      
      // Méthode 1: Via Socket avec paramètres spéciaux pour la cible
      try {
        const socket = await socketService.getInstanceAsync(true);
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), 5000);
          
          socket.emit('game:target_vote_ready', { 
            gameId, 
            targetId: userId,
            forceVotePhase: true
          }, (response: any) => {
            clearTimeout(timeout);
            
            if (response && response.success) {
              console.log(`✅ [GameStateHelper] Phase vote forcée pour la cible avec succès`);
              resolve(true);
            } else {
              console.warn(`⚠️ [GameStateHelper] Échec via Socket pour la cible:`, response?.error || 'Raison inconnue');
              resolve(false);
            }
          });
        });
      } catch (socketError) {
        console.error(`❌ [GameStateHelper] Erreur socket pour phase vote cible:`, socketError);
        
        // Fallback à la méthode HTTP
        return await this.forceTargetVoteHttp(gameId, userId);
      }
    } catch (error) {
      console.error(`❌ [GameStateHelper] Erreur lors du forçage de phase vote pour la cible:`, error);
      return false;
    }
  }
  
  /**
   * Force la transition de vote pour la cible via HTTP
   */
  private static async forceTargetVoteHttp(gameId: string, targetId: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameStateHelper] Tentative HTTP pour forcer le vote de la cible ${targetId}`);
      
      const response = await api.post(`/games/${gameId}/force-target-vote`, { 
        user_id: targetId,
        target_id: targetId,
        force: true
      });
      
      if (response.data?.success) {
        console.log(`✅ [GameStateHelper] Vote de la cible forcé avec succès via HTTP`);
        return true;
      } else {
        console.warn(`⚠️ [GameStateHelper] Échec via HTTP pour vote cible:`, response.data?.error || 'Raison inconnue');
        return false;
      }
    } catch (error) {
      console.error(`❌ [GameStateHelper] Erreur HTTP pour vote cible:`, error);
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
