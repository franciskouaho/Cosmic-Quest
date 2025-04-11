import { API_URL, WS_URL } from '../config/axios';

// Exporter les constantes de configuration de l'API
export { API_URL, WS_URL };

// Configuration additionnelle pour le jeu
export const GAME_CONFIG = {
  defaultRounds: 5,
  defaultPlayers: 6,
  defaultTheme: 'standard' as const,
  answerTimeLimit: 60, // secondes
  voteTimeLimit: 30,   // secondes
};

// Configuration du cache
export const CACHE_CONFIG = {
  gameStateStaleTime: 1000 * 10, // 10 secondes
  roomDataStaleTime: 1000 * 30,  // 30 secondes
  userDataStaleTime: 1000 * 60 * 5, // 5 minutes
};
