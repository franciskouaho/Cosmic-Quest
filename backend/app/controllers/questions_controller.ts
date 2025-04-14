import { HttpContext } from '@adonisjs/core/http'
import questionService from '#services/question_service'

export default class QuestionsController {
  /**
   * Récupère une question aléatoire par thème
   */
  async getRandom({ request, response }: HttpContext) {
    try {
      const theme = request.input('theme', 'standard')
      const playerName = request.input('playerName', null) // Optionnel: si on veut formater directement côté backend

      const question = await questionService.getRandomQuestionByTheme(theme)

      if (!question) {
        return response.notFound({
          error: `Aucune question trouvée pour le thème ${theme}`,
        })
      }

      // Le texte est renvoyé avec le placeholder {playerName} intact
      // Le frontend se chargera de remplacer ce placeholder par le nom du joueur
      return response.ok({
        status: 'success',
        data: {
          id: question.id,
          text: question.text,
          theme: question.theme,
        },
      })
    } catch (error) {
      console.error("Erreur lors de la récupération d'une question aléatoire:", error)
      return response.internalServerError({
        error: "Une erreur est survenue lors de la récupération d'une question aléatoire",
      })
    }
  }
}
