import { Player } from '@/types/gameTypes';
import { API_URL } from '@/config/axios';

type PlayerScore = Player & { score: number };

export const getGameResults = async (gameId: string): Promise<PlayerScore[]> => {
  try {
    const response = await fetch(`${API_URL}/games/${gameId}/results`);
    
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des résultats');
    }
    
    const data = await response.json();
    return data.players.sort((a: PlayerScore, b: PlayerScore) => b.score - a.score);
  } catch (error) {
    console.error('Erreur lors de la récupération des résultats:', error);
    throw error;
  }
}; 