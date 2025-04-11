import { HttpContext } from '@adonisjs/core/http'
import questionService from '#services/question_service'

export default class AdminQuestionsController {
  /**
   * Liste toutes les questions
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const theme = request.input('theme')

      let query = questionService.getQuestionsQuery()

      if (theme) {
        query = query.where('theme', theme)
      }

      const questions = await query.paginate(page, limit)

      return response.ok({
        status: 'success',
        data: questions,
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des questions:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des questions',
      })
    }
  }

  /**
   * Affiche les détails d'une question
   */
  async show({ params, response }: HttpContext) {
    try {
      const question = await questionService.getQuestionById(params.id)

      if (!question) {
        return response.notFound({
          error: 'Question non trouvée',
        })
      }

      return response.ok({
        status: 'success',
        data: question,
      })
    } catch (error) {
      console.error(`Erreur lors de la récupération de la question ${params.id}:`, error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération de la question',
      })
    }
  }

  /**
   * Crée une nouvelle question
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const data = request.only(['text', 'theme'])

      const question = await questionService.createQuestion({
        text: data.text,
        theme: data.theme,
        createdByUserId: user.id,
      })

      if (!question) {
        return response.internalServerError({
          error: 'Une erreur est survenue lors de la création de la question',
        })
      }

      return response.created({
        status: 'success',
        message: 'Question créée avec succès',
        data: question,
      })
    } catch (error) {
      console.error('Erreur lors de la création de la question:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la création de la question',
      })
    }
  }

  /**
   * Met à jour une question existante
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const data = request.only(['text', 'theme', 'isActive'])

      const question = await questionService.updateQuestion(params.id, data)

      if (!question) {
        return response.notFound({
          error: 'Question non trouvée',
        })
      }

      return response.ok({
        status: 'success',
        message: 'Question mise à jour avec succès',
        data: question,
      })
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de la question ${params.id}:`, error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la mise à jour de la question',
      })
    }
  }

  /**
   * Supprime une question
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const success = await questionService.deleteQuestion(params.id)

      if (!success) {
        return response.notFound({
          error: 'Question non trouvée',
        })
      }

      return response.ok({
        status: 'success',
        message: 'Question supprimée avec succès',
      })
    } catch (error) {
      console.error(`Erreur lors de la suppression de la question ${params.id}:`, error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la suppression de la question',
      })
    }
  }
}
