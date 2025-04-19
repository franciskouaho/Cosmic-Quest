import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { answerValidator, voteValidator } from '#validators/game'
import socketService from '#services/socket_service'
import questionService from '#services/question_service'
import Redis from '@adonisjs/redis/services/main'
import { Socket } from 'socket.io'
import { inject } from '@adonisjs/core'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'

import Game from '#models/game'
import Question from '#models/question'
import Answer from '#models/answer'
import Vote from '#models/vote'
import Room from '#models/room'
import User from '#models/user'

interface GameWithScores extends Game {
  scores: Record<number, number>
}

interface AnswerWithUserId extends Answer {
  userId: number
}

interface RoomWithPlayers extends Room {
  players: ManyToMany<typeof User>
}

// Sélectionner un joueur cible aléatoire parmi les joueurs (sauf celui qui est déjà ciblé)
const selectRandomTargetPlayer = async (gameId: number, currentTargetPlayerId: number | null) => {
  const game = await Game.find(gameId)
  if (!game) throw new Error('Game not found')

  const room = await Room.find(game.roomId)
  if (!room) throw new Error('Room not found')

  const players = await room.related('players').query()

  if (players.length <= 1) throw new Error('Not enough players to select a target')

  // Filtrer le joueur cible actuel s'il existe
  const eligiblePlayers = players.filter((player) => player.id !== currentTargetPlayerId)

  // Sélectionner un joueur aléatoire parmi les éligibles
  const randomIndex = Math.floor(Math.random() * eligiblePlayers.length)
  return eligiblePlayers[randomIndex]
}

export default class GamesController {
  /**
   * Gestion des locks Redis
   */
  private async acquireLock(key: string, ttl: number = 30): Promise<boolean> {
    try {
      const result = await Redis.setex(key, ttl, Date.now().toString())
      return result === 'OK'
    } catch (error) {
      console.error("❌ [Redis] Erreur lors de l'acquisition du lock:", error)
      return false
    }
  }

  private async releaseLock(key: string): Promise<void> {
    try {
      await Redis.del(key)
    } catch (error) {
      console.error('❌ [Redis] Erreur lors de la libération du lock:', error)
    }
  }

  /**
   * Afficher les détails d'une partie en cours
   */
  async show({ params, response, auth, request }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const gameId = params.id

      // Mode de récupération d'urgence
      const isRecoveryMode = request.header('X-Recovery-Mode') === 'true'

      if (isRecoveryMode) {
        console.log(`🔄 [show] Mode de récupération activé pour le jeu ${gameId}`)
      }

      try {
        const game = await Game.query()
          .where('id', gameId)
          .preload('room', (roomQuery) => {
            roomQuery.preload('players')
          })
          .first()

        if (!game) {
          return response.notFound({
            error: 'Partie non trouvée',
          })
        }

        // Vérifier que le joueur fait partie de la partie
        const isPlayerInGame = game.room.players.some((player) => player.id === user.id)

        if (!isPlayerInGame && !isRecoveryMode) {
          return response.forbidden({
            error: 'Vous ne faites pas partie de cette partie',
          })
        }

        // Récupérer la question actuelle si elle existe
        let currentQuestion = null
        try {
          if (game.currentRound > 0) {
            currentQuestion = await Question.query()
              .where('game_id', game.id)
              .where('round_number', game.currentRound)
              .preload('targetPlayer')
              .first()
          }
        } catch (questionError) {
          console.error(`❌ [show] Erreur lors de la récupération de la question:`, questionError)
          // Continuer avec currentQuestion = null
        }

        // Récupérer toutes les réponses pour la question actuelle
        let answers = []
        try {
          if (currentQuestion) {
            // Récupérer les réponses avec les utilisateurs qui les ont écrites
            answers = await Answer.query().where('question_id', currentQuestion.id).preload('user')

            // Ajouter un marqueur pour identifier les propres réponses de l'utilisateur
            answers = answers.map((answer) => ({
              ...answer.toJSON(),
              isOwnAnswer: answer.userId === user.id,
            }))
          }
        } catch (answersError) {
          console.error(`❌ [show] Erreur lors de la récupération des réponses:`, answersError)
          // Continuer avec answers = []
        }

        // Déterminer si l'utilisateur actuel a déjà répondu
        let hasAnswered = false
        let hasVoted = false
        let isTargetPlayer = false

        try {
          hasAnswered = currentQuestion
            ? (await Answer.query()
                .where('question_id', currentQuestion.id)
                .where('user_id', user.id)
                .first()) !== null
            : false

          // Déterminer si l'utilisateur actuel a déjà voté
          hasVoted = currentQuestion
            ? (await Vote.query()
                .where('question_id', currentQuestion.id)
                .where('voter_id', user.id)
                .first()) !== null
            : false

          // Déterminer si c'est au tour de l'utilisateur actuel
          isTargetPlayer = currentQuestion ? currentQuestion.targetPlayerId === user.id : false
        } catch (stateError) {
          console.error(
            `❌ [show] Erreur lors de la récupération des états utilisateur:`,
            stateError
          )
          // On garde les valeurs par défaut
        }

        // Réponse avec données minimales en cas de problème
        return response.ok({
          status: 'success',
          data: {
            game: {
              id: game.id,
              roomId: game.roomId,
              currentRound: game.currentRound,
              totalRounds: game.totalRounds,
              status: game.status,
              gameMode: game.gameMode,
              currentPhase: game.currentPhase,
              scores: game.scores || {},
              createdAt: game.createdAt,
            },
            room: {
              id: game.room.id,
              code: game.room.code,
              name: game.room.name,
              hostId: game.room.hostId,
            },
            players: game.room.players.map((player) => ({
              id: player.id,
              username: player.username,
              displayName: player.displayName,
              avatar: player.avatar,
              score: game.scores?.[player.id] || 0,
              isHost: player.id === game.room.hostId,
            })),
            currentQuestion: currentQuestion
              ? {
                  id: currentQuestion.id,
                  text: currentQuestion.text,
                  roundNumber: currentQuestion.roundNumber,
                  targetPlayer: currentQuestion.targetPlayer
                    ? {
                        id: currentQuestion.targetPlayer.id,
                        username: currentQuestion.targetPlayer.username,
                        displayName: currentQuestion.targetPlayer.displayName,
                        avatar: currentQuestion.targetPlayer.avatar,
                      }
                    : null,
                }
              : null,
            answers: answers.map((answer) => ({
              id: answer.id,
              content: answer.content,
              playerId: answer.userId,
              playerName: answer.user?.displayName || answer.user?.username || 'Joueur anonyme',
              votesCount: answer.votesCount || 0,
              isOwnAnswer: answer.isOwnAnswer || answer.userId === user.id,
            })),
            currentUserState: {
              hasAnswered,
              hasVoted,
              isTargetPlayer,
            },
          },
        })
      } catch (innerError) {
        console.error(
          `❌ [show] Erreur interne lors de la récupération du jeu ${gameId}:`,
          innerError
        )

        // En mode récupération, renvoyer au moins une structure minimale
        if (isRecoveryMode) {
          return response.ok({
            status: 'success',
            data: {
              game: {
                id: gameId,
                currentRound: 1,
                totalRounds: 5,
                status: 'in_progress',
                gameMode: 'standard',
                currentPhase: 'question',
                scores: {},
                createdAt: new Date(),
              },
              players: [],
              answers: [],
              currentQuestion: null,
              currentUserState: {
                hasAnswered: false,
                hasVoted: false,
                isTargetPlayer: false,
              },
            },
            recovered: true,
          })
        }

        throw innerError // Propager l'erreur en mode normal
      }
    } catch (error) {
      console.error(
        '❌ [show] Erreur non gérée lors de la récupération des détails de la partie:',
        error
      )
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des détails de la partie',
        details: error.message,
      })
    }
  }

  /**
   * Soumettre une réponse à la question actuelle
   */
  async submitAnswer({ request, response, auth, params }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const gameId = params.id

      console.log(`🎮 [submitAnswer] Réception réponse - User: ${user.id}, Game: ${gameId}`)

      // Verrou Redis pour éviter les doublons
      const lockKey = `answer:${gameId}:${user.id}`
      const lockAcquired = await this.acquireLock(lockKey, 10)

      if (!lockAcquired) {
        console.log(`⚠️ [submitAnswer] Verrou actif pour User=${user.id}`)
        return response.conflict({
          error: 'Une soumission est déjà en cours',
        })
      }

      try {
        var payload = await request.validateUsing(answerValidator)
        console.log(
          `🎮 [submitAnswer] Données validées: question_id=${payload.question_id}, contenu: ${payload.content.substring(0, 20)}...`
        )
      } catch (validationError) {
        console.error('❌ [submitAnswer] Erreur de validation:', validationError)
        return response.badRequest({
          error: 'Données incorrectes',
          details: validationError.messages || validationError.message,
        })
      }

      // Trouver la partie
      const game = await Game.find(gameId)
      if (!game) {
        console.error(`❌ [submitAnswer] Partie non trouvée: ${gameId}`)
        return response.notFound({
          error: 'Partie non trouvée',
        })
      }

      console.log(`🎮 [submitAnswer] Phase actuelle: ${game.currentPhase}, Statut: ${game.status}`)

      // Vérifier que la partie est en cours
      if (game.status !== 'in_progress') {
        console.error(`❌ [submitAnswer] La partie n'est pas en cours: ${game.status}`)
        return response.badRequest({
          error: "La partie n'est pas en cours",
        })
      }

      // Vérifier que nous sommes en phase de réponse ou question
      if (game.currentPhase !== 'answer' && game.currentPhase !== 'question') {
        console.error(`❌ [submitAnswer] Phase incorrecte: ${game.currentPhase}`)
        return response.badRequest({
          error: "Ce n'est pas le moment de répondre",
        })
      }

      // Récupérer la question actuelle
      console.log(
        `🎮 [submitAnswer] Recherche de la question - Game: ${gameId}, Round: ${game.currentRound}`
      )
      const question = await Question.query()
        .where('game_id', gameId)
        .where('round_number', game.currentRound)
        .first()

      if (!question) {
        console.error(`❌ [submitAnswer] Aucune question trouvée pour le tour ${game.currentRound}`)
        return response.notFound({
          error: 'Question non trouvée',
        })
      }

      console.log(
        `🎮 [submitAnswer] Question trouvée: ID=${question.id}, target=${question.targetPlayerId}`
      )

      // Vérifier si l'utilisateur est la cible de la question
      if (question.targetPlayerId === user.id) {
        return { error: 'Vous ne pouvez pas répondre à votre propre question' }
      }

      // Vérifier si l'utilisateur a déjà répondu
      const existingAnswer = await Answer.query()
        .where('question_id', question.id)
        .where('user_id', user.id)
        .first()

      if (existingAnswer) {
        return { error: 'Vous avez déjà répondu à cette question' }
      }

      // Vérifier si tous les joueurs ont répondu
      const gameRoom = await Room.find(game.roomId)
      const roomPlayers = gameRoom ? await gameRoom.related('players').query() : []

      // Calculer le nombre de joueurs qui peuvent répondre (tous sauf la cible)
      const eligiblePlayersCount = roomPlayers.length - 1

      const answerCount = await Answer.query()
        .where('question_id', question.id)
        .count('* as total')
        .first()

      if (answerCount && Number(answerCount.$extras.total) >= eligiblePlayersCount) {
        return { error: 'Tous les joueurs ont déjà répondu à cette question' }
      }

      // S'assurer que le payload.content est une chaîne de caractères
      const content = String(payload.content).trim()
      if (!content) {
        console.error(`❌ [submitAnswer] Contenu de réponse vide`)
        return response.badRequest({
          error: 'Le contenu de la réponse ne peut pas être vide',
        })
      }

      try {
        // Répondre plus rapidement au client
        response.response.socket?.setTimeout(0) // Pas de timeout

        // Créer la réponse immédiatement sans timeout
        const answer = await Answer.create({
          questionId: question.id,
          userId: user.id,
          content: content,
          votesCount: 0,
          isSelected: false,
        })

        console.log(`✅ [submitAnswer] Réponse créée avec succès: ID=${answer.id}`)

        const hasVotes = await Vote.query()
          .where('question_id', question.id)
          .count('* as count')
          .first()

        // Utiliser Socket.IO pour notifier les joueurs
        const io = socketService.getInstance()
        io.to(`game:${gameId}`).emit('game:update', {
          type: 'new_answer',
          answer: {
            id: answer.id,
            content: answer.content,
            playerId: user.id,
            playerName: user.displayName || user.username,
          },
          instantTransition: true,
        })

        // Vérifier si tous les joueurs qui PEUVENT répondre ont répondu et passer immédiatement à la phase suivante
        await this.checkAndProgressPhase(gameId, question.id)

        // Notifier immédiatement le succès
        return response.created({
          status: 'success',
          message: 'Réponse soumise avec succès',
        })
      } finally {
        await this.releaseLock(lockKey)
      }
    } catch (error) {
      console.error(
        '❌ [submitAnswer] Erreur non gérée lors de la soumission de la réponse:',
        error
      )
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la soumission de la réponse',
        details: error.message || 'Erreur inconnue',
      })
    }
  }

  /**
   * Nouvelle méthode pour vérifier et faire progresser la phase
   */
  private async checkAndProgressPhase(
    gameId: string | number,
    questionId: string | number
  ): Promise<boolean> {
    try {
      console.log(
        `🔄 [checkAndProgressPhase] Vérification pour le jeu ${gameId}, question ${questionId}`
      )

      // Récupérer le jeu
      const game = await Game.find(gameId)
      if (!game) {
        console.error(`❌ [checkAndProgressPhase] Jeu non trouvé: ${gameId}`)
        return false
      }

      // Si nous sommes déjà en phase vote ou ultérieure, ne rien faire
      if (game.currentPhase === 'vote' || game.currentPhase === 'results') {
        console.log(
          `ℹ️ [checkAndProgressPhase] Déjà en phase ${game.currentPhase}, pas de progression nécessaire`
        )
        return false
      }

      // Récupérer la question
      const question = await Question.findOrFail(questionId)

      // Récupérer la salle et les joueurs
      const gameRoom = await Room.find(game.roomId)
      const roomPlayers = gameRoom ? await gameRoom.related('players').query() : []

      // Compter les réponses existantes pour cette question
      const answersCount = await Answer.query().where('question_id', questionId).count('* as count')
      const count = Number.parseInt(answersCount[0].$extras.count || '0', 10)

      // Calculer combien de joueurs peuvent répondre (tous sauf la cible)
      const nonTargetPlayers = roomPlayers.filter(
        (player) => player.id !== question.targetPlayerId
      ).length

      console.log(
        `🔍 [checkAndProgressPhase] Réponses: ${count}/${nonTargetPlayers}, Phase: ${game.currentPhase}`
      )

      // Si toutes les réponses attendues sont là, passer à vote
      if (count >= nonTargetPlayers) {
        console.log(
          `✅ [checkAndProgressPhase] Toutes les réponses reçues. Passage à la phase vote...`
        )

        // Passer à la phase de vote
        game.currentPhase = 'vote'
        await game.save()

        // Notifier tous les clients
        const io = socketService.getInstance()

        // Trouver le joueur cible pour lui envoyer une notification spéciale
        const targetPlayer = roomPlayers.find((player) => player.id === question.targetPlayerId)

        if (targetPlayer) {
          console.log(
            `🎯 [checkAndProgressPhase] Joueur cible trouvé: ${targetPlayer.id}, notification spéciale envoyée`
          )

          // Récupérer toutes les réponses pour le joueur cible
          const answers = await Answer.query()
            .where('question_id', questionId)
            .preload('user')
            .orderBy('created_at', 'asc')

          // Préparer les données des réponses pour le ciblage
          const answerData = answers.map((answer) => ({
            id: answer.id,
            content: answer.content,
            playerId: answer.userId,
            playerName: answer.user?.displayName || answer.user?.username || 'Joueur anonyme',
          }))

          // Stocker l'ID du joueur cible dans le cache Redis
          await Redis.setex(`game:${gameId}:target_player`, 300, targetPlayer.id)

          // Envoyer une notification spéciale au joueur cible
          io.to(`user:${targetPlayer.id}`).emit('game:update', {
            type: 'target_player_vote',
            phase: 'vote',
            message: "C'est à votre tour de voter!",
            targetPlayerId: targetPlayer.id,
            questionId: questionId,
            answers: answerData,
            instantTransition: true,
            targetPlayer: {
              id: targetPlayer.id,
              username: targetPlayer.username,
              displayName: targetPlayer.displayName,
              avatar: targetPlayer.avatar,
            },
          })

          // Envoyer une notification générale à tous les joueurs
          io.to(`game:${gameId}`).emit('game:update', {
            type: 'phase_change',
            phase: 'vote',
            message: 'Toutes les réponses ont été reçues. Place au vote!',
            targetPlayerId: question.targetPlayerId,
            instantTransition: true,
          })
        }

        return true
      }

      return false
    } catch (error) {
      console.error('❌ [checkAndProgressPhase] Erreur:', error)
      return false
    }
  }

  /**
   * Route pour forcer la vérification et la progression de phase
   * Cette route peut être appelée par le client en cas de blocage détecté
   */
  async forceCheckPhase({ params, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const gameId = params.id

      console.log(
        `🔄 [forceCheckPhase] Demande de vérification forcée - User: ${user.id}, Game: ${gameId}`
      )

      // Récupérer le jeu
      const game = await Game.find(gameId)
      if (!game) {
        return response.notFound({
          error: 'Partie non trouvée',
        })
      }

      // Charger la relation room
      await game.load('room', (query) => {
        query.preload('players')
      })

      // Vérifier que l'utilisateur fait partie de la partie
      const room = await Room.find(game.roomId)
      const isUserInGame = await room.related('players').query().where('user_id', user.id).first()

      if (!isUserInGame) {
        return response.forbidden({
          error: 'Vous ne faites pas partie de cette partie',
        })
      }

      // Récupérer la question actuelle
      const question = await Question.query()
        .where('game_id', gameId)
        .where('round_number', game.currentRound)
        .first()

      if (!question) {
        return response.notFound({
          error: 'Question non trouvée',
        })
      }

      // Tenter de faire progresser la phase
      const progressed = await this.checkAndProgressPhase(gameId, question.id)

      return response.ok({
        status: 'success',
        message: progressed
          ? 'Phase mise à jour avec succès'
          : 'Aucune mise à jour de phase nécessaire',
        data: {
          phaseChanged: progressed,
          currentPhase: game.currentPhase,
        },
      })
    } catch (error) {
      console.error('❌ [forceCheckPhase] Erreur:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la vérification forcée',
      })
    }
  }

  /**
   * Vérifier si tous les votes sont soumis et passer à la phase suivante si nécessaire
   */
  private async checkAndProgressToResults(
    gameId: string | number,
    questionId: number
  ): Promise<void> {
    const lockKey = `game:${gameId}:phase_transition`
    const hasLock = await this.acquireLock(lockKey, 5) // 5 secondes de lock

    if (!hasLock) {
      console.log(
        `⏳ [checkAndProgressToResults] Lock non acquis pour le jeu ${gameId}, tentative abandonnée`
      )
      return
    }

    try {
      // Récupérer le jeu et la question
      const game = await Game.find(gameId)
      if (!game) {
        console.error(`❌ [checkAndProgressToResults] Jeu ${gameId} non trouvé`)
        return
      }

      const question = await Question.find(questionId)
      if (!question) {
        console.error(`❌ [checkAndProgressToResults] Question ${questionId} non trouvée`)
        return
      }

      // Récupérer tous les votes pour cette question
      const votes = await Vote.query()
        .where('question_id', questionId)
        .preload('answer', (answerQuery) => {
          answerQuery.preload('user')
        })

      // Vérifier si le joueur cible a voté
      const targetPlayerVote = votes.find((vote) => vote.voterId === question.targetPlayerId)
      const hasTargetPlayerVoted = !!targetPlayerVote

      console.log(
        `🎯 [checkAndProgressToResults] Le joueur cible ${question.targetPlayerId} a voté: ${hasTargetPlayerVoted}`
      )

      if (hasTargetPlayerVoted) {
        console.log(`🎮 [checkAndProgressToResults] Passage à la phase results...`)

        // Calculer les scores
        const scores = { ...game.scores }
        votes.forEach((vote) => {
          const answerUserId = vote.answer.userId
          if (!scores[answerUserId]) {
            scores[answerUserId] = 0
          }
          scores[answerUserId] += 1
        })

        // Mettre à jour les scores du jeu
        game.scores = scores
        game.currentPhase = 'results'
        await game.save()

        // Invalider tous les caches Redis pour ce jeu
        const cacheKeys = [
          `game:${gameId}:state`,
          `game:${gameId}:phase`,
          `game:${gameId}:scores`,
          `game:${gameId}:votes`,
        ]
        await Promise.all(cacheKeys.map((key) => Redis.del(key)))

        // Préparer les résultats pour l'affichage
        const results = votes.map((vote) => ({
          answerId: vote.answerId,
          voterId: vote.voterId,
          answerUserId: vote.answer.userId,
          answerText: vote.answer.content,
          voterName: vote.answer.user.displayName || vote.answer.user.username,
        }))

        const io = socketService.getInstance()
        io.to(`game:${gameId}`).emit('game:update', {
          type: 'phase_change',
          phase: 'results',
          message: 'Le vote a été soumis!',
          results: results,
          scores: scores,
          instantTransition: true,
        })

        console.log(`✅ [checkAndProgressToResults] Phase results activée avec succès`)
      } else {
        console.log(
          `⏳ [checkAndProgressToResults] En attente du vote du joueur cible ${question.targetPlayerId}`
        )
      }
    } catch (error) {
      console.error('❌ [checkAndProgressToResults] Erreur:', error)
    } finally {
      await this.releaseLock(lockKey)
    }
  }

  /**
   * Voter pour une réponse
   */
  @inject()
  public async submitVote({ request, response, auth, params }: HttpContext) {
    const lockKey = `game:${params.id}:vote`
    const hasLock = await this.acquireLock(lockKey, 5)

    if (!hasLock) {
      console.log(`⏳ [submitVote] Lock non acquis pour le jeu ${params.id}, tentative abandonnée`)
      return response.tooManyRequests({
        error: 'Une autre opération est en cours, veuillez réessayer.',
      })
    }

    try {
      const user = await auth.authenticate()
      const gameId = params.id

      // Validate the request payload
      const payload = await request.validateUsing(voteValidator)
      const { answer_id: answerId, question_id: questionId } = payload

      console.log(
        `🎮 [submitVote] Vote reçu - User: ${user.id}, Game: ${gameId}, Question: ${questionId}, Answer: ${answerId}`
      )

      // Vérifier que le jeu existe et est en cours
      const game = await Game.find(gameId)
      if (!game || game.status !== 'in_progress') {
        console.error(`❌ [submitVote] Jeu invalide ou terminé: ${gameId}`)
        return response.badRequest({
          error: 'Le jeu est invalide ou terminé.',
        })
      }

      // Vérifier que nous sommes en phase de vote
      if (game.currentPhase !== 'vote') {
        console.error(`❌ [submitVote] Phase incorrecte: ${game.currentPhase}`)
        return response.badRequest({
          error: "Ce n'est pas le moment de voter.",
        })
      }

      // Récupérer la question
      const question = await Question.findOrFail(questionId)
      console.log(
        `🎯 [submitVote] Question trouvée - Target: ${question.targetPlayerId}, Current User: ${user.id}`
      )

      // Vérifier si le joueur a déjà voté
      const existingVote = await Vote.query()
        .where('question_id', questionId)
        .where('voter_id', user.id)
        .first()

      if (existingVote) {
        console.error(`❌ [submitVote] Vote déjà soumis par le joueur ${user.id}`)
        return response.conflict({
          error: 'Vous avez déjà voté.',
        })
      }

      // Si le joueur est la cible, il peut voter directement
      const isTarget = user.id === question.targetPlayerId
      console.log(`🎯 [submitVote] Joueur ${user.id} est la cible: ${isTarget}`)

      if (!isTarget) {
        // Pour les autres joueurs, vérifier qu'ils ont répondu
        const hasAnswered = await Answer.query()
          .where('question_id', questionId)
          .where('user_id', user.id)
          .first()

        console.log(`📝 [submitVote] Joueur ${user.id} a répondu: ${!!hasAnswered}`)

        if (!hasAnswered) {
          console.error(`❌ [submitVote] Le joueur ${user.id} n'a pas répondu à la question`)
          return response.badRequest({
            error: "Vous devez d'abord répondre à la question avant de voter.",
          })
        }
      }

      // Créer le vote
      const vote = await Vote.create({
        questionId: questionId,
        voterId: user.id,
        answerId: answerId,
      })

      console.log(`✅ [submitVote] Vote enregistré: ${vote.id}`)

      // Invalider tous les caches Redis pour ce jeu
      const cacheKeys = [
        `game:${gameId}:state`,
        `game:${gameId}:phase`,
        `game:${gameId}:scores`,
        `game:${gameId}:votes`,
      ]
      await Promise.all(cacheKeys.map((key) => Redis.del(key)))

      // Notifier tous les clients du nouveau vote
      const io = socketService.getInstance()
      io.to(`game:${gameId}`).emit('game:update', {
        type: 'vote_submitted',
        playerId: user.id,
        message: `${user.displayName || user.username} a voté !`,
      })

      // Vérifier immédiatement si tous les votes sont soumis
      console.log(`🔄 [submitVote] Vérification des votes après soumission`)
      await this.checkAndProgressToResults(gameId, questionId)

      return response.ok({
        status: 'success',
        message: 'Vote enregistré avec succès',
      })
    } catch (error) {
      console.error('❌ [submitVote] Erreur:', error)
      return response.internalServerError({
        error: "Une erreur s'est produite lors du vote.",
      })
    } finally {
      await this.releaseLock(lockKey)
    }
  }

  /**
   * Passer au tour suivant ou terminer la partie avec gestion Redis
   */
  async nextRound({ response, auth, params }: HttpContext) {
    const gameId = params.id
    const lockKey = `game:${gameId}:phase_change`

    try {
      // Tentative d'acquisition du lock
      const lockAcquired = await this.acquireLock(lockKey, 30)

      if (!lockAcquired) {
        console.log('🔒 [nextRound] Lock non acquis:', { gameId, lockKey })
        return response.conflict({
          error: 'Une transition de phase est déjà en cours',
        })
      }

      try {
        const user = await auth.authenticate()

        console.log(
          `🎮 [nextRound] Tentative de passage au tour suivant - User: ${user.id}, Game: ${gameId}`
        )

        // Trouver la partie
        const game = await Game.find(gameId)
        if (!game) {
          console.error(`❌ [nextRound] Partie non trouvée: ${gameId}`)
          return response.notFound({
            error: 'Partie non trouvée',
          })
        }

        // Charger la relation room
        await game.load('room', (query) => {
          query.preload('players')
        })

        console.log(
          `🎮 [nextRound] Partie trouvée: ${game.id}, Phase: ${game.currentPhase}, Round: ${game.currentRound}/${game.totalRounds}`
        )

        // Récupérer la salle pour vérifier que l'utilisateur est l'hôte ou la cible
        const room = await Room.find(game.roomId)
        if (!room) {
          console.error(`❌ [nextRound] Salle non trouvée: ${game.roomId}`)
          return response.notFound({
            error: 'Salle non trouvée',
          })
        }

        console.log(`🎮 [nextRound] Salle trouvée: ${room.id}, Hôte: ${room.hostId}`)

        // Vérifier que la partie est en cours
        if (game.status !== 'in_progress') {
          console.error(`❌ [nextRound] La partie n'est pas en cours: ${game.status}`)
          return response.badRequest({
            error: "La partie n'est pas en cours",
          })
        }

        // Vérifier que l'utilisateur est l'hôte
        const isHost = String(room.hostId) === String(user.id)

        console.log('👑 [nextRound] Vérification des droits:', {
          userId: user.id,
          hostId: room.hostId,
          isHost,
          userIdType: typeof user.id,
          hostIdType: typeof room.hostId,
        })

        if (!isHost) {
          console.log('❌ [nextRound] Droits insuffisants:', {
            userId: user.id,
            hostId: room.hostId,
          })
          return response.unauthorized({
            error: "Seul l'hôte peut passer au tour suivant",
          })
        }

        // Mettre à jour le cache Redis pour le statut d'hôte
        await Redis.setex(`game:${gameId}:host`, 300, room.hostId)

        console.log(`👑 [nextRound] Vérification des droits:
          - User ID: ${user.id} (${typeof user.id})
          - Host ID: ${room.hostId} (${typeof room.hostId})
          - Est hôte: ${isHost}
        `)

        const io = socketService.getInstance()

        // Vérifier si c'est le dernier tour
        if (game.currentRound >= game.totalRounds) {
          console.log(
            `🎮 [nextRound] Dernier tour terminé, fin de la partie: ${game.currentRound}/${game.totalRounds}`
          )

          // Terminer la partie
          game.status = 'completed'
          game.completedAt = DateTime.now()
          await game.save()

          // Mettre à jour le statut de la salle
          room.status = 'finished'
          room.endedAt = DateTime.now()
          await room.save()

          // Mettre à jour les statistiques des joueurs
          await this.updatePlayerStats(room.id, game)

          // Notifier tous les joueurs de la fin de partie
          io.to(`game:${gameId}`).emit('game:update', {
            type: 'game_end',
            finalScores: game.scores,
          })

          return {
            status: 'success',
            message: 'La partie est terminée',
            data: {
              finalScores: game.scores,
            },
          }
        } else {
          console.log(`🎮 [nextRound] Passage au tour ${game.currentRound + 1}/${game.totalRounds}`)

          // Passer au tour suivant
          game.currentRound += 1
          game.currentPhase = 'question'

          // Sélectionner un nouveau joueur cible au hasard
          const targetPlayer = await selectRandomTargetPlayer(gameId, game.currentTargetPlayerId)

          // Mettre à jour le joueur cible actuel
          game.currentTargetPlayerId = targetPlayer.id
          await game.save()

          // Récupérer une question depuis la base de données
          const questionFromDB = await questionService.getRandomQuestionByTheme(game.gameMode)

          // En cas d'échec, générer une question de secours
          let questionText = ''
          if (questionFromDB) {
            console.log(
              `✅ [nextRound] Question trouvée dans la base de données: ID=${questionFromDB.id}, theme=${questionFromDB.theme}`
            )
            questionText = questionService.formatQuestion(
              questionFromDB.text,
              targetPlayer.displayName || targetPlayer.username
            )
          } else {
            console.warn(
              `⚠️ [nextRound] Aucune question trouvée dans la base de données pour le thème ${game.gameMode}`
            )
            // Utiliser la méthode de secours si aucune question n'est disponible dans la DB
            questionText = await this.generateFallbackQuestion(
              game.gameMode,
              targetPlayer.displayName || targetPlayer.username
            )
          }

          // Créer la nouvelle question
          const question = await Question.create({
            text: questionText,
            theme: game.gameMode,
            gameId: game.id,
            roundNumber: game.currentRound,
            targetPlayerId: targetPlayer.id,
          })

          // Notifier tous les joueurs du nouveau tour immédiatement
          io.to(`game:${gameId}`).emit('game:update', {
            type: 'new_round',
            round: game.currentRound,
            phase: 'question',
            question: {
              id: question.id,
              text: question.text,
              targetPlayer: {
                id: targetPlayer.id,
                username: targetPlayer.username,
                displayName: targetPlayer.displayName,
              },
            },
            instantTransition: true,
          })

          return {
            status: 'success',
            message: 'Tour suivant lancé avec succès',
            data: {
              round: game.currentRound,
              phase: game.currentPhase,
              targetPlayer: {
                id: targetPlayer.id,
                username: targetPlayer.username,
                displayName: targetPlayer.displayName,
              },
            },
          }
        }
      } finally {
        // Libérer le lock
        await this.releaseLock(lockKey)
      }
    } catch (error) {
      console.error('❌ [nextRound] Erreur:', error)
      return response.internalServerError({
        error: "Une erreur s'est produite lors du passage au tour suivant",
      })
    }
  }

  /**
   * Méthode privée pour mettre à jour les statistiques des joueurs
   */
  private async updatePlayerStats(roomId: number, game: Game) {
    // Récupérer tous les joueurs de la salle
    const room = await Room.find(roomId)
    if (!room) return

    const players = await room.related('players').query()

    // Déterminer le gagnant (joueur avec le score le plus élevé)
    let winnerScore = -1
    let winnerId = null
    for (const playerId in game.scores) {
      if (game.scores[playerId] > winnerScore) {
        winnerScore = game.scores[playerId]
        winnerId = Number.parseInt(playerId, 10)
      }
    }

    // Mettre à jour les statistiques pour chaque joueur
    for (const player of players) {
      player.gamesPlayed += 1

      // Si le joueur est le gagnant, incrémenter le nombre de victoires
      if (player.id === winnerId) {
        player.gamesWon += 1
        player.experiencePoints += 50
      } else {
        player.experiencePoints += 20
      }

      // Vérifier le niveau du joueur et le mettre à jour si nécessaire
      const newLevel = Math.floor(player.experiencePoints / 100) + 1
      if (newLevel > player.level) {
        player.level = newLevel
      }

      // Sauvegarder les changements
      await player.save()
    }
  }

  /**
   * Méthode privée pour générer une question de secours
   */
  private async generateFallbackQuestion(theme: string, playerName: string): Promise<string> {
    try {
      console.log(
        `🔄 [generateFallbackQuestion] Tentative de récupération depuis la base de données pour le thème ${theme}`
      )

      // Utiliser le service de questions pour récupérer depuis la BD
      const question = await questionService.getRandomQuestionByTheme(theme)

      if (question && question.text) {
        console.log(`✅ [generateFallbackQuestion] Question récupérée: ID=${question.id}`)
        // Formater la question avec le nom du joueur
        return questionService.formatQuestion(question.text, playerName)
      }

      // Si on n'a pas trouvé de question pour ce thème, essayer avec le thème standard
      if (theme !== 'standard') {
        console.log(`⚠️ [generateFallbackQuestion] Tentative avec le thème standard`)
        const standardQuestion = await questionService.getRandomQuestionByTheme('standard')

        if (standardQuestion && standardQuestion.text) {
          return questionService.formatQuestion(standardQuestion.text, playerName)
        }
      }

      // Si toujours rien, utiliser une question très basique
      throw new Error('Aucune question trouvée en base de données')
    } catch (error) {
      console.error(
        `❌ [generateFallbackQuestion] Échec de récupération depuis la base de données:`,
        error
      )
      // Question vraiment de dernier recours, évitant tout contenu statique
      return `Quelle est la chose la plus surprenante à propos de ${playerName} ?`
    }
  }

  /**
   * Récupérer l'état du jeu pour un utilisateur spécifique
   */
  async getGameState(gameId: number, userId: number) {
    try {
      // Récupérer le jeu avec ses relations
      const game = await Game.query()
        .where('id', gameId)
        .preload('room', (roomQuery) => {
          roomQuery.preload('players')
        })
        .first()

      if (!game) {
        throw new Error('Partie non trouvée')
      }

      // Récupérer la question actuelle si elle existe
      let currentQuestion = null
      if (game.currentRound > 0) {
        currentQuestion = await Question.query()
          .where('game_id', game.id)
          .where('round_number', game.currentRound)
          .preload('targetPlayer')
          .first()
      }

      // Récupérer toutes les réponses pour la question actuelle
      let answers = []
      if (currentQuestion) {
        answers = await Answer.query()
          .where('question_id', currentQuestion.id)
          .preload('user')
          .orderBy('created_at', 'asc')

        // Ajouter un marqueur pour identifier les propres réponses de l'utilisateur
        answers = answers.map((answer) => ({
          ...answer.toJSON(),
          isOwnAnswer: answer.userId === userId,
        }))
      }

      // Déterminer si l'utilisateur actuel a déjà répondu et voté
      let hasAnswered = false
      let hasVoted = false
      let isTargetPlayer = false

      if (currentQuestion) {
        hasAnswered =
          (await Answer.query()
            .where('question_id', currentQuestion.id)
            .where('user_id', userId)
            .first()) !== null

        hasVoted =
          (await Vote.query()
            .where('question_id', currentQuestion.id)
            .where('voter_id', userId)
            .first()) !== null

        isTargetPlayer = currentQuestion.targetPlayerId === userId
      }

      return {
        game: {
          id: game.id,
          roomId: game.roomId,
          currentRound: game.currentRound,
          totalRounds: game.totalRounds,
          status: game.status,
          gameMode: game.gameMode,
          currentPhase: game.currentPhase,
          scores: game.scores || {},
          createdAt: game.createdAt,
        },
        room: {
          id: game.room.id,
          code: game.room.code,
          name: game.room.name,
          hostId: game.room.hostId,
        },
        players: game.room.players.map((player) => ({
          id: player.id,
          username: player.username,
          displayName: player.displayName,
          avatar: player.avatar,
          score: game.scores?.[player.id] || 0,
          isHost: player.id === game.room.hostId,
        })),
        currentQuestion: currentQuestion
          ? {
              id: currentQuestion.id,
              text: currentQuestion.text,
              roundNumber: currentQuestion.roundNumber,
              targetPlayer: currentQuestion.targetPlayer
                ? {
                    id: currentQuestion.targetPlayer.id,
                    username: currentQuestion.targetPlayer.username,
                    displayName: currentQuestion.targetPlayer.displayName,
                    avatar: currentQuestion.targetPlayer.avatar,
                  }
                : null,
            }
          : null,
        answers: answers.map((answer) => ({
          id: answer.id,
          content: answer.content,
          playerId: answer.userId,
          playerName: answer.user?.displayName || answer.user?.username || 'Joueur anonyme',
          votesCount: answer.votesCount || 0,
          isOwnAnswer: answer.isOwnAnswer || answer.userId === userId,
        })),
        currentUserState: {
          hasAnswered,
          hasVoted,
          isTargetPlayer,
        },
      }
    } catch (error) {
      console.error('❌ [getGameState] Erreur:', error)
      throw error
    }
  }

  /**
   * Récupérer les résultats finaux d'une partie
   */
  async getResults({ params, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const gameId = params.id

      const game = await Game.query()
        .where('id', gameId)
        .preload('room', (roomQuery) => {
          roomQuery.preload('players')
        })
        .first()

      if (!game) {
        return response.notFound({
          error: 'Partie non trouvée',
        })
      }

      // Vérifier que le joueur fait partie de la partie
      const isPlayerInGame = game.room.players.some((player) => player.id === user.id)

      if (!isPlayerInGame) {
        return response.forbidden({
          error: 'Vous ne faites pas partie de cette partie',
        })
      }

      // Vérifier que la partie est terminée
      if (game.status !== 'completed') {
        return response.badRequest({
          error: "La partie n'est pas encore terminée",
        })
      }

      // Récupérer les scores des joueurs
      const playersWithScores = game.room.players.map((player) => ({
        id: player.id,
        name: player.displayName || player.username,
        avatar: player.avatar,
        score: game.scores?.[player.id] || 0,
      }))

      // Trier les joueurs par score (décroissant)
      playersWithScores.sort((a, b) => b.score - a.score)

      return response.ok({
        status: 'success',
        data: {
          gameId: game.id,
          players: playersWithScores,
        },
      })
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des résultats:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des résultats',
      })
    }
  }
}
