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
  playerId: string;
  content: string;
  votes: number;
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
  theme: GameTheme;
}

export type GameTheme = 'standard' | 'fun' | 'dark' | 'personal' | 'crazy';
