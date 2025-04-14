import { Question } from '../types/gameTypes';

/**
 * Cache de questions par thème pour réduire les appels au serveur
 */
class QuestionCache {
  private cache: Record<string, Question[]> = {};
  private maxCacheSize: number = 30; // Nombre maximum de questions par thème

  /**
   * Vérifie si des questions mises en cache existent pour un thème
   * @param theme - Le thème pour lequel vérifier le cache
   * @returns true si des questions sont disponibles
   */
  hasCachedQuestions(theme: string): boolean {
    return !!this.cache[theme] && this.cache[theme].length > 0;
  }

  /**
   * Récupère une question aléatoire du cache
   * @param theme - Le thème de la question à récupérer
   * @returns Une question aléatoire ou null si aucune question n'est disponible
   */
  getRandomQuestionFromCache(theme: string): Question | null {
    if (!this.hasCachedQuestions(theme)) return null;
    
    // Sélectionner une question aléatoire
    const questions = this.cache[theme];
    const randomIndex = Math.floor(Math.random() * questions.length);
    
    // Enlever la question du cache pour éviter les répétitions
    const question = questions[randomIndex];
    this.cache[theme] = [
      ...questions.slice(0, randomIndex),
      ...questions.slice(randomIndex + 1)
    ];
    
    return question;
  }

  /**
   * Ajoute une question au cache
   * @param question - La question à mettre en cache
   */
  addToCache(question: Question): void {
    if (!question.theme) return;
    
    const theme = question.theme;
    
    // Initialiser le cache pour ce thème si nécessaire
    if (!this.cache[theme]) {
      this.cache[theme] = [];
    }
    
    // Ne pas ajouter de questions en double
    if (this.cache[theme].some(q => q.id === question.id)) {
      return;
    }
    
    // Ajouter la question et limiter la taille du cache
    this.cache[theme].push(question);
    
    // Si le cache dépasse la taille maximale, supprimer les questions les plus anciennes
    if (this.cache[theme].length > this.maxCacheSize) {
      this.cache[theme] = this.cache[theme].slice(-this.maxCacheSize);
    }
  }

  /**
   * Vide le cache pour un thème spécifique ou tout le cache
   * @param theme - Le thème à vider (optionnel, vide tout le cache si non spécifié)
   */
  clearCache(theme?: string): void {
    if (theme) {
      delete this.cache[theme];
    } else {
      this.cache = {};
    }
  }
}

export default new QuestionCache();
