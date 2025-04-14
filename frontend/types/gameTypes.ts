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

// Ajouter cette interface pour clarifier l'état du joueur actuel
export interface CurrentUserState {
  hasAnswered: boolean;
  hasVoted: boolean;
  isTargetPlayer: boolean;
}

export interface Timer {
  duration: number;
  startTime: number;
}

export enum GamePhase {
  LOADING = 'loading',
  QUESTION = 'question',
  ANSWER = 'answer',
  VOTE = 'vote',
  WAITING = 'waiting',
  WAITING_FOR_VOTE = 'waiting_for_vote', // Nouvelle phase pour aider à distinguer l'attente spécifique au vote
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
  timer: Timer | null;
  currentUserState?: CurrentUserState;
}

export type GameTheme = 'standard' | 'fun' | 'dark' | 'personal' | 'crazy';
