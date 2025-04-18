// Définition des phases du jeu
export enum GamePhase {
  LOADING = 'loading',
  QUESTION = 'question',
  ANSWER = 'answer',
  VOTE = 'vote',
  WAITING = 'waiting',
  WAITING_FOR_VOTE = 'waiting_for_vote',
  RESULTS = 'results',
  FINISHED = 'finished',
  ERROR = 'error'
}

// Types de jeu possibles
export enum GameMode {
  STANDARD = 'standard',
  VERSUS = 'versus',
  TEAM = 'team'
}

// Statut du jeu
export enum GameStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

// Interface pour un joueur
export interface Player {
  id: string | number;
  username?: string;
  displayName?: string;
  name?: string;
  avatar?: string;
  score?: number;
  isHost?: boolean;
  isOnline?: boolean;
  userId?: string | number;
}

// Interface pour une question
export interface Question {
  id: string | number;
  text: string;
  theme?: string;
  roundNumber?: number;
  targetPlayer?: Player;
  gameId?: string | number;
  createdAt?: string;
}

// Interface pour une réponse
export interface Answer {
  id: string | number;
  content: string;
  playerId: string | number;
  questionId?: string | number;
  gameId?: string | number;
  votesCount?: number;
  isOwnAnswer?: boolean;
  createdAt?: string;
}

// Interface pour un vote
export interface Vote {
  id: string | number;
  answerId: string | number;
  questionId?: string | number;
  voterId: string | number;
  createdAt?: string;
}

// Interface pour une salle
export interface Room {
  id: string | number;
  code: string;
  name?: string;
  hostId: string | number;
  players?: Player[];
  createdAt?: string;
  maxPlayers?: number;
  gameMode?: GameMode;
  status?: string;
}

// Interface pour l'état d'un jeu
export interface GameState {
  phase: GamePhase | string;
  currentPhase?: string;
  currentRound: number;
  totalRounds: number;
  targetPlayer: Player | null;
  currentQuestion: Question | null;
  answers: Answer[];
  players: Player[];
  scores: Record<string, number>;
  theme?: string;
  timer?: {
    duration: number;
    startTime: number;
  } | null;
  currentUserState?: {
    hasAnswered?: boolean;
    hasVoted?: boolean;
    isTargetPlayer?: boolean;
  };
  game?: {
    id: string | number;
    roomId?: string | number;
    hostId?: string | number;
    status: string;
    gameMode?: string;
    currentPhase: string;
    currentRound: number;
    totalRounds: number;
    scores?: Record<string, number>;
    createdAt?: string;
  };
  room?: Room | null;
  lastRefreshed?: number;
  error?: string;
  allPlayersVoted?: boolean;
}

// Interface pour une action sur l'état du jeu
export interface GameAction {
  type: string;
  payload?: any;
}

// Interface pour les réponses WebSocket
export interface WebSocketResponse {
  success: boolean;
  error?: string;
  [key: string]: any;
}

// Interface pour les événements de jeu
export interface GameEvent {
  type: 'phase_change' | 'new_answer' | 'new_vote' | 'target_player_vote' | 'game_end' | 'new_round' | 'phase_reminder' | 'player_joined' | 'player_left' | 'host_changed' | 'error';
  phase?: string;
  message?: string;
  [key: string]: any;
}

// Interface pour les informations de cache d'un état de jeu
export interface GameStateCache {
  state: GameState;
  timestamp: number;
}

// Interface pour les informations d'hôte
export interface HostInfo {
  hostId: string;
  timestamp: number;
}
