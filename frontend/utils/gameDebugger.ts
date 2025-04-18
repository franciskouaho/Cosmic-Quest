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
   * Vérifie l'état complet du socket et du jeu en mode instantané
   */
  public async diagnoseGameState(gameId: string): Promise<void> {
    try {
      console.log(`🔍 GameDebugger: Diagnostic du jeu ${gameId} en cours...`);
      
      // 1. Vérifier l'état du socket (instantané)
      const socketState = await this.checkSocketState();
      
      // 2. Si problème avec le socket, tenter de le réparer
      if (!socketState) {
        await SocketService.reconnect();
      }
      
      // 3. Analyser l'état du jeu via WebSocket (plus rapide)
      await this.checkGameStateWebSocket(gameId);
      
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
   * Vérifie l'état du jeu via WebSocket (plus rapide que HTTP)
   */
  private async checkGameStateWebSocket(gameId: string): Promise<void> {
    try {
      const userId = await UserIdManager.getUserId();
      const socket = await SocketService.getInstanceAsync();
      
      // Utiliser une promesse avec timeout
      const result = await Promise.race([
        new Promise<any>((resolve) => {
          socket.emit('game:get_state', { gameId, userId }, (response: any) => {
            resolve(response);
          });
        }),
        new Promise<any>((resolve) => {
          // Timeout court pour ne pas bloquer l'interface
          setTimeout(() => resolve({ success: false, error: 'Timeout' }), 1000);
        })
      ]);
      
      if (result?.success) {
        console.log(`🔌 État du jeu via WebSocket:
          - Phase: ${result.data?.game?.currentPhase}
          - Round: ${result.data?.game?.currentRound}/${result.data?.game?.totalRounds}
          - Réponses: ${result.data?.answers?.length || 0}
          - Joueurs: ${result.data?.players?.length || 0}
        `);
      } else {
        // Fallback à HTTP en cas d'échec WebSocket
        console.warn(`⚠️ Échec WebSocket, fallback HTTP sera utilisé si nécessaire`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification WebSocket:`, error);
    }
  }

  /**
   * Répare un jeu potentiellement bloqué
   */
  public static async repairGame(gameId: string): Promise<boolean> {
    try {
      console.log(`🔧 GameDebugger: Tentative de réparation du jeu ${gameId}`);
      
      // 1. Vérifier la connexion socket
      const socket = await SocketService.getInstanceAsync();
      if (!socket.connected) {
        await SocketService.reconnect();
      }
      
      // 2. Rejoindre le canal du jeu à nouveau
      await SocketService.joinGameChannel(gameId);
      
      // 3. Forcer une vérification de phase
      await SocketService.forcePhaseCheck(gameId);
      
      console.log(`✅ GameDebugger: Réparation du jeu ${gameId} terminée`);
      return true;
    } catch (error) {
      console.error(`❌ GameDebugger: Erreur lors de la réparation:`, error);
      return false;
    }
  }
}

// Exporter le service
export default GameDebugger.getInstance();
