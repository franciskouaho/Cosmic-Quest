import { Question } from '../types/gameTypes';
import { GameTheme } from './questionGenerator';

// Structure de cache par thème
type QuestionCache = {
  [theme in GameTheme]?: Question[];
};

class QuestionCacheManager {
  private cache: QuestionCache = {};
  private readonly MAX_CACHE_SIZE = 10; // Maximum de questions par thème

  /**
   * Ajoute une question au cache
   * @param question - La question à mettre en cache
   */
  addToCache(question: Question): void {
    const theme = question.theme as GameTheme;
    
    // Initialiser le cache pour ce thème si nécessaire
    if (!this.cache[theme]) {
      this.cache[theme] = [];
    }
    
    // Éviter les doublons en vérifiant l'ID ou le texte
    const isDuplicate = this.cache[theme]!.some(
      q => q.id === question.id || q.text === question.text
    );
    
    if (!isDuplicate) {
      // Ajouter la nouvelle question
      this.cache[theme]!.push(question);
      
      // Limiter la taille du cache
      if (this.cache[theme]!.length > this.MAX_CACHE_SIZE) {
        this.cache[theme]!.shift(); // Retirer la plus ancienne question
      }
    }
  }

  /**
   * Récupère une question aléatoire du cache pour un thème donné
   * @param theme - Le thème de la question
   * @returns Une question ou null si le cache est vide pour ce thème
   */
  getRandomQuestionFromCache(theme: GameTheme): Question | null {
    const cachedQuestions = this.cache[theme] || [];
    
    if (cachedQuestions.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * cachedQuestions.length);
    return cachedQuestions[randomIndex];
  }

  /**
   * Vérifier si le cache contient des questions pour un thème donné
   * @param theme - Le thème à vérifier
   * @returns true si le cache contient des questions pour ce thème
   */
  hasCachedQuestions(theme: GameTheme): boolean {
    return Boolean(this.cache[theme] && this.cache[theme]!.length > 0);
  }

  /**
   * Vider le cache pour un thème ou entièrement
   * @param theme - Le thème à vider, ou undefined pour tout vider
   */
  clearCache(theme?: GameTheme): void {
    if (theme) {
      this.cache[theme] = [];
    } else {
      this.cache = {};
    }
  }
}

// Exporter une instance unique (pattern singleton)
export default new QuestionCacheManager();
