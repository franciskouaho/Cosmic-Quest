import { Alert } from 'react-native';
import axios from 'axios';
import { API_URL, SOCKET_URL } from '@/config/axios';
import SocketService from '@/services/socketService';
import GameWebSocketService from '@/services/gameWebSocketService';
import UserIdManager from './userIdManager';

/**
 * Utilitaire de débogage pour les jeux Cosmic Quest
 * Fournit des fonctions pour diagnostiquer et résoudre les problèmes de synchronisation
 */
class GameDebugger {
  private static instance: GameDebugger;

  /**
   * Obtenir l'instance singleton du GameDebugger
   */
  public static getInstance(): GameDebugger {
    if (!GameDebugger.instance) {
      GameDebugger.instance = new GameDebugger();
    }
    return GameDebugger.instance;
  }

  /**
   * Vérifie l'état complet du socket et du jeu
   */
  public async diagnoseGameState(gameId: string): Promise<void> {
    try {
      console.log(`🔍 GameDebugger: Diagnostic du jeu ${gameId} en cours...`);
      
      // 1. Vérifier l'état du socket
      const socketState = await this.checkSocketState();
      
      // 2. Vérifier l'état du jeu via HTTP
      await this.checkGameStateHttp(gameId);
      
      // 3. Vérifier l'état du jeu via WebSocket
      await this.checkGameStateWebSocket(gameId);
      
      // 4. Vérifier les phases entre le serveur et le client
      await this.checkPhaseConsistency(gameId);
      
      console.log(`✅ GameDebugger: Diagnostic du jeu ${gameId} terminé`);
    } catch (error) {
      console.error(`❌ GameDebugger: Erreur lors du diagnostic:`, error);
    }
  }

  /**
   * Vérifie l'état du socket
   */
  private async checkSocketState(): Promise<boolean> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      console.log(`📊 État Socket:
        - Connecté: ${socket.connected}
        - ID: ${socket.id || 'Non connecté'}
        - URL: ${SOCKET_URL}
      `);
      
      return socket.connected;
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification du socket:`, error);
      return false;
    }
  }

  /**
   * Vérifie l'état du jeu via HTTP
   */
  private async checkGameStateHttp(gameId: string): Promise<void> {
    try {
      const userId = await UserIdManager.getUserId();
      const response = await axios.get(`${API_URL}/games/${gameId}`, {
        headers: { userId: userId }
      });
      
      console.log(`🌐 État du jeu via HTTP:
        - Phase: ${response.data?.data?.game?.currentPhase}
        - Round: ${response.data?.data?.game?.currentRound}/${response.data?.data?.game?.totalRounds}
        - Réponses: ${response.data?.data?.answers?.length || 0}
      `);
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification HTTP:`, error);
    }
  }

  /**
   * Vérifie l'état du jeu via WebSocket
   */
  private async checkGameStateWebSocket(gameId: string): Promise<void> {
    try {
      const userId = await UserIdManager.getUserId();
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise((resolve) => {
        socket.emit('game:get_state', { gameId, userId }, (response: any) => {
          if (response?.success) {
            console.log(`🔌 État du jeu via WebSocket:
              - Phase: ${response.data?.game?.currentPhase}
              - Round: ${response.data?.game?.currentRound}/${response.data?.game?.totalRounds}
              - Réponses: ${response.data?.answers?.length || 0}
            `);
          } else {
            console.error(`❌ Erreur WebSocket:`, response?.error);
          }
          resolve();
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification WebSocket:`, error);
    }
  }

  /**
   * Vérifie la cohérence des phases entre le serveur et l'UI
   */
  private async checkPhaseConsistency(gameId: string): Promise<void> {
    try {
      // Utilisez GameWebSocketService pour obtenir l'état actuel
      const state = await GameWebSocketService.getInstance().getGameState(gameId);
      
      // Analyse de la cohérence
      if (state) {
        console.log(`🧪 Analyse de cohérence des phases:
          - Phase serveur: ${state.game?.currentPhase}
          - Cible: ${state.currentUserState?.isTargetPlayer ? 'Oui' : 'Non'}
          - A répondu: ${state.currentUserState?.hasAnswered ? 'Oui' : 'Non'}
          - A voté: ${state.currentUserState?.hasVoted ? 'Oui' : 'Non'}
        `);
        
        // Détecter les incohérences potentielles
        const servPhase = state.game?.currentPhase;
        const isTarget = state.currentUserState?.isTargetPlayer;
        const hasAnswered = state.currentUserState?.hasAnswered;
        const hasVoted = state.currentUserState?.hasVoted;
        
        if (servPhase === 'answer' && hasAnswered && !isTarget) {
          console.warn(`⚠️ Incohérence détectée: Joueur a répondu mais reste en phase answer`);
        }
        
        if (servPhase === 'vote' && hasVoted && isTarget) {
          console.warn(`⚠️ Incohérence détectée: Joueur cible a voté mais reste en phase vote`);
        }
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification de cohérence:`, error);
    }
  }

  /**
   * Force la vérification de phase côté serveur
   */
  public async forceCheckPhase(gameId: string): Promise<void> {
    try {
      console.log(`🔄 GameDebugger: Forçage de vérification de phase pour le jeu ${gameId}`);
      
      const userId = await UserIdManager.getUserId();
      await axios.post(`${API_URL}/games/${gameId}/force-check-phase`, {
        user_id: userId
      });
      
      console.log(`✅ Vérification de phase forcée avec succès`);
      
      // Attendre un peu puis vérifier l'état mis à jour
      setTimeout(() => this.diagnoseGameState(gameId), 1000);
    } catch (error) {
      console.error(`❌ Erreur lors du forçage de vérification:`, error);
      Alert.alert(
        "Erreur",
        "Impossible de forcer la vérification de phase. Veuillez réessayer."
      );
    }
  }

  /**
   * Tente de réparer un jeu bloqué
   */
  public async repairGame(gameId: string): Promise<boolean> {
    try {
      console.log(`🔧 GameDebugger: Tentative de réparation du jeu ${gameId}`);
      
      // 1. Forcer la vérification de phase
      await this.forceCheckPhase(gameId);
      
      // 2. Rejoindre à nouveau le canal du jeu
      const socket = await SocketService.getInstanceAsync();
      socket.emit('join-game', { gameId });
      
      // 3. Forcer une synchronisation complète
      return await GameWebSocketService.getInstance().ensureSocketConnection(gameId);
    } catch (error) {
      console.error(`❌ Erreur lors de la réparation du jeu:`, error);
      return false;
    }
  }
}

export default GameDebugger.getInstance();
