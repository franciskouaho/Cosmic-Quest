import { Question } from '../types/gameTypes';
import questionService from '../services/queries/question';
import questionCache from './questionCache';

export type GameTheme = 
'on-ecoute-mais-on-ne-juge-pas';

/**
 * Génère un objet Question complet basé sur un thème et un nom de joueur
 * @param theme - Le thème de la question
 * @param playerName - Le nom du joueur à insérer dans la question
 * @returns Un objet Question avec le nom du joueur inséré
 */
export async function generateQuestionObject(theme: GameTheme, playerName: string): Promise<Question> {
  try {
    console.log(`🔍 Génération d'une question pour le thème: ${theme}`);
    
    // PRIORITÉ 1: Vérifier le cache local
    if (questionCache.hasCachedQuestions(theme)) {
      console.log("📋 Utilisation d'une question mise en cache");
      const cachedQuestion = questionCache.getRandomQuestionFromCache(theme);
      
      if (cachedQuestion) {
        const formattedText = questionService.formatQuestion(cachedQuestion.text, playerName);
        return {
          ...cachedQuestion,
          text: formattedText
        };
      }
    }
    
    // PRIORITÉ 2: Récupérer depuis le backend
    console.log("🌐 Tentative de récupération d'une question depuis le backend");
    const questionFromServer = await questionService.getRandomQuestion(theme);
    
    if (questionFromServer) {
      // Ajouter au cache pour une utilisation future
      questionCache.addToCache(questionFromServer);
      
      // Formater avec le nom du joueur
      const formattedText = questionService.formatQuestion(questionFromServer.text, playerName);
      return {
        id: questionFromServer.id,
        text: formattedText,
        theme: questionFromServer.theme || theme
      };
    }
    
    // PRIORITÉ 3: Utiliser une question par défaut très basique
    console.log('⚠️ Échec de la récupération depuis le backend - Utilisation de la question de secours');
    return createEmergencyQuestion(theme, playerName);
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération de question:', error);
    // En cas d'erreur, utiliser la question d'urgence
    return createEmergencyQuestion(theme, playerName);
  }
}

/**
 * Crée une question d'urgence très simple en cas d'échec total de l'API
 * @param theme - Le thème de la question
 * @param playerName - Le nom du joueur à insérer
 * @returns Un objet Question basique
 */
function createEmergencyQuestion(theme: GameTheme, playerName: string): Question {
  // Questions d'urgence très basiques, une par thème
  let questionText = `À propos de ${playerName}, que pensez-vous de cette personne?`;
  
  // Légère customisation selon le thème
  switch(theme) {
    case 'on-ecoute-mais-on-ne-juge-pas':
      questionText = `Quel est le secret le mieux gardé de ${playerName}?`;
      break;
  }

  return {
    id: `emergency-${generateUniqueId()}`,
    text: questionText,
    theme: theme,
  };
}

/**
 * Génère un ID unique pour une question
 * @returns Un ID unique
 */
function generateUniqueId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Pour compatibilité avec le code existant
 */
export function generateQuestion(theme: GameTheme, playerName: string): Promise<string> {
  return generateQuestionObject(theme, playerName)
    .then(question => question.text)
    .catch(() => `Si ${playerName} était un personnage fictif, lequel serait-il?`); // Question d'urgence ultime
}

export default generateQuestion;
