import { HttpContext } from '@adonisjs/core/http'
import Game from '#models/game'
import Question from '#models/question'
import Answer from '#models/answer'
import Vote from '#models/vote'
import socketService from '#services/socket_service'

export default class RecoveryController {
  /**
   * Tentative de récupération d'un état de jeu qui génère des erreurs 500
   */
  async recoverGameState({ params, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const gameId = params.id

      console.log(`🔄 [recoverGameState] Tentative de récupération du jeu ${gameId}...`)

      // Vérifier si le jeu existe
      const game = await Game.find(gameId)
      if (!game) {
        return response.notFound({
          error: 'Partie non trouvée',
        })
      }

      // Vérifier que la partie est en cours
      if (game.status !== 'in_progress') {
        return response.badRequest({
          error: "La partie n'est pas en cours",
        })
      }

      // Stratégie 1: Détection de phase incohérente
      const currentQuestion = await Question.query()
        .where('game_id', gameId)
        .where('round_number', game.currentRound)
        .first()

      if (currentQuestion) {
        // Compter les réponses
        const answersCount = await Answer.query()
          .where('question_id', currentQuestion.id)
          .count('* as count')

        const count = Number.parseInt(answersCount[0].$extras.count || '0', 10)

        // Si nous sommes en phase answer mais toutes les réponses sont reçues
        if (game.currentPhase === 'answer' && count >= game.playerCount - 1) {
          console.log(
            `🔄 [recoverGameState] Incohérence détectée: ${count} réponses en phase answer, passage en phase vote`
          )

          game.currentPhase = 'vote'
          await game.save()

          // Notifier tous les clients
          const io = socketService.getInstance()
          io.to(`game:${gameId}`).emit('game:update', {
            type: 'phase_change',
            phase: 'vote',
            message: 'Phase corrigée: passage en vote',
          })
        }
      }

      return response.ok({
        status: 'success',
        message: 'Tentative de récupération effectuée',
        data: {
          gameId: game.id,
          currentPhase: game.currentPhase,
          recovered: true,
        },
      })
    } catch (error) {
      console.error('❌ [recoverGameState] Erreur:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la tentative de récupération',
      })
    }
  }
}
