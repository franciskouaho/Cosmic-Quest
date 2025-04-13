import { GameState, GamePhase } from '../types/gameTypes';

/**
 * Utilitaire de débogage pour les problèmes de ciblage des joueurs
 */
export const debugTargetPlayerState = (
  gameState: GameState | null, 
  userId: string | number | null
) => {
  if (!gameState || !gameState.targetPlayer || !userId) {
    return { hasInconsistency: false };
  }

  // Standardiser les types en string pour la comparaison
  const targetPlayerId = String(gameState.targetPlayer.id);
  const currentUserId = String(userId);
  
  // Déterminer si l'utilisateur est la cible basé sur l'ID
  const isTargetByComparison = targetPlayerId === currentUserId;
  
  // Récupérer la valeur du serveur
  const isTargetPlayer = !!gameState.currentUserState?.isTargetPlayer;
  
  // Ajouter plus de détails pour faciliter le débogage
  console.log(`🐞 DEBUG [TargetPlayer]:
    - Phase actuelle: ${gameState.phase}
    - Joueur cible ID: ${targetPlayerId} (${typeof gameState.targetPlayer.id})
    - Utilisateur actuel ID: ${currentUserId} (${typeof userId})
    - isTargetPlayer depuis l'état: ${isTargetPlayer}
    - isTargetPlayer par comparaison: ${isTargetByComparison}
    - Correspondance des détections: ${isTargetPlayer === isTargetByComparison ? 'OUI ✅' : 'NON ❌'}
  `);
  
  // Alerter en cas d'incohérence
  if (isTargetPlayer !== isTargetByComparison) {
    console.error(`⚠️ INCOHÉRENCE DÉTECTÉE: Le statut "cible" ne correspond pas!
      - Selon le serveur: ${isTargetPlayer ? 'Est la cible' : 'N\'est pas la cible'}
      - Selon l'ID: ${isTargetByComparison ? 'Est la cible' : 'N\'est pas la cible'}
      - Types - Target ID: ${typeof gameState.targetPlayer.id}, User ID: ${typeof userId}
    `);
    
    // Retourner l'incohérence pour correction éventuelle
    return { 
      hasInconsistency: true,
      correctValue: isTargetByComparison
    };
  }
  
  return { hasInconsistency: false };
};

/**
 * Analyser l'état de vote pour détecter les problèmes potentiels
 */
export const analyzeVotingState = (
  gameState: GameState | null, 
  userId: string | number | null
) => {
  if (!gameState || !gameState.currentQuestion) {
    console.log('🐞 DEBUG [VotingAnalysis]: Pas en phase de vote ou données incomplètes');
    return;
  }

  const isTarget = Boolean(gameState.currentUserState?.isTargetPlayer);
  const hasVoted = Boolean(gameState.currentUserState?.hasVoted);
  const availableAnswers = gameState.answers.filter(a => !a.isOwnAnswer).length;
  const serverPhase = gameState.game?.currentPhase || 'inconnue';
  
  console.log(`🐞 DEBUG [VotingAnalysis]:
    - Utilisateur ID: ${userId}
    - Est la cible: ${isTarget ? 'OUI' : 'NON'}
    - A déjà voté: ${hasVoted ? 'OUI' : 'NON'}
    - Phase serveur: ${serverPhase}
    - Phase UI actuelle: ${gameState.phase}
    - Réponses disponibles pour voter: ${availableAnswers}
    - Réponses totales: ${gameState.answers.length}
    - Target Player ID: ${gameState.targetPlayer?.id}
  `);
  
  // Analyser les incohérences critiques
  if (serverPhase === 'vote') {
    // 1. Si utilisateur est la cible ET n'est PAS en phase de vote → PROBLÈME
    if (isTarget && gameState.phase !== GamePhase.VOTE) {
      console.error(`⚠️ PROBLÈME CRITIQUE: Joueur ciblé (${userId}) en phase ${gameState.phase} au lieu de VOTE!`);
    }
    // 2. Si utilisateur n'est PAS la cible ET EST en phase de vote → PROBLÈME
    else if (!isTarget && gameState.phase === GamePhase.VOTE) {
      console.error(`⚠️ PROBLÈME CRITIQUE: Joueur non-ciblé (${userId}) en phase VOTE alors qu'il ne devrait pas!`);
    }
  }
};

/**
 * Fonction pour corriger le statut isTargetPlayer si nécessaire
 * Cette fonction analyse les données du jeu et retourne un état corrigé si nécessaire
 */
export const correctTargetPlayerIfNeeded = (gameState: GameState, userId: string | number): GameState => {
  if (!gameState || !userId) return gameState;
  
  const currentTarget = gameState.targetPlayer;
  if (!currentTarget) return gameState;
  
  // Déterminer le statut correct isTargetPlayer par comparaison directe des IDs
  const shouldBeTarget = currentTarget.id === userId.toString();
  const currentlyIsTarget = Boolean(gameState.currentUserState?.isTargetPlayer);
  
  // Si les statuts ne correspondent pas, corriger
  if (shouldBeTarget !== currentlyIsTarget) {
    console.warn(`⚠️ Correction automatique du statut isTargetPlayer:
      - Avant: ${currentlyIsTarget ? 'Est la cible' : 'N\'est pas la cible'}
      - Après: ${shouldBeTarget ? 'Est la cible' : 'N\'est pas la cible'}
    `);
    
    // Créer un nouvel état avec la correction
    return {
      ...gameState,
      currentUserState: {
        ...gameState.currentUserState,
        isTargetPlayer: shouldBeTarget
      }
    };
  }
  
  // Pas besoin de correction
  return gameState;
};

/**
 * Analyser l'état global du jeu pour détecter tout problème potentiel
 */
export const analyzeGameState = (gameState: GameState | null) => {
  if (!gameState) return;

  console.log(`🔍 DEBUG [GameState]: 
    - Game ID: ${gameState.game?.id}
    - Phase: ${gameState.phase} (serveur: ${gameState.game?.currentPhase})
    - Round: ${gameState.currentRound}/${gameState.totalRounds}
    - Target Player: ${gameState.targetPlayer?.name || 'Aucun'}
    - Question: ${gameState.currentQuestion?.text?.substring(0, 30) || 'Aucune'}...
    - Joueurs: ${gameState.players.length}
    - Réponses: ${gameState.answers.length}
  `);

  // Vérifier que l'état du jeu est cohérent
  const criticalIssues = [];
  const warnings = [];

  // Vérifier la correspondance entre la phase du jeu et la phase UI
  if (gameState.game?.currentPhase && mapServerPhaseToUIPhase(gameState.game.currentPhase) !== gameState.phase) {
    if (gameState.phase === GamePhase.WAITING) {
      // C'est acceptable si nous sommes en attente pour une raison particulière
      warnings.push(`Phase UI (${gameState.phase}) différente de la phase serveur (${gameState.game.currentPhase})`);
    } else {
      criticalIssues.push(`Phase UI (${gameState.phase}) ne correspond pas à la phase serveur (${gameState.game.currentPhase})`);
    }
  }

  // Vérifier l'existence d'une question
  if (!gameState.currentQuestion && gameState.phase !== GamePhase.LOADING && gameState.phase !== GamePhase.WAITING) {
    criticalIssues.push(`Pas de question définie pour la phase ${gameState.phase}`);
  }

  // Vérifier que le joueur cible est défini lorsque nécessaire
  if (!gameState.targetPlayer && gameState.phase !== GamePhase.LOADING) {
    criticalIssues.push(`Pas de joueur cible défini pour la phase ${gameState.phase}`);
  }

  // Afficher les résultats de l'analyse
  if (criticalIssues.length > 0) {
    console.error(`⚠️ PROBLÈMES CRITIQUES DÉTECTÉS (${criticalIssues.length}):
      ${criticalIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n      ')}
    `);
  }

  if (warnings.length > 0) {
    console.warn(`⚠️ AVERTISSEMENTS (${warnings.length}):
      ${warnings.map((warning, i) => `${i + 1}. ${warning}`).join('\n      ')}
    `);
  }

  if (criticalIssues.length === 0 && warnings.length === 0) {
    console.log('✅ État du jeu cohérent, aucun problème détecté');
  }

  return {
    hasCriticalIssues: criticalIssues.length > 0,
    hasWarnings: warnings.length > 0,
    criticalIssues,
    warnings
  };
};

/**
 * Convertir une phase serveur en phase UI
 */
const mapServerPhaseToUIPhase = (serverPhase: string): GamePhase => {
  switch (serverPhase) {
    case 'question': return GamePhase.QUESTION;
    case 'answer': return GamePhase.ANSWER;
    case 'vote': return GamePhase.VOTE;
    case 'results': return GamePhase.RESULTS;
    default: return GamePhase.WAITING;
  }
};

export default {
  debugTargetPlayerState,
  analyzeVotingState,
  correctTargetPlayerIfNeeded,
  analyzeGameState
};
