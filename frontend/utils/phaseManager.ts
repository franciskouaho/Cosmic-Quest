export enum GamePhase {
  LOADING = 'loading',
  QUESTION = 'question',
  ANSWER = 'answer',
  VOTE = 'vote',
  WAITING = 'waiting',
  RESULTS = 'results'
}

export class PhaseManager {
  static readonly VALID_TRANSITIONS = {
    'question': ['answer'],
    'answer': ['vote', 'waiting'],
    'vote': ['results', 'waiting_for_vote'],
    'waiting': ['vote', 'results', 'question'],
    'waiting_for_vote': ['results'],
    'results': ['question']
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

    switch (serverPhase) {
      case 'question':
        return isTarget ? GamePhase.WAITING : GamePhase.QUESTION;
      case 'answer':
        return hasAnswered ? GamePhase.WAITING : GamePhase.ANSWER;
      case 'vote':
        return hasVoted ? GamePhase.WAITING : GamePhase.VOTE;
      default:
        return serverPhase;
    }
  }
}
