import api from '@/services/api';

export interface GameState {
  id: number;
  roomId: number;
  currentRound: number;
  totalRounds: number;
  status: string;
  gameMode: string;
  currentPhase: string;
  scores: Record<string, number>;
  createdAt: string;
}

class GameService {
  /**
   * Récupère l'état actuel du jeu
   */
  async getGameState(gameId: string) {
    try {
      console.log(`🎮 GameService: Récupération de l'état du jeu ${gameId}`);
      const response = await api.get(`/games/${gameId}`);
      console.log(`✅ GameService: État du jeu ${gameId} récupéré avec succès`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ GameService: Erreur lors de la récupération de l'état du jeu ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Soumet une réponse à la question actuelle
   */
  async submitAnswer(gameId: string, content: string) {
    try {
      console.log(`🎮 GameService: Soumission d'une réponse pour le jeu ${gameId}`);
      const response = await api.post(`/games/${gameId}/answers`, { content });
      console.log(`✅ GameService: Réponse soumise avec succès`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ GameService: Erreur lors de la soumission de la réponse:`, error);
      throw error;
    }
  }

  /**
   * Soumet un vote pour une réponse
   */
  async submitVote(gameId: string, answerId: string, questionId: string) {
    try {
      console.log(`🎮 GameService: Soumission d'un vote pour le jeu ${gameId}`);
      const response = await api.post(`/games/${gameId}/votes`, {
        answer_id: answerId,
        question_id: questionId
      });
      console.log(`✅ GameService: Vote soumis avec succès`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ GameService: Erreur lors de la soumission du vote:`, error);
      throw error;
    }
  }

  /**
   * Passe au tour suivant
   */
  async nextRound(gameId: string) {
    try {
      console.log(`🎮 GameService: Passage au tour suivant pour le jeu ${gameId}`);
      const response = await api.post(`/games/${gameId}/next-round`);
      console.log(`✅ GameService: Tour suivant initié avec succès`);
      return response.data.data;
    } catch (error) {
      console.error(`❌ GameService: Erreur lors du passage au tour suivant:`, error);
      throw error;
    }
  }
}

export const gameService = new GameService();
