import api from '@/config/axios';
import { Question } from '@/types/gameTypes';

class QuestionService {
  /**
   * Récupère une question aléatoire depuis le backend
   * @param theme - Le thème de la question
   * @returns Une question formatée ou null en cas d'échec
   */
  async getRandomQuestion(theme: string): Promise<Question | null> {
    try {
      console.log(`📝 QuestionService: Tentative de récupération d'une question du thème ${theme}`);
      
      // Augmenter le timeout pour donner plus de chances à la requête d'aboutir
      const response = await api.get(`/questions/random`, {
        params: { theme },
        timeout: 8000, // 8 secondes au lieu de 5
      });
      
      if (response.data?.status === 'success' && response.data?.data) {
        const questionData = response.data.data;
        console.log(`✅ QuestionService: Question reçue du serveur: ID=${questionData.id}`);
        
        return {
          id: questionData.id,
          text: questionData.text,
          theme: questionData.theme
        };
      }
      
      console.warn('⚠️ QuestionService: Format de réponse incorrect:', response.data);
      return null;
    } catch (error) {
      console.error('❌ QuestionService: Erreur lors de la récupération de la question:', error);
      
      // Tentative de reconnexion avec un délai si c'est un problème réseau
      if (error.message && (error.message.includes('timeout') || error.message.includes('network'))) {
        console.log('🔄 QuestionService: Tentative de reconnexion dans 2 secondes...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.getRandomQuestion(theme); // Tentative unique de reconnexion
      }
      
      return null;
    }
  }

  /**
   * Formate une question en remplaçant le placeholder par le nom du joueur
   * @param questionText - Le texte de la question avec placeholder
   * @param playerName - Le nom du joueur à insérer
   * @returns Le texte de la question formaté
   */
  formatQuestion(questionText: string, playerName: string): string {
    // Support pour tous les formats possibles de placeholder
    return questionText
      .replace(/\{playerName\}/g, playerName) // Format {playerName}
      .replace(/\${playerName}/g, playerName) // Format ${playerName}
      .replace(/%playerName%/g, playerName);  // Format %playerName%
  }
}

export default new QuestionService();
