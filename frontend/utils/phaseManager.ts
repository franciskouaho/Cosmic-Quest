import { GamePhase } from '../types/gameTypes';

export class PhaseManager {
  static determineEffectivePhase(
    serverPhase: string, 
    isTargetPlayer: boolean,
    hasAnswered: boolean,
    hasVoted: boolean
  ): GamePhase {
    switch (serverPhase) {
      case 'question':
        return isTargetPlayer ? GamePhase.WAITING : GamePhase.QUESTION;
        
      case 'answer':
        if (isTargetPlayer) return GamePhase.WAITING;
        return hasAnswered ? GamePhase.WAITING : GamePhase.ANSWER;
        
      case 'vote':
        if (isTargetPlayer && !hasVoted) return GamePhase.VOTE;
        return GamePhase.WAITING_FOR_VOTE;
        
      case 'results':
        return GamePhase.RESULTS;
        
      default:
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
