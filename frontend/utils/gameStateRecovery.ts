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
      console.error(`❌ [GameStateRecovery] Erreur lors de la récupération:`, error);
      return false;
    }
  }
  
  /**
   * Tente de récupérer l'état via un reset du socket
   */
  static async recoverViaSocket(gameId: string): Promise<boolean> {
    console.log(`🔄 [GameStateRecovery] Tentative de récupération via WebSocket pour le jeu ${gameId}`);
    try {
      // Initialiser la connexion WebSocket si nécessaire
      await SocketService.getInstanceAsync();
      
      // Rejoindre le canal de jeu si nécessaire
      const socketDiagnostic = SocketService.diagnose();
      const isInGameChannel = socketDiagnostic.details?.currentGame === gameId || 
                             (socketDiagnostic.details?.activeGames && 
                              Array.isArray(socketDiagnostic.details.activeGames) && 
                              socketDiagnostic.details.activeGames.includes(gameId));
      
      if (!isInGameChannel) {
        console.log(`🔄 [GameStateRecovery] Tentative de rejoindre le canal de jeu ${gameId}`);
        await SocketService.joinGameChannel(gameId);
      }
      
      // Forcer une vérification de phase
      console.log(`🔄 [GameStateRecovery] Forçage d'une vérification de phase pour le jeu ${gameId}`);
      await SocketService.forcePhaseCheck(gameId);
      
      return true;
    } catch (error) {
      console.error(`❌ [GameStateRecovery] Échec de la récupération via WebSocket:`, error);
      return false;
    }
  }
  
  /**
   * Tente de récupérer l'état via un appel API direct
   */
  static async recoverViaAPI(gameId: string): Promise<boolean> {
    console.log(`🔄 [GameStateRecovery] Tentative de récupération via API pour le jeu ${gameId}`);
    try {
      // Obtenir l'ID utilisateur
      const userId = await UserIdManager.getUserId();
      if (!userId) {
        console.warn(`⚠️ [GameStateRecovery] ID utilisateur non disponible`);
        return false;
      }
      
      // Appeler l'API de récupération
      const response = await api.post(`/games/${gameId}/recover`, {
        userId,
        timestamp: Date.now()
      });
      
      return response.data?.success === true;
    } catch (error) {
      console.error(`❌ [GameStateRecovery] Échec de la récupération via API:`, error);
      return false;
    }
  }
  
  /**
   * Fournit un état minimal en cas d'échec total
   * @param gameState État original (peut être null)
   * @param userId ID de l'utilisateur actuel
   */
  static sanitizeGameState(gameState: any, userId: string | null): any {
    // Créer un état minimal en cas d'erreur majeure pour éviter un crash complet
    return {
      recovered: true,
      game: {
        id: gameState?.game?.id || 0,
        currentRound: gameState?.game?.currentRound || 1,
        totalRounds: gameState?.game?.totalRounds || 5,
        currentPhase: 'waiting',
        status: 'in_progress',
        roomId: gameState?.game?.roomId || 0,
        gameMode: gameState?.game?.gameMode || 'standard',
        scores: gameState?.game?.scores || {}
      },
      currentQuestion: null,
      answers: [],
      players: gameState?.players || [],
      currentUserState: {
        hasAnswered: false,
        hasVoted: false,
        isTargetPlayer: false
      }
    };
  }
}

export default GameStateRecovery;
