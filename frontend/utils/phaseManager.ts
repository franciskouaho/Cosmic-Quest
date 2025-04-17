export enum GamePhase {
  LOADING = 'loading',
  QUESTION = 'question',
  ANSWER = 'answer',
  VOTE = 'vote',
  WAITING = 'waiting',
  WAITING_FOR_VOTE = 'waiting_for_vote',
  RESULTS = 'results',
  FINISHED = 'finished'
}

export class PhaseManager {
  static readonly VALID_TRANSITIONS = {
    'question': ['answer'],
    'answer': ['vote', 'waiting'],
    'vote': ['results', 'waiting', 'waiting_for_vote'],
    'waiting': ['vote', 'results', 'question'],
    'waiting_for_vote': ['results', 'waiting'],
    'results': ['question', 'finished'],
    'finished': []
  };

  static validatePhase(phase: string): boolean {
    return Object.values(GamePhase).includes(phase as GamePhase);
  }

  static validatePhaseTransition(from: string, to: string): boolean {
    if (!from || !to) return false;
    return this.VALID_TRANSITIONS[from]?.includes(to) || false;
  }

  static determineEffectivePhase(
    serverPhase: string,
    isTarget: boolean,
    hasAnswered: boolean,
    hasVoted: boolean
  ): string {
    console.log(`🎮 Détermination phase:
      - Phase serveur: ${serverPhase}
      - isTarget: ${isTarget}
      - hasAnswered: ${hasAnswered}
      - hasVoted: ${hasVoted}
    `);

    // Gérer les cas spéciaux avec une validation rigoureuse
    if (!serverPhase || typeof serverPhase !== 'string') {
      console.error(`⚠️ Phase serveur invalide: ${serverPhase}, utilisation de la phase par défaut 'waiting'`);
      return GamePhase.WAITING;
    }

    switch (serverPhase) {
      case 'question':
        return isTarget ? GamePhase.WAITING : GamePhase.QUESTION;
      
      case 'answer':
        return isTarget ? GamePhase.WAITING : (hasAnswered ? GamePhase.WAITING : GamePhase.ANSWER);
      
      case 'vote':
        // Cas particulier : si le joueur est la cible ET a déjà voté, il doit attendre
        if (isTarget) {
          return hasVoted ? GamePhase.WAITING : GamePhase.VOTE;
        } else {
          // Si le joueur n'est pas la cible, il attend pendant que la cible vote
          return GamePhase.WAITING_FOR_VOTE;
        }
      
      case 'results':
        return GamePhase.RESULTS;
      
      case 'finished':
        return GamePhase.FINISHED;
      
      case 'waiting':
        return GamePhase.WAITING;
      
      default:
        console.warn(`⚠️ Phase inconnue: ${serverPhase}, utilisation de la phase 'waiting'`);
        return GamePhase.WAITING;
    }
  }
}
