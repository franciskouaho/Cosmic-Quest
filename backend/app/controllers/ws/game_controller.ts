import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { answerValidator, voteValidator } from '#validators/game'
import socketService from '#services/socket_service'
import questionService from '#services/question_service'
import Redis from '@adonisjs/redis/services/main'

import Game from '#models/game'
import Question from '#models/question'
import Answer from '#models/answer'
import Vote from '#models/vote'
import Room from '#models/room'

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
      const result = await Redis.set(key, Date.now().toString(), 'NX', 'EX', ttl)
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

      console.log(
        `🎮 [submitAnswer] Tentative de soumission d'une réponse - User: ${user.id}, Game: ${gameId}`
      )

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

      // SOLUTION: ACCEPTER LES RÉPONSES DANS N'IMPORTE QUELLE PHASE
      // Au lieu de vérifier la phase, nous allons accepter les réponses quelle que soit la phase
      // Cela permet aux joueurs de rattraper leur retard s'ils ont eu des problèmes de connexion
      console.log(`🎮 [submitAnswer] Acceptation de la réponse dans la phase ${game.currentPhase}`)

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

      // Vérifier que l'utilisateur n'est pas la cible de la question (il ne peut pas répondre à sa propre question)
      if (question.targetPlayerId === user.id) {
        console.error(
          `❌ [submitAnswer] L'utilisateur est la cible: User=${user.id}, Target=${question.targetPlayerId}`
        )
        return response.badRequest({
          error: 'Vous êtes la cible de cette question et ne pouvez pas y répondre',
          code: 'TARGET_PLAYER_CANNOT_ANSWER',
        })
      }

      // Vérifier que l'utilisateur n'a pas déjà répondu
      const existingAnswer = await Answer.query()
        .where('question_id', question.id)
        .where('user_id', user.id)
        .first()

      if (existingAnswer) {
        console.error(`❌ [submitAnswer] L'utilisateur a déjà répondu: Answer=${existingAnswer.id}`)
        return response.conflict({
          error: 'Vous avez déjà répondu à cette question',
        })
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
        // Créer la réponse
        console.log(
          `🎮 [submitAnswer] Tentative de création de réponse pour User=${user.id}, Question=${question.id}`
        )
        const answer = await Answer.create({
          questionId: question.id,
          userId: user.id,
          content: content,
          votesCount: 0,
          isSelected: false,
        })

        console.log(`✅ [submitAnswer] Réponse créée avec succès: ID=${answer.id}`)

        // Récupérer la salle pour les événements WebSocket
        const room = await Room.find(game.roomId)
        const players = await room.related('players').query()
        const totalPlayers = players.length

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
        })

        // Vérifier si tous les joueurs qui PEUVENT répondre ont répondu
        await this.checkAndProgressPhase(gameId, question.id)
      } catch (dbError) {
        console.error(`❌ [submitAnswer] Erreur lors de la création de la réponse:`, dbError)
        return response.internalServerError({
          error: "Erreur lors de l'enregistrement de votre réponse",
          details: dbError.message,
        })
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

      // Si nous ne sommes pas en phase answer, pas besoin d'effectuer la vérification
      if (game.currentPhase !== 'answer') {
        console.log(
          `ℹ️ [checkAndProgressPhase] Phase actuelle n'est pas 'answer' mais '${game.currentPhase}'`
        )
        return false
      }

      // Récupérer la question
      const question = await Question.findOrFail(questionId)

      // Récupérer la salle et les joueurs
      const room = await Room.find(game.roomId)
      const players = await room.related('players').query()

      // Compter les réponses existantes pour cette question
      const answersCount = await Answer.query().where('question_id', questionId).count('* as count')
      const count = Number.parseInt(answersCount[0].$extras.count || '0', 10)

      // Calculer combien de joueurs peuvent répondre (tous sauf la cible)
      const nonTargetPlayers = players.filter(
        (player) => player.id !== question.targetPlayerId
      ).length

      console.log(
        `🔍 [checkAndProgressPhase] Réponses: ${count}/${nonTargetPlayers}, Phase: ${game.currentPhase}`
      )

      // Si toutes les réponses attendues sont là et que nous sommes en phase answer, passer à vote
      if (count >= nonTargetPlayers && game.currentPhase === 'answer') {
        console.log(
          `✅ [checkAndProgressPhase] Toutes les réponses reçues. Passage à la phase vote...`
        )

        // Passer à la phase de vote
        game.currentPhase = 'vote'
        await game.save()

        // Notifier tous les clients
        const io = socketService.getInstance()
        const votePhaseDuration = 20 // 20 secondes

        // Trouver le joueur cible pour lui envoyer une notification spéciale
        const targetPlayer = players.find((player) => player.id === question.targetPlayerId)

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

          // Notification spéciale pour le joueur cible avec les réponses
          io.to(`game:${gameId}`).emit('game:update', {
            type: 'target_player_vote',
            phase: 'vote',
            message: "C'est à votre tour de voter!",
            targetPlayerId: targetPlayer.id,
            questionId: questionId,
            answers: answerData,
            timer: {
              duration: votePhaseDuration,
              startTime: Date.now(),
            },
          })
        }

        // Notification générale du changement de phase
        io.to(`game:${gameId}`).emit('game:update', {
          type: 'phase_change',
          phase: 'vote',
          message: 'Toutes les réponses ont été reçues. Place au vote!',
          targetPlayerId: question.targetPlayerId,
          timer: {
            duration: votePhaseDuration,
            startTime: Date.now(),
          },
        })

        // Notification de rappel après 2 secondes pour s'assurer que tout le monde l'a reçue
        setTimeout(() => {
          io.to(`game:${gameId}`).emit('game:update', {
            type: 'phase_reminder',
            phase: 'vote',
            message: 'Passé en phase de vote',
            targetPlayerId: question.targetPlayerId,
            timer: {
              duration: votePhaseDuration - 2,
              startTime: Date.now(),
            },
          })
        }, 2000)

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
   * Voter pour une réponse
   */
  async submitVote({ request, response, auth, params }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const gameId = params.id
      const payload = await request.validateUsing(voteValidator)

      // Trouver la partie
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

      // Vérifier que la phase actuelle est bien la phase de vote
      // Assouplissement: accepter les votes même si la phase n'est pas 'vote'
      // Cela permet de gérer les cas où le client est légèrement désynchronisé
      if (game.currentPhase !== 'vote') {
        console.log(
          `⚠️ [submitVote] Vote reçu en phase '${game.currentPhase}' au lieu de 'vote' - tentative de récupération`
        )

        // Si nous ne sommes pas en phase vote, forcer le passage en phase vote
        game.currentPhase = 'vote'
        await game.save()

        console.log(`✅ [submitVote] Phase corrigée à 'vote' - Game: ${gameId}`)
      }

      // Vérifier que la question existe
      const question = await Question.query()
        .where('id', payload.question_id)
        .where('game_id', gameId)
        .first()

      if (!question) {
        return response.notFound({
          error: 'Question non trouvée',
        })
      }

      // Vérifier que la réponse existe
      const answer = await Answer.query()
        .where('id', payload.answer_id)
        .where('question_id', question.id)
        .first()

      if (!answer) {
        return response.notFound({
          error: 'Réponse non trouvée',
        })
      }

      // Vérifier que l'utilisateur ne vote pas pour sa propre réponse
      if (answer.userId === user.id) {
        return response.badRequest({
          error: 'Vous ne pouvez pas voter pour votre propre réponse',
        })
      }

      // Vérifier que l'utilisateur n'a pas déjà voté
      const existingVote = await Vote.query()
        .where('question_id', question.id)
        .where('voter_id', user.id)
        .first()

      if (existingVote) {
        return response.conflict({
          error: 'Vous avez déjà voté pour cette question',
        })
      }

      // Créer le vote
      await Vote.create({
        questionId: question.id,
        voterId: user.id,
        answerId: answer.id,
      })

      // Incrémenter le compteur de votes sur la réponse
      answer.votesCount += 1
      await answer.save()

      // Remplacer transmit.emit par socketService
      const io = socketService.getInstance()
      io.to(`game:${gameId}`).emit('game:update', {
        type: 'new_vote',
        vote: {
          voterId: user.id,
          answerId: answer.id,
        },
      })

      // Vérifier si tous les joueurs (sauf ceux qui ont donné une réponse) ont voté
      const room = await Room.find(game.roomId)
      const players = await room.related('players').query()
      const totalPlayers = players.length

      const votesCount = await Vote.query().where('question_id', question.id).count('* as count')
      const count = Number.parseInt(votesCount[0].$extras.count, 10)

      // Amélioration pour les petites parties
      const isSmallGame = totalPlayers <= 2
      const targetPlayer = await players.find((p) => p.id === question.targetPlayerId)

      console.log(
        `🎮 [submitVote] Votes: ${count}/${isSmallGame ? 1 : players.length - 1} (joueurs pouvant voter)`
      )

      // Tous les joueurs ont voté OU dans une partie à 2, dès qu'il y a un vote, on peut continuer
      if (count >= players.length - 1 || (isSmallGame && count > 0)) {
        // Passer à la phase de résultats
        game.currentPhase = 'results'
        await game.save()

        // Calculer les points et mettre à jour les scores
        await this.calculateAndUpdateScores(question.id, game)

        // Définir la durée pour la phase résultats
        const resultsPhaseDuration = 15 // 15 secondes pour voir les résultats

        // Notifier tous les joueurs du changement de phase avec le compteur
        io.to(`game:${gameId}`).emit('game:update', {
          type: 'phase_change',
          phase: 'results',
          scores: game.scores,
          timer: {
            duration: resultsPhaseDuration,
            startTime: Date.now(),
          },
        })
      }

      return response.created({
        status: 'success',
        message: 'Vote soumis avec succès',
      })
    } catch (error) {
      console.error('Erreur lors de la soumission du vote:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la soumission du vote',
      })
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

        console.log(
          `🎮 [nextRound] Partie trouvée: ${game.id}, Phase: ${game.currentPhase}, Round: ${game.currentRound}/${game.totalRounds}`
        )

        // Récupérer la salle pour vérifier que l'utilisateur est l'hôte
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

        // CORRECTION: Vérifier plus précisément l'état actuel
        const currentQuestion = await Question.query()
          .where('game_id', gameId)
          .where('round_number', game.currentRound)
          .first()

        const hasVotes = await Vote.query()
          .where('question_id', currentQuestion?.id)
          .count('* as count')
          .first()

        // Vérifier que nous sommes dans une phase valide ET qu'il y a eu des votes
        const validPhases = ['results', 'vote']
        if (
          !validPhases.includes(game.currentPhase) ||
          (game.currentPhase === 'vote' && (!hasVotes || hasVotes.$extras.count === '0'))
        ) {
          return response.badRequest({
            error: 'Veuillez attendre la fin des votes avant de passer au tour suivant',
            details: {
              currentPhase: game.currentPhase,
              hasVotes: hasVotes ? Number(hasVotes.$extras.count) > 0 : false,
            },
          })
        }

        // Vérifier que l'utilisateur est bien l'hôte de la salle
        if (room.hostId !== user.id) {
          console.error(
            `❌ [nextRound] L'utilisateur n'est pas l'hôte: User=${user.id}, Hôte=${room.hostId}`
          )
          return response.forbidden({
            error: "Seul l'hôte peut passer au tour suivant",
          })
        }

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

          // Mettre à jour les statistiques des joueurs (parties jouées, etc.)
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

          // Définir la durée pour la phase question
          const questionPhaseDuration = 10 // 10 secondes

          // Notifier tous les joueurs du nouveau tour avec le compteur
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
            timer: {
              duration: questionPhaseDuration,
              startTime: Date.now(),
            },
          })

          // Après un délai, passer à la phase de réponse
          setTimeout(async () => {
            game.currentPhase = 'answer'
            await game.save()

            // Définir la durée pour la phase réponse
            const answerPhaseDuration = 30 // 30 secondes pour répondre

            io.to(`game:${gameId}`).emit('game:update', {
              type: 'phase_change',
              phase: 'answer',
              timer: {
                duration: answerPhaseDuration,
                startTime: Date.now(),
              },
            })
          }, questionPhaseDuration * 1000) // 10 secondes pour voir la question

          // Notification avec confirmation
          io.to(`game:${gameId}`).emit('game:update', {
            type: 'phase_changed',
            newPhase: 'question',
            round: game.currentRound,
          })

          return {
            status: 'success',
            message: 'Nouveau tour démarré',
            data: {
              currentRound: game.currentRound,
              totalRounds: game.totalRounds,
              question: {
                id: question.id,
                text: question.text,
              },
            },
          }
        }
      } finally {
        // Toujours libérer le lock
        await this.releaseLock(lockKey)
      }
    } catch (error) {
      console.error('❌ [nextRound] Erreur:', error)
      // S'assurer que le lock est libéré même en cas d'erreur
      await this.releaseLock(lockKey)
      throw error
    }
  }

  /**
   * Méthode publique pour générer une question qui peut être utilisée par d'autres contrôleurs
   */
  public async generateQuestion(theme: string, playerName: string): Promise<string> {
    return this.generateFallbackQuestion(theme, playerName)
  }

  /**
   * Méthode privée pour générer une question de secours si la base de données échoue
   */
  private async generateFallbackQuestion(theme: string, playerName: string): Promise<string> {
    // Récupérer une question directement depuis la base de données
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
   * Méthode publique pour calculer et mettre à jour les scores
   * Rendue publique pour être utilisée par le service WebSocket
   */
  public async calculateAndUpdateScores(questionId: number, game: Game) {
    // Récupérer toutes les réponses avec leurs votes
    const answers = await Answer.query().where('question_id', questionId).preload('votes')

    // Pour chaque réponse, ajouter des points à l'auteur en fonction des votes
    for (const answer of answers) {
      const pointsPerVote = 10 // 10 points par vote reçu
      const totalPoints = answer.votes.length * pointsPerVote

      // Mettre à jour le score du joueur
      if (totalPoints > 0) {
        const userId = answer.userId
        if (!game.scores[userId]) {
          game.scores[userId] = 0
        }

        game.scores[userId] += totalPoints
      }
    }

    // Sauvegarder les scores mis à jour
    await game.save()
  }

  /**
   * Méthode privée pour mettre à jour les statistiques des joueurs
   */
  private async updatePlayerStats(roomId: number, game: Game) {
    // Récupérer tous les joueurs de la salle
    const room = await Room.find(roomId)
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
   * Traiter la soumission d'une réponse
   */
  public async handleAnswerSubmission(socket: Socket, data: any) {
    try {
      // ...existing code...

      // Après avoir sauvegardé la réponse, vérifier si toutes les réponses sont soumises
      const allAnswers = await this.checkAllAnswersSubmitted(data.gameId, data.questionId)

      if (allAnswers) {
        console.log(
          `✅ Toutes les réponses ont été soumises pour le jeu ${data.gameId}, question ${data.questionId}`
        )

        // Passer à la phase de vote si nécessaire
        await this.advanceToVotePhase(data.gameId, data.questionId)
      }

      // ...existing code...
    } catch (error) {
      // ...existing code...
    }
  }

  /**
   * Vérifier si toutes les réponses ont été soumises
   */
  private async checkAllAnswersSubmitted(
    gameId: string | number,
    questionId: string | number
  ): Promise<boolean> {
    try {
      // Récupérer le jeu
      const game = await Game.find(gameId)
      if (!game) return false

      // Récupérer la question
      const question = await Question.findOrFail(questionId)

      // Récupérer la salle et les joueurs
      const room = await Room.find(game.roomId)
      const players = await room.related('players').query()

      // Compter les réponses existantes pour cette question
      const answersCount = await Answer.query().where('question_id', questionId).count('* as count')
      const count = Number.parseInt(answersCount[0].$extras.count || '0', 10)

      // Calculer combien de joueurs peuvent répondre (tous sauf la cible)
      const nonTargetPlayers = players.filter(
        (player) => player.id !== question.targetPlayerId
      ).length

      console.log(
        `📊 [checkAllAnswersSubmitted] Réponses: ${count}/${nonTargetPlayers}, Phase: ${game.currentPhase}`
      )

      // Vérifier si toutes les réponses attendues sont là
      return count >= nonTargetPlayers
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des réponses:', error)
      return false
    }
  }

  /**
   * Faire passer le jeu à la phase de vote et envoyer une notification spéciale au joueur ciblé
   */
  private async advanceToVotePhase(
    gameId: string | number,
    questionId: string | number
  ): Promise<boolean> {
    try {
      // Récupérer le jeu
      const game = await Game.find(gameId)
      if (!game) return false

      // Si déjà en phase vote ou ultérieure, ne rien faire
      if (game.currentPhase !== 'answer') {
        return false
      }

      // Récupérer la question
      const question = await Question.findOrFail(questionId)

      // Récupérer la salle et les joueurs
      const room = await Room.find(game.roomId)
      const players = await room.related('players').query()

      // Passer à la phase de vote
      game.currentPhase = 'vote'
      await game.save()

      // Récupérer les réponses pour les envoyer au joueur ciblé
      const answers = await Answer.query()
        .where('question_id', questionId)
        .preload('user')
        .orderBy('created_at', 'asc')

      // Formater les réponses pour l'envoi
      const formattedAnswers = answers.map((answer) => ({
        id: answer.id,
        content: answer.content,
        playerId: answer.userId,
        playerName: answer.user?.displayName || answer.user?.username || 'Joueur anonyme',
      }))

      // Trouver le joueur cible
      const targetPlayer = players.find((player) => player.id === question.targetPlayerId)

      // Instance Socket.IO
      const io = socketService.getInstance()

      // Durée de la phase de vote
      const votePhaseDuration = 20 // 20 secondes

      // Notification spécifique pour le joueur ciblé
      if (targetPlayer) {
        console.log(
          `🎯 [advanceToVotePhase] Notification spéciale envoyée au joueur cible ${targetPlayer.id}`
        )

        // Émettre un événement spécial avec toutes les réponses pour le joueur ciblé
        io.to(`user:${targetPlayer.id}`).emit('game:update', {
          type: 'target_player_vote',
          phase: 'vote',
          message: "C'est à votre tour de voter pour une réponse!",
          targetPlayerId: targetPlayer.id,
          questionId: question.id,
          answers: formattedAnswers,
          timer: {
            duration: votePhaseDuration,
            startTime: Date.now(),
          },
        })
      }

      // Notification générale pour tous les joueurs
      io.to(`game:${gameId}`).emit('game:update', {
        type: 'phase_change',
        phase: 'vote',
        message: 'Toutes les réponses ont été reçues. Place au vote!',
        targetPlayerId: question.targetPlayerId,
        timer: {
          duration: votePhaseDuration,
          startTime: Date.now(),
        },
      })

      return true
    } catch (error) {
      console.error('❌ Erreur lors du passage à la phase de vote:', error)
      return false
    }
  }

  /**
   * Méthode pour récupérer l'état complet du jeu via WebSocket
   * Cette méthode est appelée par le service socket pour le handler 'game:get_state'
   */
  public async getGameState(gameId: string | number, userId?: string | number) {
    try {
      console.log(
        `🎮 [getGameState] Récupération de l'état du jeu ${gameId} pour l'utilisateur ${userId || 'anonyme'}`
      )

      // Récupérer le jeu
      const game = await Game.find(gameId)
      if (!game) {
        throw new Error('Partie non trouvée')
      }

      // Récupérer la salle et les joueurs
      let room
      let players = []

      try {
        room = await Room.find(game.roomId)
        players = await room.related('players').query()
      } catch (roomError) {
        console.warn(
          `⚠️ [getGameState] Erreur lors de la récupération de la salle: ${roomError.message}`
        )
        // Continuer avec une liste vide si la salle n'existe plus
      }

      // Récupérer la question actuelle
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
        console.error(
          `❌ [getGameState] Erreur lors de la récupération de la question:`,
          questionError
        )
        // Continuer avec currentQuestion = null
      }

      // Récupérer les réponses pour la question actuelle
      let answers = []
      try {
        if (currentQuestion) {
          // Récupérer les réponses avec les utilisateurs qui les ont écrites
          answers = await Answer.query().where('question_id', currentQuestion.id).preload('user')

          // Ajouter un marqueur pour identifier les propres réponses de l'utilisateur
          if (userId) {
            answers = answers.map((answer) => ({
              ...answer.toJSON(),
              isOwnAnswer: answer.userId === Number(userId),
            }))
          }
        }
      } catch (answersError) {
        console.error(
          `❌ [getGameState] Erreur lors de la récupération des réponses:`,
          answersError
        )
        // Continuer avec answers = []
      }

      // Déterminer l'état actuel de l'utilisateur
      let hasAnswered = false
      let hasVoted = false
      let isTargetPlayer = false

      if (userId && currentQuestion) {
        try {
          // Vérifier si l'utilisateur a déjà répondu
          hasAnswered =
            (await Answer.query()
              .where('question_id', currentQuestion.id)
              .where('user_id', userId)
              .first()) !== null

          // Vérifier si l'utilisateur a déjà voté
          hasVoted =
            (await Vote.query()
              .where('question_id', currentQuestion.id)
              .where('voter_id', userId)
              .first()) !== null

          // Vérifier si l'utilisateur est la cible
          isTargetPlayer = currentQuestion.targetPlayerId === Number(userId)

          console.log(
            `👤 [getGameState] État utilisateur ${userId}: isTarget=${isTargetPlayer}, hasAnswered=${hasAnswered}, hasVoted=${hasVoted}`
          )
        } catch (stateError) {
          console.error(
            `❌ [getGameState] Erreur lors de la récupération des états utilisateur:`,
            stateError
          )
          // Garder les valeurs par défaut
        }
      }

      // Calculer la durée restante pour la phase actuelle
      const timer = this.calculateRemainingTime(game.currentPhase)

      // Formater les joueurs pour inclure leurs scores
      const formattedPlayers = players.map((player) => ({
        id: player.id,
        username: player.username,
        displayName: player.displayName,
        avatar: player.avatar,
        score: game.scores?.[player.id] || 0,
        isHost: room ? player.id === room.hostId : false,
      }))

      // Formater les réponses pour l'envoi
      const formattedAnswers = answers.map((answer) => ({
        id: answer.id,
        content: answer.content,
        playerId: answer.userId,
        gameId: game.id, // Ajouter cette propriété utile pour le client
        questionId: answer.questionId,
        playerName: answer.user?.displayName || answer.user?.username || 'Joueur anonyme',
        votesCount: answer.votesCount || 0,
        isOwnAnswer: answer.isOwnAnswer || (userId && answer.userId === Number(userId)),
      }))

      // Construire et retourner l'état complet du jeu
      return {
        game: {
          id: game.id,
          roomId: game.roomId,
          hostId: room?.hostId || null,
          currentRound: game.currentRound,
          totalRounds: game.totalRounds,
          status: game.status,
          gameMode: game.gameMode,
          currentPhase: game.currentPhase,
          scores: game.scores || {},
          createdAt: game.createdAt,
        },
        room: room
          ? {
              id: room.id,
              code: room.code,
              name: room.name,
              hostId: room.hostId,
            }
          : null,
        players: formattedPlayers,
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
        answers: formattedAnswers,
        currentUserState: {
          hasAnswered,
          hasVoted,
          isTargetPlayer,
        },
        timer,
      }
    } catch (error) {
      console.error(`❌ [getGameState] Erreur lors de la récupération de l'état du jeu:`, error)
      throw error
    }
  }

  /**
   * Calcule le temps restant pour la phase actuelle
   */
  private calculateRemainingTime(currentPhase: string) {
    // Durées par défaut pour chaque phase (en secondes)
    const phaseDurations = {
      question: 10,
      answer: 30,
      vote: 20,
      results: 15,
    }

    // Phase actuelle et durée
    const duration = phaseDurations[currentPhase as keyof typeof phaseDurations] || 10

    // Simuler un temps de départ (temps actuel - un délai aléatoire entre 1 et durée)
    const randomElapsed = Math.floor(Math.random() * (duration - 1)) + 1
    const startTime = Date.now() - randomElapsed * 1000

    return {
      duration,
      startTime,
    }
  }
}
