import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '@/config/axios';
import { Player, Question, Answer, GameState } from '@/types/gameTypes';
import { generateQuestionObject } from '@/utils/questionGenerator';
import SocketService from '@/services/socketService';

class GameService {
  private async getAuthHeader() {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      return {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du token:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  }
  
  private async checkNetworkConnection() {
    const netInfo = await NetInfo.fetch();
    const isConnected = netInfo.isConnected;
    
    if (!isConnected) {
      console.error(`❌ Pas de connexion réseau (Type: ${netInfo.type})`);
      throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
    }
    
    return true;
  }

  // Récupérer l'état actuel du jeu
  async getGameState(gameId: string): Promise<GameState> {
    console.log(`📋 Récupération de l'état du jeu ${gameId}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/games/${gameId}`;
      console.log('🌐 Envoi requête GET:', url);
      
      const response = await axios.get(url, { 
        headers,
        timeout: 20000 // 20 secondes
      });
      
      console.log('✅ État du jeu reçu:', response.status);
      return response.data.data.game;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la récupération de l'état du jeu ${gameId}:`, error);
      throw error;
    }
  }

  // Soumettre une réponse
  async submitAnswer(gameId: string, answer: string): Promise<{ status: string; message: string }> {
    console.log(`🚪 Soumission d'une réponse pour le jeu ${gameId}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/games/${gameId}/answer`;
      console.log('🌐 Envoi requête POST:', url);
      
      const response = await axios.post(url, { content: answer }, { 
        headers,
        timeout: 20000
      });
      
      console.log('✅ Réponse soumise avec succès:', response.status);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la soumission de la réponse:`, error);
      throw error;
    }
  }

  // Voter pour une réponse
  async submitVote(gameId: string, answerId: string, questionId: string): Promise<{ status: string; message: string }> {
    console.log(`🗳️ Soumission d'un vote pour la réponse ${answerId} dans le jeu ${gameId}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/games/${gameId}/vote`;
      const payload = { answer_id: answerId, question_id: questionId };
      
      console.log('🌐 Envoi requête POST:', url);
      
      const response = await axios.post(url, payload, { 
        headers,
        timeout: 20000
      });
      
      console.log('✅ Vote soumis avec succès:', response.status);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la soumission du vote:`, error);
      throw error;
    }
  }

  // Passer au tour suivant (réservé à l'hôte)
  async nextRound(gameId: string): Promise<{ status: string; message: string; data: any }> {
    console.log(`⏭️ Passage au tour suivant pour le jeu ${gameId}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/games/${gameId}/next-round`;
      console.log('🌐 Envoi requête POST:', url);
      
      const response = await axios.post(url, {}, { 
        headers,
        timeout: 20000
      });
      
      console.log('✅ Passage au tour suivant réussi:', response.status);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors du passage au tour suivant:`, error);
      throw error;
    }
  }
  
  // Récupérer une question depuis le backend par thème
  async getRandomQuestion(theme: string, playerName: string): Promise<Question | null> {
    console.log(`🎮 Récupération d'une question aléatoire pour le thème ${theme}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/questions/random?theme=${theme}`;
      
      const response = await axios.get(url, { headers });
      
      if (response.data && response.data.data) {
        const questionData = response.data.data;
        
        // Formatage de la question avec le nom du joueur
        const questionText = questionData.text.replace('{playerName}', playerName);
        
        return {
          id: questionData.id.toString(),
          text: questionText,
          theme: questionData.theme
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération d'une question aléatoire:`, error);
      return null;
    }
  }

  // Générer une question (version hors ligne)
  generateOfflineQuestion(theme: string, targetPlayer: Player): Question {
    console.log(`🔄 Génération d'une question hors ligne avec le thème ${theme}`);
    const playerName = targetPlayer.name;
    return generateQuestionObject(theme as any, playerName);
  }
}

export const gameService = new GameService();
