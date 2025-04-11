export type GameTheme = 'standard' | 'fun' | 'dark' | 'personal' | 'crazy';

import { Question } from '../types/gameTypes';

// Banque de questions par thème
const questionsByTheme: Record<GameTheme, string[]> = {
  standard: [
    "{playerName} participe à un jeu télévisé. Quelle serait sa phrase d'accroche ?",
    "Si {playerName} était un super-héros, quel serait son pouvoir ?",
    "Quelle émission de télé-réalité conviendrait parfaitement à {playerName} ?",
    "Quel emoji représente le mieux {playerName} ?",
    "Si {playerName} écrivait une autobiographie, quel en serait le titre ?",
    "Quel animal de compagnie conviendrait parfaitement à {playerName} ?",
    "Dans quelle époque historique {playerName} s'intégrerait le mieux ?",
    "Si {playerName} était un plat, lequel serait-il ?",
  ],
  
  fun: [
    "Si {playerName} était un mème internet, lequel serait-il ?",
    "Quel talent caché pourrait avoir {playerName} ?",
    "Quelle chanson définit le mieux {playerName} ?",
    "Si {playerName} était un personnage de dessin animé, qui serait-il ?",
    "Quelle célébrité {playerName} pourrait-il remplacer sans que personne ne s'en aperçoive ?",
    "Que ferait {playerName} s'il gagnait au loto ?",
    "Quelle serait la pire coupe de cheveux pour {playerName} ?",
    "Dans quel film ridicule {playerName} pourrait jouer le rôle principal ?",
  ],
  
  dark: [
    "Quel serait le plan machiavélique de {playerName} pour dominer le monde ?",
    "Si {playerName} était un méchant de film, quelle serait sa phrase culte ?",
    "Quel est le plus grand secret que {playerName} pourrait cacher ?",
    "Quelle serait la pire invention créée par {playerName} ?",
    "Comment {playerName} survivrait-il à une apocalypse zombie ?",
    "Quelle malédiction bizarre pourrait frapper {playerName} ?",
    "Quel objet {playerName} utiliserait-il comme arme en cas d'invasion extraterrestre ?",
    "Si {playerName} était possédé, quel comportement étrange adopterait-il ?",
  ],
  
  personal: [
    "Quelle habitude agaçante {playerName} a-t-il probablement ?",
    "Comment {playerName} réagirait-il à une panne d'électricité de 24 heures ?",
    "Quel serait le pire cadeau à offrir à {playerName} ?",
    "Quelle application occupe probablement le plus d'espace sur le téléphone de {playerName} ?",
    "Qu'est-ce que {playerName} fait probablement quand personne ne le regarde ?",
    "Si la vie de {playerName} était une série TV, quel en serait le titre ?",
    "Quelle excuse {playerName} utiliserait-il pour éviter une réunion ennuyeuse ?",
    "Quelle serait la première règle de {playerName} s'il devenait roi/reine d'un pays ?",
  ],
  
  crazy: [
    "Si {playerName} pouvait fusionner avec un objet du quotidien, lequel choisirait-il ?",
    "Quelle capacité absurde {playerName} aimerait développer ?",
    "Si {playerName} était un sandwich, quels ingrédients le composeraient ?",
    "Quel serait le slogan publicitaire de {playerName} ?",
    "Si {playerName} était une créature mythologique, laquelle serait-il et pourquoi ?",
    "Dans une autre dimension, comment {playerName} gagnerait-il sa vie ?",
    "Si {playerName} inventait une nouvelle danse, comment s'appellerait-elle ?",
    "Quelle serait la phrase de {playerName} s'il rencontrait un extraterrestre ?",
  ]
};

/**
 * Génère une question aléatoire basée sur un thème et un nom de joueur
 * @param theme - Le thème de la question
 * @param playerName - Le nom du joueur à insérer dans la question
 * @returns Une question avec le nom du joueur inséré
 */
export function generateQuestion(theme: GameTheme, playerName: string): string {
  // Utiliser le thème standard si le thème demandé n'existe pas
  const questions = questionsByTheme[theme] || questionsByTheme.standard;
  
  // Choisir une question aléatoire
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}
