export interface Player {
  id: string;
  name: string;
  avatar?: string;
  isReady?: boolean;
  level?: number;
}

export interface Question {
  id?: string;
  text: string;
  theme?: string;
  roundNumber?: number;
}

export interface Answer {
  id: number | string; // L'ID peut être un nombre ou une chaîne
  content: string;
  playerId: number | string;
  playerName: string;
  votesCount?: number;
  isOwnAnswer?: boolean; // Ajouter cette propriété pour identifier les propres réponses
}

export enum GamePhase {
  LOADING = 'loading',
  QUESTION = 'question',
  ANSWER = 'answer',
  VOTE = 'vote',
  WAITING = 'waiting',
  RESULTS = 'results',
}

export interface GameState {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  targetPlayer: Player | null;
  currentQuestion: Question | null;
  answers: Answer[];
  players: Player[];
  scores: Record<string, number>;
  theme: string;
  timer: {
    duration: number;
    startTime: number;
  } | null;
  currentUserState?: {
    hasAnswered: boolean;
    hasVoted: boolean;
    isTargetPlayer: boolean;
  };
}

export type GameTheme = 'standard' | 'fun' | 'dark' | 'personal' | 'crazy';
