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
  private log(message: string, data?: any) {
    if (this.verbose) {
      if (data) {
        console.log(`🔧 [GameDebugger] ${message}`, data);
      } else {
        console.log(`🔧 [GameDebugger] ${message}`);
      }
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
}

/**
 * Utilitaire pour déboguer et corriger les problèmes d'état de jeu
 */
const gameDebugger = {
  /**
   * Vérifie si l'utilisateur est correctement identifié comme étant la cible
   */
  debugTargetPlayerState: (gameState: GameState | null, userId: string | number | null | undefined) => {
    if (!gameState || !userId || !gameState.targetPlayer || !gameState.currentUserState) {
      return null;
    }

    const userIdStr = String(userId);
    const targetIdStr = String(gameState.targetPlayer.id);
    const currentlyMarkedAsTarget = Boolean(gameState.currentUserState.isTargetPlayer);
    const shouldBeTarget = userIdStr === targetIdStr;

    // Vérifier s'il y a une incohérence
    const hasInconsistency = shouldBeTarget !== currentlyMarkedAsTarget;

    if (hasInconsistency) {
      console.log(
        `⚠️ Incohérence détectée pour isTargetPlayer - Valeur actuelle: ${currentlyMarkedAsTarget}, Valeur correcte: ${shouldBeTarget}`
      );
      console.log(`🔍 Détails - ID utilisateur: ${userIdStr}, ID cible: ${targetIdStr}`);
    }

    return {
      hasInconsistency,
      currentValue: currentlyMarkedAsTarget,
      correctValue: shouldBeTarget,
      details: {
        userId: userIdStr,
        targetId: targetIdStr,
      }
    };
  },

  /**
   * Analyse l'état complet du jeu pour détecter des anomalies
   */
  analyzeGameState: (gameState: GameState | null) => {
    if (!gameState) {
      console.log('❌ Impossible d\'analyser un état de jeu null');
      return null;
    }

    // Journaliser les informations principales
    console.log('🔍 Analyse de l\'état du jeu:');
    console.log(`- Phase actuelle: ${gameState.phase}`);
    console.log(`- Tour: ${gameState.currentRound}/${gameState.totalRounds}`);
    console.log(`- Thème: ${gameState.theme}`);
    console.log(`- Nombre de joueurs: ${gameState.players?.length || 0}`);
    console.log(`- Nombre de réponses: ${gameState.answers?.length || 0}`);
    
    const targetPlayer = gameState.targetPlayer 
      ? `${gameState.targetPlayer.name} (ID: ${gameState.targetPlayer.id})` 
      : 'Aucun';
    console.log(`- Joueur cible: ${targetPlayer}`);

    // Analyser les états des utilisateurs
    const userState = gameState.currentUserState || {};
    console.log(`- État utilisateur: isTarget=${userState.isTargetPlayer}, hasAnswered=${userState.hasAnswered}, hasVoted=${userState.hasVoted}`);

    // Vérifier les incohérences courantes
    const issues = [];

    // 1. Si pas de question mais en phase de réponse/vote
    if (!gameState.currentQuestion && ['answer', 'vote'].includes(String(gameState.phase))) {
      issues.push('Question manquante pour une phase nécessitant une question');
    }

    // 2. Si pas de joueur cible mais une question est présente
    if (!gameState.targetPlayer && gameState.currentQuestion) {
      issues.push('Question présente mais joueur cible manquant');
    }

    // Journaliser les problèmes s'il y en a
    if (issues.length > 0) {
      console.warn('⚠️ Problèmes détectés dans l\'état du jeu:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
    } else {
      console.log('✅ Aucun problème majeur détecté dans l\'état du jeu');
    }

    return issues.length > 0 ? issues : null;
  },

  /**
   * Tentative de déblocage d'une partie qui semble bloquée
   */
  attemptToUnblock: async (gameId: string): Promise<boolean> => {
    try {
      console.log(`🔄 Tentative de déblocage du jeu ${gameId}...`);
      
      // Vérifier si nous avons un ID utilisateur valide
      const userId = await UserIdManager.getUserId();
      if (!userId) {
        console.warn('⚠️ Impossible de débloquer: ID utilisateur non disponible');
        return false;
      }
      
      // Appeler l'API de vérification forcée
      const response = await api.post(`/games/${gameId}/force-check-phase`);
      
      if (response.data?.status === 'success') {
        console.log(`✅ Déblocage réussi: ${response.data.message}`);
        return Boolean(response.data?.data?.phaseChanged);
      } else {
        console.log(`ℹ️ Aucun changement nécessaire: ${response.data?.message}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Erreur lors de la tentative de déblocage:', error);
      return false;
    }
  },

  /**
   * Récupérer le message d'erreur à partir d'un objet d'erreur
   */
  getErrorMessage: (error: any): string => {
    if (!error) return 'Erreur inconnue';
    
    // Tentative d'extraction du message d'erreur à partir de différentes structures
    if (error.response?.data?.error) {
      return error.response.data.error;
    } else if (error.message) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    }
    
    return 'Erreur inconnue';
  }
};

export const createGameDebugger = (options: GameDebuggerOptions): GameDebugger => {
  return new GameDebugger(options);
};

export default gameDebugger;
