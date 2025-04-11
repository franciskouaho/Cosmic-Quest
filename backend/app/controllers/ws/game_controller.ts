import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { answerValidator, voteValidator } from '#validators/game'
import socketService from '#services/socket_service'
import questionService from '#services/question_service'

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
   * Afficher les détails d'une partie en cours
   */
  async show({ params, response, auth }: HttpContext) {
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
        // Récupérer les réponses avec les utilisateurs qui les ont écrites
        answers = await Answer.query().where('question_id', currentQuestion.id).preload('user')

        // Ajouter un marqueur pour identifier les propres réponses de l'utilisateur
        answers = answers.map((answer) => ({
          ...answer.toJSON(),
          isOwnAnswer: answer.userId === user.id,
        }))
      }

      // Récupérer les votes
      let votes = []
      if (currentQuestion) {
        votes = await Vote.query()
          .where('question_id', currentQuestion.id)
          .preload('voter')
          .preload('answer')
      }

      // Déterminer si l'utilisateur actuel a déjà répondu
      const hasAnswered = currentQuestion
        ? (await Answer.query()
            .where('question_id', currentQuestion.id)
            .where('user_id', user.id)
            .first()) !== null
        : false

      // Déterminer si l'utilisateur actuel a déjà voté
      const hasVoted = currentQuestion
        ? (await Vote.query()
            .where('question_id', currentQuestion.id)
            .where('voter_id', user.id)
            .first()) !== null
        : false

      // Déterminer si c'est au tour de l'utilisateur actuel
      const isTargetPlayer = currentQuestion && currentQuestion.targetPlayerId === user.id

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
            scores: game.scores,
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
            score: game.scores[player.id] || 0,
            isHost: player.id === game.room.hostId,
          })),
          currentQuestion: currentQuestion
            ? {
                id: currentQuestion.id,
                text: currentQuestion.text,
                roundNumber: currentQuestion.roundNumber,
                targetPlayer: {
                  id: currentQuestion.targetPlayer.id,
                  username: currentQuestion.targetPlayer.username,
                  displayName: currentQuestion.targetPlayer.displayName,
                  avatar: currentQuestion.targetPlayer.avatar,
                },
              }
            : null,
          answers: answers.map((answer) => ({
            id: answer.id,
            content: answer.content,
            playerId: answer.userId,
            playerName: answer.user.displayName || answer.user.username,
            votesCount: answer.votesCount,
            isOwnAnswer: answer.isOwnAnswer || answer.userId === user.id, // S'assurer que cette propriété est toujours présente
          })),
          currentUserState: {
            hasAnswered,
            hasVoted,
            isTargetPlayer,
          },
        },
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des détails de la partie:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des détails de la partie',
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
        const answersCount = await Answer.query()
          .where('question_id', question.id)
          .count('* as count')
        const count = Number.parseInt(answersCount[0].$extras.count || '0', 10)

        // Trouver combien de joueurs peuvent répondre (tous sauf la cible)
        const nonTargetPlayers = players.filter(
          (player) => player.id !== question.targetPlayerId
        ).length

        console.log(
          `🎮 [submitAnswer] Réponses: ${count}/${nonTargetPlayers} (total joueurs minus cible)`
        )

        // Correction pour les parties à 2 joueurs:
        // Si nous avons 2 joueurs (ou moins) et au moins une réponse, passer à la phase vote
        const isSmallGame = totalPlayers <= 2

        // Si tous les joueurs qui peuvent répondre ont répondu OU si c'est une petite partie avec au moins une réponse
        if (count >= nonTargetPlayers || (isSmallGame && count > 0)) {
          console.log(
            `🎮 [submitAnswer] Condition pour passage à la phase vote satisfaite - Game: ${gameId}, Joueurs: ${totalPlayers}, Réponses: ${count}`
          )

          // Passer à la phase de vote même si le jeu n'est pas en phase answer
          // Cela permet de récupérer des parties bloquées
          game.currentPhase = 'vote'
          await game.save()

          console.log(`✅ [submitAnswer] Phase changée à 'vote' - Game: ${gameId}`)

          // Récupérer toutes les réponses pour les envoyer aux clients
          const allAnswers = await Answer.query()
            .where('question_id', question.id)
            .preload('user')
            .orderBy('created_at', 'asc')

          const formattedAnswers = allAnswers.map((answer) => ({
            id: answer.id,
            content: answer.content,
            playerId: answer.userId,
            playerName: answer.user.displayName || answer.user.username,
            votesCount: 0,
            isOwnAnswer: false, // Sera déterminé côté client
          }))

          // Timer pour la phase de vote
          const votePhaseDuration = 20 // 20 secondes pour voter

          // Notifier immédiatement du changement de phase
          io.to(`game:${gameId}`).emit('game:update', {
            type: 'phase_change',
            phase: 'vote',
            message: 'Toutes les réponses ont été reçues. Place au vote!',
            answers: formattedAnswers,
            timer: {
              duration: votePhaseDuration,
              startTime: Date.now(),
            },
          })

          // Envoyer un rappel après 2 secondes pour s'assurer que tous les clients sont à jour
          setTimeout(() => {
            io.to(`game:${gameId}`).emit('game:update', {
              type: 'phase_reminder',
              phase: 'vote',
              message: 'Phase de vote en cours - votez pour votre réponse préférée!',
            })
          }, 2000)

          // Cas spécial: parties à 2 joueurs
          if (isSmallGame) {
            console.log(
              `🎮 [submitAnswer] Partie à ${totalPlayers} joueurs détectée, traitement spécial`
            )

            // Dans une partie à 2 joueurs, la personne qui n'est pas la cible a répondu
            // et la cible doit voter pour la réponse, mais ne peut pas voter pour sa propre réponse
            // Si le joueur cible est la seule personne qui reste, on passe directement aux résultats

            // En mode 2 joueurs, nous savons qu'il n'y a qu'un seul joueur qui peut voter (la cible)
            // On attend un peu pour laisser le temps aux clients de s'adapter
            setTimeout(async () => {
              // Vérifier l'état actuel du jeu
              const currentGame = await Game.find(gameId)
              if (currentGame && currentGame.currentPhase === 'vote') {
                // Dans une partie à 2, on peut directement passer aux résultats après un délai
                // pour permettre à la cible de voir la réponse

                // Vérifier si des votes existent déjà
                const votesExist = await Vote.query().where('question_id', question.id).first()

                if (!votesExist) {
                  console.log(
                    `🎮 [submitAnswer] Passage automatique aux résultats dans 10s pour partie à ${totalPlayers} joueurs`
                  )

                  // Après 10 secondes, si aucun vote n'a été enregistré, passer directement aux résultats
                  setTimeout(async () => {
                    const freshGame = await Game.find(gameId)
                    if (freshGame && freshGame.currentPhase === 'vote') {
                      freshGame.currentPhase = 'results'
                      await freshGame.save()

                      io.to(`game:${gameId}`).emit('game:update', {
                        type: 'phase_change',
                        phase: 'results',
                        scores: freshGame.scores,
                        timer: {
                          duration: 15, // 15 secondes pour voir les résultats
                          startTime: Date.now(),
                        },
                        message: 'Affichage des résultats',
                      })

                      console.log(
                        `✅ [submitAnswer] Passage automatique aux résultats effectué - Game: ${gameId}`
                      )
                    }
                  }, 10000) // 10 secondes après la mise en place de la phase vote
                }
              }
            }, 2000)
          }
        }
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
   * Passer au tour suivant ou terminer la partie
   */
  async nextRound({ response, auth, params }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const gameId = params.id

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

      // Assouplir la vérification de phase pour permettre plus de flexibilité
      // Permettre le passage au tour suivant depuis les phases 'results' ou 'vote'
      const validPhases = ['results', 'vote']
      if (!validPhases.includes(game.currentPhase)) {
        console.error(
          `❌ [nextRound] Phase incorrecte: ${game.currentPhase}, attendu une des phases: ${validPhases.join(', ')}`
        )
        return response.badRequest({
          error:
            "Ce n'est pas le moment de passer au tour suivant. La phase actuelle doit être 'résultats' ou 'vote'.",
          phase: game.currentPhase,
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

        return response.ok({
          status: 'success',
          message: 'La partie est terminée',
          data: {
            finalScores: game.scores,
          },
        })
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
          questionText = questionService.formatQuestion(
            questionFromDB.text,
            targetPlayer.displayName || targetPlayer.username
          )
        } else {
          // Utiliser la méthode de secours si aucune question n'est disponible dans la DB
          questionText = this.generateFallbackQuestion(
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

        return response.ok({
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
        })
      }
    } catch (error) {
      console.error('❌ [nextRound] Erreur non gérée lors du passage au tour suivant:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors du passage au tour suivant',
        details: error.message || 'Erreur inconnue',
      })
    }
  }

  /**
   * Méthode publique pour générer une question qui peut être utilisée par d'autres contrôleurs
   */
  public generateQuestion(theme: string, playerName: string): string {
    return this.generateFallbackQuestion(theme, playerName)
  }

  /**
   * Méthode de secours pour générer une question si la base de données échoue
   */
  private generateFallbackQuestion(theme: string, playerName: string): string {
    // Banque de questions par thème (version simplifiée)
    const questionsByTheme = {
      'standard': [
        `${playerName} participe à un jeu télévisé. Quelle serait sa phrase d'accroche ?`,
        `Si ${playerName} était un super-héros, quel serait son pouvoir ?`,
        `Quel emoji représente le mieux ${playerName} ?`,
      ],
      'fun': [
        `Si ${playerName} pouvait fusionner avec un objet du quotidien, lequel choisirait-il ?`,
        `Si ${playerName} était un mème internet, lequel serait-il ?`,
        `Quel talent caché pourrait avoir ${playerName} ?`,
      ],
      'dark': [
        `Quel serait le plan machiavélique de ${playerName} pour dominer le monde ?`,
        `Si ${playerName} était un méchant de film, quelle serait sa phrase culte ?`,
        `Quel est le plus grand secret que ${playerName} pourrait cacher ?`,
      ],
      'personal': [
        `Quelle habitude agaçante ${playerName} a-t-il probablement ?`,
        `Quel serait le pire cadeau à offrir à ${playerName} ?`,
        `Si la vie de ${playerName} était une série TV, quel en serait le titre ?`,
      ],
      'crazy': [
        `Si ${playerName} pouvait fusionner avec un objet du quotidien, lequel choisirait-il ?`,
        `Quelle capacité absurde ${playerName} aimerait développer ?`,
        `Si ${playerName} était une créature mythologique, laquelle serait-il et pourquoi ?`,
      ],
      'on-ecoute-mais-on-ne-juge-pas': [
        `Si ${playerName} devait confesser un péché mignon, lequel serait-ce ?`,
        `Quelle est la pire habitude de ${playerName} qu'il/elle n'admettra jamais publiquement ?`,
        `Quel secret ${playerName} serait-il/elle prêt(e) à partager uniquement dans cette pièce ?`,
      ],
    }

    // Sélectionner un thème par défaut si le thème fourni n'existe pas
    const questions = questionsByTheme[theme] || questionsByTheme.standard

    // Retourner une question aléatoire du thème
    return questions[Math.floor(Math.random() * questions.length)]
  }

  /**
   * Méthode privée pour calculer et mettre à jour les scores
   */
  private async calculateAndUpdateScores(questionId: number, game: Game) {
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
}
