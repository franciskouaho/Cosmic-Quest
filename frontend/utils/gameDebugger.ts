import SocketService from '@/services/socketService';
import api from '@/config/axios';
import { GameState } from '../types/gameTypes';
import { UserIdManager } from './userIdManager';

/**
 * Outils de débogage pour le jeu
 */
interface GameDebuggerOptions {
  gameId: string;
  verbose?: boolean;
}

class GameDebugger {
  private gameId: string;
  private verbose: boolean;

  constructor(options: GameDebuggerOptions) {
    this.gameId = options.gameId;
    this.verbose = options.verbose || false;
    this.log('Débogueur initialisé pour le jeu ' + this.gameId);
  }

  /**
   * Journalisation conditionnelle
   */
  private log(message: string, data?: any, level: 'log' | 'warn' | 'error' = 'log'): void {
    const prefix = '🔍 [GameDebugger]';
    
    switch (level) {
      case 'warn':
        console.warn(`⚠️ ${prefix} ${message}`, data || '');
        break;
      case 'error':
        console.error(`❌ ${prefix} ${message}`, data || '');
        break;
      default:
        console.log(`${prefix} ${message}`, data || '');
    }
  }

  /**
   * Forcer une correction de phase
   */
  async forcePhaseCorrection(correctPhase: string): Promise<boolean> {
    this.log(`Tentative de correction de phase vers ${correctPhase}`);
    
    try {
      // Obtenir l'instance du service socket de manière asynchrone
      const socket = await SocketService.getInstanceAsync();
      
      // Émettre l'événement de correction
      socket.emit('forceRefreshUI', {
        type: 'phase_correction',
        correctPhase: correctPhase,
        gameId: this.gameId,
        timestamp: Date.now()
      });
      
      this.log('Signal de correction de phase envoyé');
      
      // Envoyer également un événement force_check au serveur
      socket.emit('game:force_check', {
        gameId: this.gameId
      });
      
      this.log('Signal de vérification forcée envoyé au serveur');
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la correction de phase:', error);
      return false;
    }
  }

  /**
   * Surveiller les changements de phase
   */
  async monitorPhaseChanges(): Promise<void> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      this.log('Monitoring des changements de phase activé');
      
      socket.on('game:update', (data) => {
        if (data.type === 'phase_change') {
          this.log(`Phase changée: ${data.phase}`, data);
        }
      });
    } catch (error) {
      console.error('❌ Erreur lors du monitoring des phases:', error);
    }
  }

  /**
   * Forcer une vérification de l'état du jeu
   */
  async forceStateCheck(): Promise<boolean> {
    this.log('Demande de vérification d\'état');
    
    try {
      // Utiliser le service socket existant
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise((resolve) => {
        socket.emit('game:status_check', { gameId: this.gameId }, (response) => {
          this.log('Réponse de la vérification d\'état:', response);
          resolve(true);
        });
        
        // En cas d'absence de réponse, résoudre après un délai
        setTimeout(() => resolve(false), 3000);
      });
    } catch (error) {
      console.error('❌ Erreur lors de la vérification d\'état:', error);
      return false;
    }
  }

  /**
   * Diagnostic de l'état actuel de la connexion et du jeu
   */
  async diagnoseCurrent(): Promise<any> {
    try {
      const socket = await SocketService.getInstanceAsync();
      const socketDiagnostic = SocketService.diagnose();
      
      return {
        socketConnected: socket.connected,
        socketId: socket.id,
        gameId: this.gameId,
        inGameRoom: socketDiagnostic.activeChannels.games.includes(this.gameId),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erreur de diagnostic:', error);
      return {
        error: error.message,
        socketAvailable: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Tentative de restauration d'un état de jeu bloqué
   * Cette fonction tente de restaurer une partie qui génère des erreurs 500
   */
  async recoverGameState(): Promise<boolean> {
    this.log('Tentative de restauration de l\'état du jeu');
    
    try {
      // Obtenir l'instance du service socket
      const socket = await SocketService.getInstanceAsync();
      
      // Émettre un événement spécial pour forcer une réinitialisation de l'état sur le serveur
      socket.emit('game:reset_state', {
        gameId: this.gameId,
        timestamp: Date.now()
      });
      
      this.log('Signal de restauration d\'état envoyé');

      // Donner au serveur le temps de traiter la demande
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Tenter de forcer une vérification d'état cohérent
      await SocketService.forcePhaseCheck(this.gameId);
      
      this.log('Vérification forcée effectuée');
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la restauration de l\'état:', error);
      return false;
    }
  }

  /**
   * Tentative de nettoyage d'un état de jeu bloqué via API directe
   * À utiliser quand le socket ne répond pas
   */
  async recoverGameStateViaAPI(): Promise<boolean> {
    this.log('Tentative de restauration via API REST');
    
    try {
      // Récupérer l'ID utilisateur pour l'authentification
      const userId = await UserIdManager.getUserId();
      if (!userId) {
        console.warn('⚠️ Impossible de récupérer: ID utilisateur non disponible');
        return false;
      }
      
      // Appeler une API spéciale de récupération
      const response = await api.post(`/games/${this.gameId}/recover-state`, {
        userId: userId
      });
      
      this.log('Réponse de récupération:', response.data);
      
      return response.data?.status === 'success';
    } catch (error) {
      console.error('❌ Erreur lors de la tentative de récupération via API:', error);
      return false;
    }
  }

  /**
   * Analyser l'état du jeu et détecter les problèmes potentiels
   * @param gameState État actuel du jeu
   */
  analyzeGameState(gameState: any): void {
    if (!gameState) {
      this.log('État du jeu non défini', null, 'warn');
      return;
    }
    
    // Vérifier les problèmes courants
    if (gameState.phase === 'waiting' && gameState.game?.currentPhase === 'answer') {
      this.log('Détection de possible désynchronisation: UI en attente mais serveur en phase réponse', gameState, 'warn');
    }
    
    // Vérifier si le joueur est correctement identifié comme cible
    if (gameState.currentQuestion && gameState.currentUserState) {
      this.log(`État du joueur: isTarget=${gameState.currentUserState.isTargetPlayer}, hasVoted=${gameState.currentUserState.hasVoted}`);
    }
  }

  /**
   * Vérifier la cohérence de l'état du joueur ciblé
   * @param gameState État du jeu
   * @param userId ID de l'utilisateur actuel
   */
  debugTargetPlayerState(gameState: any, userId?: string | number): { 
    hasInconsistency: boolean; 
    correctValue?: boolean; 
  } {
    if (!gameState || !gameState.currentQuestion || !userId) {
      return { hasInconsistency: false };
    }
    
    const targetId = gameState.currentQuestion.targetPlayer?.id;
    const userIdStr = String(userId);
    const targetIdStr = String(targetId || '');
    
    const calculatedIsTarget = userIdStr === targetIdStr;
    const currentIsTarget = Boolean(gameState.currentUserState?.isTargetPlayer);
    
    if (calculatedIsTarget !== currentIsTarget) {
      this.log(`Incohérence détectée: isTarget=${currentIsTarget} mais devrait être ${calculatedIsTarget}`, {
        userId: userIdStr,
        targetId: targetIdStr
      }, 'warn');
      
      return {
        hasInconsistency: true,
        correctValue: calculatedIsTarget
      };
    }
    
    return { hasInconsistency: false };
  }

  /**
   * Tentative de déblocage d'un jeu bloqué
   * @param gameId ID du jeu
   */
  async attemptToUnblock(gameId: string): Promise<boolean> {
    try {
      this.log(`Tentative de déblocage du jeu ${gameId}`);
      
      // Appeler l'API pour forcer une vérification de phase
      await SocketService.forcePhaseCheck(gameId);
      this.log(`✅ Demande de vérification de phase envoyée pour le jeu ${gameId}`);
      
      return true;
    } catch (error) {
      console.error(`❌ Échec du déblocage:`, error);
      return false;
    }
  }
}

/**
 * Utilitaire pour déboguer et corriger les problèmes d'état de jeu
 */
const gameDebugger = new GameDebugger({ gameId: '', verbose: true });

export const createGameDebugger = (options: GameDebuggerOptions): GameDebugger => {
  return new GameDebugger(options);
};

export default gameDebugger;
