export enum GamePhase {
    WAITING = 'WAITING',
    VOTE = 'VOTE',
    ANSWER = 'ANSWER',
    RESULTS = 'RESULTS',
    LOADING = 'LOADING'
}

export interface Player {
    id: string;
    name: string;
    score: number;
}

export interface Question {
    id: string;
    text: string;
}

export interface Answer {
    id: string;
    text: string;
    playerId: string;
}

export interface GameState {
    phase: GamePhase;
    currentQuestion: Question | null;
    targetPlayer: Player | null;
    answers: Answer[];
    players: Player[];
    round: number;
    totalRounds: number;
    currentUserState?: {
        isTargetPlayer: boolean;
        hasAnswered: boolean;
    };
}

export interface ResultsPhaseProps {
    gameState: GameState;
    onNextRound: () => Promise<void>;
}

export interface VotePhaseProps {
    gameState: GameState;
    onVote: (answerId: string) => Promise<void>;
}

export interface AnswerPhaseProps {
    question: Question;
    targetPlayer: Player;
    onSubmit: (answer: string) => Promise<void>;
    round: number;
    totalRounds: number;
    timer: number | null;
    hasAnswered: boolean;
}

export interface UserGameState {
    hasSubmitted: boolean;
    hasVoted: boolean;
    isHost: boolean;
}

export interface WebSocketMessage {
    type: string;
    data: any;
} 