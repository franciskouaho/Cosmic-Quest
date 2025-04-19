import { GamePhase, GameState } from '@/types/gameTypes';

/**
 * Gestionnaire central pour les transitions et déterminations de phases
 * Permet de garantir une logique cohérente à travers l'application
 */
export class PhaseManager {
  /**
   * Détermine la phase effective de jeu basée sur plusieurs facteurs:
   * - Phase fournie par le serveur
   * - État de l'utilisateur (cible ou non)
   * - Actions déjà effectuées (réponse, vote)
   * 
   * @param serverPhase Phase actuelle du jeu selon le serveur
   * @param isTarget Si l'utilisateur est la cible de la question
   * @param hasAnswered Si l'utilisateur a déjà répondu
   * @param hasVoted Si l'utilisateur a déjà voté
   * @returns Phase effective à afficher à l'utilisateur
   */
  static determineEffectivePhase(
    serverPhase: string,
    isTargetPlayer: boolean,
    hasAnswered: boolean,
    hasVoted: boolean
  ): string {
    console.log(`🎮 [PhaseManager] Détermination phase:
      - Phase serveur: ${serverPhase}
      - isTarget: ${isTargetPlayer}
      - hasAnswered: ${hasAnswered}
      - hasVoted: ${hasVoted}`);

    // Phase de question
    if (serverPhase === 'question') {
      if (isTargetPlayer) {
        console.log('👤 [PhaseManager] Joueur est la cible, doit attendre pendant que les autres répondent');
        return 'waiting';
      }
      
      if (hasAnswered) {
        console.log('✅ [PhaseManager] Joueur a déjà répondu, doit attendre');
        return 'waiting';
      }
      
      console.log('❓ [PhaseManager] Joueur doit répondre à la question');
      return 'question';
    }
    
    // Phase de réponse (answer) - tous les joueurs attendent
    if (serverPhase === 'answer') {
      console.log('⏳ [PhaseManager] Phase de réponse, tous les joueurs attendent');
      return 'waiting';
    }
    
    // Phase de vote
    if (serverPhase === 'vote') {
      // Correction importante: Si le joueur est la cible, il doit voir l'écran de vote
      // même si isTargetPlayer est false en raison d'une désynchronisation
      if (isTargetPlayer) {
        if (hasVoted) {
          console.log('🗳️ [PhaseManager] Joueur cible a déjà voté, doit attendre');
          return 'waiting';
        }
        
        console.log('🎯 [PhaseManager] Joueur cible doit voter');
        return 'vote';
      } else {
        console.log('👤 [PhaseManager] Joueur n\'est pas la cible');
        console.log('🗳️ [PhaseManager] Joueur n\'est pas la cible, doit attendre pendant le vote');
        return 'waiting_for_vote';
      }
    }
    
    // Phase de résultats
    if (serverPhase === 'results') {
      console.log('🏆 [PhaseManager] Phase de résultats');
      return 'results';
    }
    
    // Phase d'attente (générique)
    if (serverPhase === 'waiting') {
      console.log('⏱️ [PhaseManager] Phase d\'attente générique');
      return 'waiting';
    }
    
    // Par défaut, retourner la phase telle quelle
    console.log(`⚠️ [PhaseManager] Phase non reconnue: ${serverPhase}, utilisation telle quelle`);
    return serverPhase;
  }

  /**
   * Dernière phase calculée, utilisée pour la détection de transitions anormales
   */
  private static lastPhase: GamePhase | null = null;
  
  /**
   * Détermine la phase suivante basée sur la phase actuelle
   */
  static getNextPhase(currentPhase: string): string | null {
    switch (currentPhase) {
      case 'question': return 'answer';
      case 'answer': return 'vote';
      case 'vote': return 'results';
      case 'results': return 'question'; // Pour démarrer un nouveau tour
      default: return null;
    }
  }
  
  /**
   * Vérifie si la transition entre deux phases est valide
   */
  static isValidTransition(fromPhase: string, toPhase: string): boolean {
    // Transitions valides normales
    const validTransitions: Record<string, string[]> = {
      'question': ['answer', 'vote'], // Permet le passage direct question -> vote
      'answer': ['vote'],
      'vote': ['results'],
      'results': ['question']
    };
    
    return validTransitions[fromPhase]?.includes(toPhase) || false;
  }
  
  /**
   * Réinitialise le gestionnaire de phases
   */
  static reset(): void {
    this.lastPhase = null;
  }
}

/**
 * Corrige l'état du jeu pour s'assurer que la cible voit bien l'écran de vote
 * @param gameState État du jeu actuel
 * @param userId ID de l'utilisateur courant
 * @returns État du jeu corrigé
 */
export function ensureCorrectVoteTarget(gameState: GameState, userId: string | number | null): GameState {
  // Si nous ne sommes pas en phase vote, ignorer
  if (gameState.game?.currentPhase !== 'vote') {
    console.log(`❌ [ensureCorrectVoteTarget] Pas en phase vote: ${gameState.game?.currentPhase}`);
    return gameState;
  }
  
  // S'il n'y a pas d'utilisateur, ignorer
  if (!userId) {
    console.log(`❌ [ensureCorrectVoteTarget] Pas d'ID utilisateur`);
    return gameState;
  }
  
  // Normaliser l'identifiant de l'utilisateur en chaîne
  const userIdStr = String(userId);
  
  // Ajout log DEBUG complet pour toutes les sources d'ID cible
  console.log('[DEBUG VOTE] ensureCorrectVoteTarget - userId:', userIdStr, 
    'currentQuestion.targetPlayer.id:', gameState.currentQuestion?.targetPlayer?.id, 
    'targetPlayer.id:', gameState.targetPlayer?.id, 
    'raw.targetPlayerId:', (gameState as any).targetPlayerId, 
    '_targetPlayerId:', (gameState as any)._targetPlayerId, 
    'backupTargetId:', (gameState as any).backupTargetId, 
    'socketTargetId:', (gameState as any).socketTargetId
  );
  
  // Plusieurs façons de déterminer si l'utilisateur est la cible
  let isUserTarget = false;
  
  // 1. Vérifier via currentQuestion.targetPlayer.id (le plus fiable)
  if (gameState.currentQuestion?.targetPlayer?.id) {
    const targetPlayerId = String(gameState.currentQuestion.targetPlayer.id);
    isUserTarget = targetPlayerId === userIdStr;
    console.log(`🔍 [ensureCorrectVoteTarget] Vérification via currentQuestion.targetPlayer.id: ${targetPlayerId} === ${userIdStr} => ${isUserTarget}`);
  } else {
    console.log(`⚠️ [ensureCorrectVoteTarget] currentQuestion.targetPlayer.id non disponible`);
  }
  
  // 2. Vérifier via targetPlayer.id (parfois disponible)
  if (!isUserTarget && gameState.targetPlayer?.id) {
    isUserTarget = String(gameState.targetPlayer.id) === userIdStr;
    console.log(`🔍 [ensureCorrectVoteTarget] Vérification via targetPlayer.id: ${gameState.targetPlayer.id} === ${userIdStr} => ${isUserTarget}`);
  } else {
    console.log(`⚠️ [ensureCorrectVoteTarget] targetPlayer.id non disponible`);
  }
  
  // 3. Vérifier via les données brutes possiblement disponibles
  if (!isUserTarget && (gameState as any).targetPlayerId) {
    isUserTarget = String((gameState as any).targetPlayerId) === userIdStr;
    console.log(`🔍 [ensureCorrectVoteTarget] Vérification via raw.targetPlayerId: ${(gameState as any).targetPlayerId} === ${userIdStr} => ${isUserTarget}`);
  } else {
    console.log(`⚠️ [ensureCorrectVoteTarget] raw.targetPlayerId non disponible`);
  }
  
  // 4. Vérifier via _targetPlayerId (stocké par le gestionnaire d'événements)
  if (!isUserTarget && (gameState as any)._targetPlayerId) {
    isUserTarget = String((gameState as any)._targetPlayerId) === userIdStr;
    console.log(`🔍 [ensureCorrectVoteTarget] Vérification via _targetPlayerId: ${(gameState as any)._targetPlayerId} === ${userIdStr} => ${isUserTarget}`);
  } else {
    console.log(`⚠️ [ensureCorrectVoteTarget] _targetPlayerId non disponible`);
  }
  
  // 5. Vérifier via backupTargetId
  if (!isUserTarget && (gameState as any).backupTargetId) {
    isUserTarget = String((gameState as any).backupTargetId) === userIdStr;
    console.log(`🔍 [ensureCorrectVoteTarget] Vérification via backupTargetId: ${(gameState as any).backupTargetId} === ${userIdStr} => ${isUserTarget}`);
  } else {
    console.log(`⚠️ [ensureCorrectVoteTarget] backupTargetId non disponible`);
  }
  
  // 6. Vérifier via socketTargetId
  if (!isUserTarget && (gameState as any).socketTargetId) {
    isUserTarget = String((gameState as any).socketTargetId) === userIdStr;
    console.log(`🔍 [ensureCorrectVoteTarget] Vérification via socketTargetId: ${(gameState as any).socketTargetId} === ${userIdStr} => ${isUserTarget}`);
  } else {
    console.log(`⚠️ [ensureCorrectVoteTarget] socketTargetId non disponible`);
  }
  
  // Logs de débogage détaillés
  console.log(`🔎 [ensureCorrectVoteTarget] Vérification finale du joueur ${userIdStr} comme cible:`, {
    'currQuestion.targetId': gameState.currentQuestion?.targetPlayer?.id,
    'targetPlayer.id': gameState.targetPlayer?.id,
    'raw.targetPlayerId': (gameState as any).targetPlayerId,
    '_targetPlayerId': (gameState as any)._targetPlayerId,
    'backupTargetId': (gameState as any).backupTargetId,
    'socketTargetId': (gameState as any).socketTargetId,
    'isTarget': isUserTarget,
    'gameState': gameState
  });
  
  // Si l'utilisateur est la cible mais que ce n'est pas reflété dans l'état
  // OU si la propriété n'existe pas, la définir
  if (isUserTarget) {
    console.log(`🎯 [ensureCorrectVoteTarget] Utilisateur ${userIdStr} identifié comme cible en phase de vote`);
    
    // Créer une copie profonde de l'état pour éviter les problèmes de référence
    const correctedState = JSON.parse(JSON.stringify(gameState));
    
    // Mettre à jour currentUserState
    if (!correctedState.currentUserState) {
      correctedState.currentUserState = {
        isTargetPlayer: true,
        hasAnswered: false,
        hasVoted: false
      };
    } else {
      correctedState.currentUserState.isTargetPlayer = true;
    }
    
    // Forcer la phase à vote si nécessaire
    if (correctedState.phase !== 'vote') {
      correctedState.phase = 'vote';
    }
    
    console.log(`🔄 [ensureCorrectVoteTarget] État corrigé pour le joueur cible ${userIdStr}:`, {
      isTargetPlayer: correctedState.currentUserState.isTargetPlayer,
      phase: correctedState.phase,
      correctedState
    });
    
    return correctedState;
  } else {
    // Si l'utilisateur n'est pas la cible, forcer la phase à waiting_for_vote
    console.log(`⏳ [ensureCorrectVoteTarget] Utilisateur ${userIdStr} n'est pas la cible, forçage de la phase à waiting_for_vote`);
    
    const correctedState = JSON.parse(JSON.stringify(gameState));
    correctedState.phase = 'waiting_for_vote';
    
    if (!correctedState.currentUserState) {
      correctedState.currentUserState = {
        isTargetPlayer: false,
        hasAnswered: false,
        hasVoted: false
      };
    } else {
      correctedState.currentUserState.isTargetPlayer = false;
    }
    
    return correctedState;
  }
}
