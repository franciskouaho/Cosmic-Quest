import { GameState } from '../types/gameTypes';

/**
 * Utilitaire pour déboguer les états de jeu
 */
const gameDebugger = {
  /**
   * Analyse l'état de jeu et retourne des avertissements
   */
  analyzeGameState(state: GameState) {
    const warnings = [];
    
    // Vérifier la cohérence entre les phases UI et serveur
    if (state.phase !== state.game?.currentPhase) {
      warnings.push(`Phase UI (${state.phase}) différente de la phase serveur (${state.game?.currentPhase})`);
    }
    
    // Vérifier l'état du joueur cible pendant la phase de vote
    if (state.game?.currentPhase === 'vote' && 
        state.currentUserState?.isTargetPlayer && 
        state.phase !== 'vote' && 
        !state.currentUserState?.hasVoted) {
      warnings.push(`CRITIQUE: Le joueur cible ne voit pas l'écran de vote alors qu'il devrait`);
    }
    
    // Loguer l'état complet du jeu avec des avertissements
    console.log(`🔍 DEBUG [GameState]: 
    - Game ID: ${state.game?.id}
    - Phase: ${state.phase} (serveur: ${state.game?.currentPhase})
    - Round: ${state.currentRound}/${state.totalRounds}
    - Target Player: ${state.targetPlayer?.name}
    - Question: ${state.currentQuestion?.text?.substring(0, 30)}...
    - Joueurs: ${state.players?.length || 0}
    - Réponses: ${state.answers?.length || 0}`);
    
    if (warnings.length > 0) {
      console.warn(`⚠️ AVERTISSEMENTS (${warnings.length}):\n      ${warnings.map((w, i) => `${i+1}. ${w}`).join('\n      ')}`);
    }
    
    return warnings.length > 0;
  },
  
  /**
   * Vérifie si l'état du joueur cible est correct
   */
  debugTargetPlayerState(state: GameState, currentUserId?: string | number) {
    if (!state?.targetPlayer || !currentUserId) return null;
    
    const isTargetByState = Boolean(state.currentUserState?.isTargetPlayer);
    const isTargetByComparison = state.targetPlayer.id.toString() === currentUserId.toString();
    
    const result = {
      hasInconsistency: isTargetByState !== isTargetByComparison,
      correctValue: isTargetByComparison,
    };
    
    console.log(`🐞 DEBUG [TargetPlayer]:
    - Phase actuelle: ${state.phase}
    - Joueur cible ID: ${state.targetPlayer.id} (${typeof state.targetPlayer.id})
    - Utilisateur actuel ID: ${currentUserId} (${typeof currentUserId})
    - isTargetPlayer depuis l'état: ${isTargetByState}
    - isTargetPlayer par comparaison: ${isTargetByComparison}
    - Correspondance des détections: ${result.hasInconsistency ? 'NON ❌' : 'OUI ✅'}`);
    
    return result;
  },
  
  /**
   * Analyse spécifiquement l'état du vote
   */
  analyzeVotingState(state: GameState, currentUserId?: string | number) {
    if (state.game?.currentPhase !== 'vote' || !currentUserId) return;
    
    const isTarget = Boolean(state.currentUserState?.isTargetPlayer);
    const hasVoted = Boolean(state.currentUserState?.hasVoted);
    
    console.log(`🐞 DEBUG [VotingAnalysis]:
    - Utilisateur ID: ${currentUserId}
    - Est la cible: ${isTarget ? 'OUI' : 'NON'}
    - A déjà voté: ${hasVoted ? 'OUI' : 'NON'}
    - Phase serveur: ${state.game.currentPhase}
    - Phase UI actuelle: ${state.phase}
    - Réponses disponibles pour voter: ${state.answers?.filter(a => !a.isOwnAnswer)?.length || 0}
    - Réponses totales: ${state.answers?.length || 0}
    - Target Player ID: ${state.targetPlayer?.id}`);
    
    if (isTarget && !hasVoted && state.phase !== 'vote') {
      console.error(`⚠️ PROBLÈME CRITIQUE: Joueur ciblé (${currentUserId}) en phase ${state.phase} alors qu'il devrait être en phase VOTE!`);
    }
    
    if (!isTarget && state.phase === 'vote') {
      console.error(`⚠️ PROBLÈME CRITIQUE: Joueur non-ciblé (${currentUserId}) en phase VOTE alors qu'il ne devrait pas!`);
    }
  }
};

export default gameDebugger;
