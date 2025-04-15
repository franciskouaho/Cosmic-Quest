import { GamePhase } from '../types/gameTypes';

export class PhaseManager {
  static determineEffectivePhase(
    serverPhase: string, 
    isTargetPlayer: boolean,
    hasAnswered: boolean,
    hasVoted: boolean
  ): GamePhase {
    console.log(`📊 [PhaseManager] Détermination de la phase effective:
      - Phase serveur: ${serverPhase}
      - isTarget: ${isTargetPlayer}
      - hasAnswered: ${hasAnswered}
      - hasVoted: ${hasVoted}
    `);

    switch (serverPhase) {
      case 'question':
        if (isTargetPlayer) {
          console.log('🎯 Cible détectée: passage en phase WAITING');
          return GamePhase.WAITING;
        }
        return GamePhase.QUESTION;
        
      case 'answer':
        if (isTargetPlayer) {
          console.log('🎯 Cible détectée en phase réponse: passage en WAITING');
          return GamePhase.WAITING;
        }
        if (hasAnswered) {
          console.log('✅ Réponse déjà donnée: passage en WAITING');
          return GamePhase.WAITING;
        }
        return GamePhase.ANSWER;
        
      case 'vote':
        if (isTargetPlayer && !hasVoted) {
          console.log('🎯 Cible doit voter: passage en VOTE');
          return GamePhase.VOTE;
        }
        console.log('⏳ Attente des votes: passage en WAITING_FOR_VOTE');
        return GamePhase.WAITING_FOR_VOTE;
        
      case 'results':
        return GamePhase.RESULTS;
        
      default:
        console.warn(`⚠️ Phase serveur inconnue: ${serverPhase}, utilisation de WAITING`);
        return GamePhase.WAITING;
    }
  }

  static validatePhaseTransition(currentPhase: GamePhase, newPhase: string): boolean {
    const validTransitions = {
      [GamePhase.QUESTION]: ['answer', 'waiting'],
      [GamePhase.ANSWER]: ['vote', 'waiting'],
      [GamePhase.VOTE]: ['results', 'waiting'],
      [GamePhase.WAITING]: ['question', 'answer', 'vote', 'results'],
      [GamePhase.WAITING_FOR_VOTE]: ['vote', 'results'],
      [GamePhase.RESULTS]: ['question', 'finished'],
    };

    return validTransitions[currentPhase]?.includes(newPhase) ?? false;
  }
}
