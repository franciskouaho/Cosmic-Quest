import { BaseSeeder } from '@adonisjs/lucid/seeders'
import QuestionBank from '#models/question_bank'

export default class QuestionBankSeeder extends BaseSeeder {
  async run() {
    // Banque de questions par thème (reprendre les questions du frontend)
    const questionsByTheme = {
      'on-ecoute-mais-on-ne-juge-pas': [
        'Si {playerName} devait confesser un péché mignon, lequel serait-ce ?',
        "Quelle est la pire habitude de {playerName} qu'il/elle n'admettra jamais publiquement ?",
        'Comment {playerName} réagirait face à un compliment sincère mais inattendu ?',
        'Quel secret {playerName} serait-il/elle prêt(e) à partager uniquement dans cette pièce ?',
        'Quelle émotion {playerName} a-t-il/elle le plus de mal à exprimer ?',
        "Dans quel domaine {playerName} aimerait-il/elle être meilleur(e) mais a peur d'essayer ?",
        'Si {playerName} devait écrire une lettre à son "moi" passé, quel conseil donnerait-il/elle ?',
        'Quelle situation fait le plus douter {playerName} de ses capacités ?',
      ],
    }

    // Convertir toutes les questions en objets pour insertion
    const questionsToInsert = []

    for (const [theme, questions] of Object.entries(questionsByTheme)) {
      for (const text of questions) {
        questionsToInsert.push({
          text,
          theme,
          isActive: true,
          usageCount: 0,
        })
      }
    }

    // Insérer toutes les questions d'un coup
    await QuestionBank.createMany(questionsToInsert)
  }
}
