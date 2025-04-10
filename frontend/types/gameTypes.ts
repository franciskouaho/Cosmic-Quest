export interface Player {
  id: string;
  name: string;
  avatar: string;
  isReady: boolean;
}

export interface Question {
  id?: string;
  text: string;
  theme: string;
}

export interface Answer {
  playerId: string;
  content: string;
  votes: number;
}

export enum GamePhase {
  LOADING = 'loading',
  QUESTION = 'question',
  WAITING = 'waiting',
  VOTE = 'vote',
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
}

export type GameTheme = 'standard' | 'fun' | 'dark' | 'personal' | 'crazy';
