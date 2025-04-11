import api from '@/services/api';
// Importer SocketService directement
import SocketService from '@/services/socketService';

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
  // Récupérer l'état actuel du jeu
  async getGameState(gameId: string) {
    console.log(`🎮 GameService: Récupération de l'état du jeu ${gameId}`);
    try {
      const url = `/games/${gameId}`;
      console.log('🔐 API Request: GET', url);
      
      const response = await api.get(url);
      console.log('✅ GameService: État du jeu', gameId, 'récupéré avec succès');
      return response.data.data;
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la récupération de l\'état du jeu', gameId, ':', error);
      throw error;
    }
  }

  // Soumettre une réponse
  async submitAnswer(gameId: string, questionId: string | number, content: string) {
    console.log(`🎮 GameService: Soumission de réponse - Game: ${gameId}, Question: ${questionId}`);
    try {
      // Vérification locale avant d'envoyer la requête
      const gameState = await this.getGameState(gameId);
      
      if (gameState.currentUserState?.isTargetPlayer) {
        console.error('❌ GameService: Tentative de réponse bloquée - utilisateur est la cible');
        throw new Error("Vous êtes la cible de cette question et ne pouvez pas y répondre");
      }
      
      const payload = { content, question_id: questionId };
      console.log(`🎮 GameService: Payload: ${JSON.stringify(payload)}`);
      
      // Continuer avec la requête si la vérification passe
      const url = `/games/${gameId}/answer`;
      console.log('🔐 API Request: POST', url);
      
      const response = await api.post(url, payload);
      console.log('✅ GameService: Réponse soumise avec succès');
      return response.data;
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission de la réponse:', error);
      if (error.response) {
        console.error('❌ Détails de l\'erreur:', error.response.data);
        console.error('❌ Statut:', error.response.status);
        throw new Error(error.response.data.error || "Erreur lors de la soumission de la réponse");
      }
      throw error;
    }
  }

  // Soumettre un vote
  async submitVote(gameId: string, answerId: string, questionId: string) {
    console.log(`🎮 GameService: Soumission d'un vote - Game: ${gameId}, Answer: ${answerId}, Question: ${questionId}`);
    try {
      const url = `/games/${gameId}/vote`;
      const payload = { 
        answer_id: answerId,
        question_id: questionId
      };
      
      console.log('🎮 GameService: Payload du vote:', payload);
      
      const response = await api.post(url, payload);
      console.log('✅ GameService: Vote soumis avec succès');
      return response.data;
    } catch (error) {
      console.error('❌ GameService: Erreur lors de la soumission du vote:', error);
      
      if (error.response) {
        // La requête a été faite et le serveur a répondu avec un code d'erreur
        console.error('❌ Détails de l\'erreur:', error.response.data);
        console.error('❌ Statut:', error.response.status);
        throw new Error(error.response.data?.error || 'Erreur lors de la soumission du vote');
      }
      
      throw error;
    }
  }

  // Passer au tour suivant
  async nextRound(gameId: string) {
    console.log(`🎮 GameService: Passage au tour suivant pour le jeu ${gameId}`);
    try {
      // Vérifier d'abord l'état actuel du jeu
      try {
        const gameState = await this.getGameState(gameId);
        console.log(`🎮 GameService: Phase actuelle avant de passer au tour suivant: ${gameState.game.currentPhase}`);
        
        // Vérifier si la phase est correcte
        if (gameState.game.currentPhase !== 'results' && gameState.game.currentPhase !== 'vote') {
          console.error(`❌ GameService: Phase incorrecte pour passer au tour suivant: ${gameState.game.currentPhase}`);
          throw new Error("Ce n'est pas le moment de passer au tour suivant. La phase actuelle doit être 'résultats' ou 'vote'.");
        }
      } catch (stateError) {
        console.error('❌ GameService: Erreur lors de la vérification de l\'état du jeu avant de passer au tour suivant:', stateError);
        // Continuer quand même, le backend fera la vérification finale
      }
      
      const url = `/games/${gameId}/next-round`;
      console.log('🔐 API Request: POST', url);
      
      const response = await api.post(url, {});
      console.log('✅ GameService: Passage au tour suivant réussi');
      return response.data;
    } catch (error) {
      console.error('❌ GameService: Erreur lors du passage au tour suivant:', error);
      
      if (error.response) {
        // La requête a été faite et le serveur a répondu avec un code d'erreur
        console.error('❌ Détails de l\'erreur:', error.response.data);
        console.error('❌ Statut:', error.response.status);
        
        // Si nous avons un message d'erreur détaillé du backend, l'utiliser
        if (error.response.data && error.response.data.error) {
          throw new Error(error.response.data.error);
        }
      }
      
      throw error;
    }
  }
}

// Exporter l'instance par défaut
export default new GameService();
