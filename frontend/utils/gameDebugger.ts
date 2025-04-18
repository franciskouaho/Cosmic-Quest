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
        console.log(`🔧 GameDebugger: Tentative de réparation de la connexion socket`);
        await this.repairSocketConnection();
      }
      
      // 3. Analyser l'état du jeu via WebSocket (plus rapide)
      await this.checkGameStateWebSocket(gameId);
      
      console.log(`✅ GameDebugger: Diagnostic du jeu ${gameId} terminé`);
    } catch (error) {
      console.error(`❌ GameDebugger: Erreur lors du diagnostic:`, error);
    }
  }

  /**
   * Tente de réparer la connexion socket
   */
  private async repairSocketConnection(): Promise<boolean> {
    try {
      // Nettoyer complètement le socket existant
      await SocketService.cleanup();
      console.log(`🧹 Socket nettoyé complètement`);
      
      // Activer l'initialisation automatique
      SocketService.setAutoInit(true);
      
      // Importer et utiliser testSocketConnection qui a une logique de réessai
      const { testSocketConnection } = await import('./socketTester');
      const connectionSuccess = await testSocketConnection(3);
      
      if (connectionSuccess) {
        console.log(`✅ Connexion socket réparée avec succès`);
      } else {
        console.warn(`⚠️ Échec de la réparation socket après plusieurs tentatives`);
      }
      
      return connectionSuccess;
    } catch (error) {
      console.error(`❌ Erreur lors de la réparation socket:`, error);
      return false;
    }
  }

  /**
   * Vérifie l'état du socket
   */
  private async checkSocketState(): Promise<boolean> {
    try {
      let socket;
      
      try {
        // Tenter d'obtenir le socket sans forcer l'initialisation
        socket = SocketService.getSocketInstance();
      } catch (getError) {
        console.warn(`⚠️ Impossible d'obtenir l'instance socket:`, getError);
        return false;
      }
      
      if (!socket) {
        console.warn(`⚠️ Instance socket non disponible`);
        return false;
      }
      
      console.log(`📊 État Socket:
        - Connecté: ${socket.connected || false}
        - ID: ${socket.id || 'Non connecté'}
        - URL: ${SOCKET_URL}
      `);
      
      return !!socket && socket.connected;
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
      
      // Tenter d'obtenir le socket avec initialisation forcée
      console.log(`🔌 Tentative d'obtention du socket avec initialisation forcée`);
      
      let socket;
      try {
        socket = await SocketService.getInstanceAsync(true);
      } catch (socketError) {
        console.warn(`⚠️ Échec d'obtention du socket:`, socketError);
        // Continuer l'exécution pour essayer le fallback
      }
      
      if (!socket || !socket.connected) {
        console.warn(`⚠️ Socket non disponible ou non connecté, tentative alternative`);
        
        // Importer la méthode emergencyGameRecovery
        const { emergencyGameRecovery } = await import('./socketTester');
        await emergencyGameRecovery(gameId);
        
        // Essayer à nouveau d'obtenir le socket
        try {
          socket = await SocketService.getInstanceAsync(true);
        } catch (retryError) {
          console.error(`❌ Échec de la seconde tentative d'obtention du socket:`, retryError);
          return;
        }
      }
      
      if (!socket || !socket.connected) {
        console.error(`❌ Socket toujours non disponible après récupération`);
        return;
      }
      
      // Utiliser une promesse avec timeout
      const result = await Promise.race([
        new Promise<any>((resolve) => {
          socket.emit('game:get_state', { gameId, userId }, (response: any) => {
            resolve(response);
          });
        }),
        new Promise<any>((resolve) => {
          // Timeout court pour ne pas bloquer l'interface
          setTimeout(() => resolve({ success: false, error: 'Timeout' }), 2000);
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
      let socket;
      try {
        socket = await SocketService.getInstanceAsync(true);
      } catch (socketError) {
        console.warn(`⚠️ Erreur d'obtention du socket:`, socketError);
        
        // Tenter la récupération d'urgence
        try {
          const { emergencyGameRecovery } = await import('./socketTester');
          await emergencyGameRecovery(gameId);
          socket = await SocketService.getInstanceAsync(true);
        } catch (recoveryError) {
          console.error(`❌ Échec de récupération d'urgence:`, recoveryError);
        }
      }
      
      if (!socket || !socket.connected) {
        await SocketService.reconnect();
      }
      
      // 2. Rejoindre le canal du jeu à nouveau
      try {
        await SocketService.joinGameChannel(gameId);
      } catch (joinError) {
        console.warn(`⚠️ Erreur lors de la jointure au canal:`, joinError);
        
        // Essayer avec reconnectToRoom qui est plus résilient
        await SocketService.reconnectToRoom(`game:${gameId}`, 3);
      }
      
      // 3. Forcer une vérification de phase
      const forceCheckSuccess = await SocketService.forcePhaseCheck(gameId);
      
      if (!forceCheckSuccess) {
        console.warn(`⚠️ Échec du forcePhaseCheck, tentative via GameStateHelper`);
        await GameStateHelper.forceGameRecovery(gameId);
      }
      
      console.log(`✅ GameDebugger: Réparation du jeu ${gameId} terminée`);
      return true;
    } catch (error) {
      console.error(`❌ GameDebugger: Erreur lors de la réparation:`, error);
      return false;
    }
  }

  /**
   * Diagnostic complet du système de socket
   */
  public static async diagnosticSocketSystem(): Promise<void> {
    console.log(`🔍 Diagnostic complet du système Socket.IO`);
    
    try {
      // 1. Vérifier la configuration
      console.log(`🌐 URL Socket configurée: ${SOCKET_URL}`);
      
      // 2. Vérifier la connexion internet
      const netInfo = await NetInfo.fetch();
      console.log(`🌐 État de la connexion internet: ${netInfo.isConnected ? 'Connecté' : 'Déconnecté'} (${netInfo.type})`);
      
      if (!netInfo.isConnected) {
        console.error(`❌ Pas de connexion internet, impossible de continuer`);
        return;
      }
      
      // 3. Vérifier l'état actuel du socket
      const socketInstance = SocketService.getSocketInstance();
      console.log(`🔌 État actuel: ${socketInstance ? (socketInstance.connected ? 'Connecté' : 'Déconnecté') : 'Non initialisé'}`);
      
      // 4. Tester une nouvelle connexion
      try {
        console.log(`🔄 Test de nouvelle connexion...`);
        
        // Nettoyer complètement le socket existant
        await SocketService.cleanup();
        
        // Activer l'auto-init et forcer une nouvelle connexion
        SocketService.setAutoInit(true);
        const socket = await SocketService.getInstanceAsync(true);
        
        console.log(`🔌 Nouvelle connexion: ${socket.connected ? 'Réussie' : 'Échouée'}`);
        
        if (!socket.connected) {
          console.log(`🔄 Tentative de connexion manuelle...`);
          socket.connect();
          
          // Attendre une courte période pour voir si la connexion réussit
          await new Promise(r => setTimeout(r, 3000));
          console.log(`🔌 État après tentative manuelle: ${socket.connected ? 'Connecté' : 'Toujours déconnecté'}`);
        }
      } catch (connectionError) {
        console.error(`❌ Erreur lors de la tentative de connexion:`, connectionError);
      }
      
      // 5. Diagnostic des services connexes
      try {
        console.log(`🔍 Diagnostic de GameStateHelper...`);
        // Vérifier l'état du GameStateHelper
        console.log(`🗄️ Cache GameStateHelper: ${GameStateHelper.hasCachedData() ? 'Disponible' : 'Vide'}`);
      } catch (helperError) {
        console.warn(`⚠️ Erreur lors du diagnostic de GameStateHelper:`, helperError);
      }
      
      console.log(`✅ Diagnostic du système Socket.IO terminé`);
    } catch (error) {
      console.error(`❌ Erreur lors du diagnostic socket:`, error);
    }
  }
}

// Exporter le service
export default GameDebugger.getInstance();
