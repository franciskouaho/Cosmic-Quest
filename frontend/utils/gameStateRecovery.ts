/**
 * Utilitaire pour récupérer des états de jeu problématiques
 */
import SocketService from "@/services/socketService";
import api from "@/config/axios";
import UserIdManager from "./userIdManager";

export class GameStateRecovery {
  /**
   * Tente de récupérer un état de jeu défaillant
   * @param gameId ID du jeu à récupérer
   */
  static async recoverFromPersistentError(gameId: string): Promise<boolean> {
    console.log(`🔄 [GameStateRecovery] Tentative de récupération pour le jeu ${gameId}`);
    try {
      // 1. Tenter de récupérer via le socket
      const socketRecovery = await this.recoverViaSocket(gameId);
      
      if (socketRecovery) {
        console.log(`✅ [GameStateRecovery] Récupération via socket réussie`);
        return true;
      }
      
      // 2. Si échec, tenter via API REST
      const apiRecovery = await this.recoverViaAPI(gameId);
      
      if (apiRecovery) {
        console.log(`✅ [GameStateRecovery] Récupération via API réussie`);
        return true;
      }
      
      console.log(`⚠️ [GameStateRecovery] Échec de la récupération`);
      return false;
    } catch (error) {
      console.error(`❌ [GameStateRecovery] Erreur: ${error}`);
      return false;
    }
  }
  
  /**
   * Tente de récupérer l'état via un reset du socket
   */
  private static async recoverViaSocket(gameId: string): Promise<boolean> {
    try {
      // Réinitialiser la connexion socket
      const socket = await SocketService.getInstanceAsync();
      
      // Rejoindre le canal du jeu
      await SocketService.joinGameChannel(gameId);
      
      // Demander une vérification forcée
      socket.emit('game:force_check', { gameId });
      
      // Attendre 1 seconde pour que le serveur traite la demande
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error(`❌ [GameStateRecovery] Échec de récupération via socket: ${error}`);
      return false;
    }
  }
  
  /**
   * Tente de récupérer l'état via un appel API direct
   */
  private static async recoverViaAPI(gameId: string): Promise<boolean> {
    try {
      // Récupérer l'ID utilisateur pour l'authentification
      const userId = await UserIdManager.getUserId();
      if (!userId) {
        console.warn('⚠️ [GameStateRecovery] ID utilisateur non disponible');
        return false;
      }
      
      // Appeler une API de récupération (la route API standard avec un header spécial)
      const response = await api.get(`/games/${gameId}`, {
        headers: {
          'X-Recovery-Mode': 'true'
        }
      });
      
      return response.status === 200;
    } catch (error) {
      console.error(`❌ [GameStateRecovery] Échec de récupération via API: ${error}`);
      return false;
    }
  }
  
  /**
   * Fournit un état minimal en cas d'échec total
   * @param originalState État original (peut être null)
   * @param userId ID de l'utilisateur actuel
   */
  static sanitizeGameState(originalState: any, userId?: string | number): any {
    // Créer un état minimal pour éviter un crash complet
    return {
      game: {
        id: originalState?.game?.id || null,
        currentRound: originalState?.game?.currentRound || 1,
        totalRounds: originalState?.game?.totalRounds || 5,
        status: originalState?.game?.status || "in_progress",
        gameMode: originalState?.game?.gameMode || "standard",
        currentPhase: originalState?.game?.currentPhase || "question",
        scores: originalState?.game?.scores || {}
      },
      phase: originalState?.phase || "waiting",
      players: originalState?.players || [],
      answers: [],
      currentQuestion: null,
      currentUserState: {
        hasAnswered: false,
        hasVoted: false,
        isTargetPlayer: false
      }
    };
  }
}

export default GameStateRecovery;
