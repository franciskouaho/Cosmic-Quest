import { HttpContext } from '@adonisjs/core/http'
import questionService from '#services/question_service'

export default class QuestionsController {
  /**
   * Récupère une question aléatoire par thème
   */
  async getRandom({ request, response }: HttpContext) {
    try {
      const theme = request.input('theme', 'standard')

      const question = await questionService.getRandomQuestionByTheme(theme)

      if (!question) {
        return response.notFound({
          error: `Aucune question trouvée pour le thème ${theme}`,
        })
      }

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
