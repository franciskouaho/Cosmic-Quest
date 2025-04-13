import { Question } from '../types/gameTypes';

export type GameTheme = 
  | 'standard' 
  | 'fun'
  | 'dark'
  | 'personal'
  | 'crazy'
  | 'on-ecoute-mais-on-ne-juge-pas';

/**
 * Génère un objet Question complet basé sur un thème et un nom de joueur
 * @param theme - Le thème de la question
 * @param playerName - Le nom du joueur à insérer dans la question
 * @returns Un objet Question avec le nom du joueur inséré
 */
export function generateQuestionObject(theme: GameTheme, playerName: string): Question {
  const questionText = generateQuestion(theme, playerName);
  return createQuestionObject(questionText, theme);
}

/**
 * Génère le texte d'une question basée sur un thème et un nom de joueur
 * @param theme - Le thème de la question
 * @param playerName - Le nom du joueur à insérer dans la question
 * @returns Le texte de la question avec le nom du joueur inséré
 */
function generateQuestion(theme: GameTheme, playerName: string): string {
  const questions = {
    standard: [
      `${playerName} participe à un jeu télévisé. Quelle serait sa phrase d'accroche ?`,
      `Si ${playerName} était un super-héros, quel serait son pouvoir ?`,
      `Quel emoji représente le mieux ${playerName} ?`,
    ],
    fun: [
      `Si ${playerName} était un mème internet, lequel serait-il ?`,
      `Quel talent caché pourrait avoir ${playerName} ?`,
      `Quelle chanson définit le mieux ${playerName} ?`,
    ],
    dark: [
      `Quel serait le plan machiavélique de ${playerName} pour dominer le monde ?`,
      `Si ${playerName} était un méchant de film, quelle serait sa phrase culte ?`,
      `Quel est le plus grand secret que ${playerName} pourrait cacher ?`,
    ],
    personal: [
      `Quelle habitude agaçante ${playerName} a-t-il probablement ?`,
      `Quel serait le pire cadeau à offrir à ${playerName} ?`,
      `Si la vie de ${playerName} était une série TV, quel en serait le titre ?`,
    ],
    crazy: [
      `Si ${playerName} pouvait fusionner avec un objet du quotidien, lequel choisirait-il ?`,
      `Quelle capacité absurde ${playerName} aimerait développer ?`,
      `Si ${playerName} était une créature mythologique, laquelle serait-il et pourquoi ?`,
    ],
    'on-ecoute-mais-on-ne-juge-pas': [
      `Si ${playerName} devait confesser un péché mignon, lequel serait-ce ?`,
      `Quelle est la pire habitude de ${playerName} qu'il/elle n'admettra jamais publiquement ?`,
      `Comment ${playerName} réagirait face à un compliment sincère mais inattendu ?`,
      `Quel secret ${playerName} serait-il/elle prêt(e) à partager uniquement dans cette pièce ?`,
      `Quelle émotion ${playerName} a-t-il/elle le plus de mal à exprimer ?`,
      `Dans quel domaine ${playerName} aimerait-il/elle être meilleur(e) mais a peur d'essayer ?`,
      `Si ${playerName} devait écrire une lettre à son "moi" passé, quel conseil donnerait-il/elle ?`,
      `Quelle situation fait le plus douter ${playerName} de ses capacités ?`,
    ],
  };
  
  // Si le thème n'existe pas, utiliser le thème standard
  const themeQuestions = questions[theme] || questions.standard;
  
  // Sélectionner une question aléatoire
  const randomIndex = Math.floor(Math.random() * themeQuestions.length);
  return themeQuestions[randomIndex];
}

// Exporter la fonction pour qu'elle puisse être utilisée ailleurs
export default generateQuestion;

/**
 * Crée un objet Question à partir d'un texte et d'un thème
 * @param text - Le texte de la question
 * @param theme - Le thème de la question
 * @returns Un objet Question
 */
function createQuestionObject(text: string, theme: GameTheme): Question {
  return {
    id: generateUniqueId(),
    text: text,
    theme: theme,
  };
}

/**
 * Génère un ID unique pour une question
 * @returns Une chaîne ID unique
 */
function generateUniqueId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
