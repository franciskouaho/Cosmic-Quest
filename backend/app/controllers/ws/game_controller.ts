import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { answerValidator, voteValidator } from '#validators/game'
import socketService from '#services/socket_service'

import Game from '#models/game'
import Question from '#models/question'
import Answer from '#models/answer'
import Vote from '#models/vote'
import Room from '#models/room'

// Générer une question basée sur le thème et le nom du joueur cible
const generateQuestion = (theme: string, playerName: string) => {
  // Banque de questions par thème
  const questionsByTheme = {
    standard: [
      `${playerName} participe à un jeu télévisé. Quelle serait sa phrase d'accroche ?`,
      `Si ${playerName} était un super-héros, quel serait son pouvoir ?`,
      `Quelle émission de télé-réalité conviendrait parfaitement à ${playerName} ?`,
      `Quel emoji représente le mieux ${playerName} ?`,
      `Si ${playerName} écrivait une autobiographie, quel en serait le titre ?`,
      `Quel animal de compagnie conviendrait parfaitement à ${playerName} ?`,
    ],
    crazy: [
      `Si ${playerName} pouvait fusionner avec un objet du quotidien, lequel choisirait-il ?`,
      `Quelle capacité absurde ${playerName} aimerait développer ?`,
      `Si ${playerName} était un sandwich, quels ingrédients le composeraient ?`,
      `Quel serait le slogan publicitaire de ${playerName} s'il vendait des objets inutiles ?`,
      `Dans une dimension parallèle, quelle est la profession improbable de ${playerName} ?`,
      `Si les pensées de ${playerName} étaient diffusées à la radio, quel serait le nom de l'émission ?`,
    ],
    fun: [
      `Quel serait le titre du film biographique de ${playerName} ?`,
      `Si ${playerName} était un plat de restaurant, comment serait-il décrit sur le menu ?`,
      `Quelle serait la chanson thème de ${playerName} ?`,
      `Si ${playerName} était une attraction de parc d'attractions, comment s'appellerait-elle ?`,
      `Si ${playerName} était invité dans une émission de télé-réalité, laquelle serait-ce et pourquoi ?`,
      `Quel hashtag représente parfaitement ${playerName} ?`,
    ],
    dark: [
      `Quelle est la peur la plus étrange que ${playerName} pourrait avoir ?`,
      `Si ${playerName} était un personnage de film d'horreur, comment mourrait-il ?`,
      `Quel serait le péché mignon embarrassant de ${playerName} ?`,
      `Si ${playerName} était un dictateur, quelle serait sa règle la plus bizarre ?`,
      `Quelle serait la pire combinaison de vêtements que ${playerName} pourrait porter ?`,
      `Quel secret ${playerName} cache-t-il à tout le monde ?`,
    ],
    personal: [
      `Qu'est-ce que ${playerName} fait probablement quand personne ne regarde ?`,
      `Quel est le talent caché de ${playerName} ?`,
      `Si vous deviez être coincé sur une île déserte avec ${playerName}, quelle serait la chose la plus ennuyeuse à son sujet ?`,
      `Quel est le rêve le plus fou de ${playerName} ?`,
      `Si vous pouviez échanger une qualité avec ${playerName}, laquelle choisiriez-vous ?`,
      `Comment ${playerName} réagirait-il face à une célébrité qu'il admire ?`,
    ],
  }

  // Sélectionner un thème par défaut si le thème fourni n'existe pas
  const questions = questionsByTheme[theme] || questionsByTheme.standard

  // Retourner une question aléatoire du thème
  return questions[Math.floor(Math.random() * questions.length)]
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
        answers = await Answer.query().where('question_id', currentQuestion.id).preload('user')
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
      const payload = await request.validateUsing(answerValidator)

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

      // Vérifier que la phase actuelle est bien la phase de réponse
      if (game.currentPhase !== 'answer') {
        return response.badRequest({
          error: "Ce n'est pas le moment de répondre",
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

      // Vérifier que l'utilisateur n'est pas la cible de la question (il ne peut pas répondre à sa propre question)
      if (question.targetPlayerId === user.id) {
        return response.badRequest({
          error: 'Vous ne pouvez pas répondre à votre propre question',
        })
      }

      // Vérifier que l'utilisateur n'a pas déjà répondu
      const existingAnswer = await Answer.query()
        .where('question_id', question.id)
        .where('user_id', user.id)
        .first()

      if (existingAnswer) {
        return response.conflict({
          error: 'Vous avez déjà répondu à cette question',
        })
      }

      // Créer la réponse
      const answer = await Answer.create({
        questionId: question.id,
        userId: user.id,
        content: payload.content,
        votesCount: 0,
        isSelected: false,
      })

      // Récupérer la salle pour les événements WebSocket
      const room = await Room.find(game.roomId)

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

      // Vérifier si tous les joueurs (sauf la cible) ont répondu
      const players = await room.related('players').query()
      const totalPlayers = players.length

      const answersCount = await Answer.query()
        .where('question_id', question.id)
        .count('* as count')

      const count = Number.parseInt(answersCount[0].$extras.count, 10)

      // Tous les joueurs ont répondu sauf la cible (-1)
      if (count >= totalPlayers - 1) {
        // Passer à la phase de vote
        game.currentPhase = 'vote'
        await game.save()

        io.to(`game:${gameId}`).emit('game:update', {
          type: 'phase_change',
          phase: 'vote',
        })
      }

      return response.created({
        status: 'success',
        message: 'Réponse soumise avec succès',
        data: {
          answerId: answer.id,
        },
      })
    } catch (error) {
      console.error('Erreur lors de la soumission de la réponse:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la soumission de la réponse',
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
      if (game.currentPhase !== 'vote') {
        return response.badRequest({
          error: "Ce n'est pas le moment de voter",
        })
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

      const votesCount = await Vote.query().where('question_id', question.id).count('* as count')

      const count = Number.parseInt(votesCount[0].$extras.count, 10)

      // Tous les joueurs (sauf ceux qui n'ont pas répondu) ont voté
      // Typiquement, cela signifie que tous les joueurs qui ne sont pas la cible ont voté
      if (count >= players.length - 1) {
        // Passer à la phase de résultats
        game.currentPhase = 'results'
        await game.save()

        // Calculer les points et mettre à jour les scores
        await this.calculateAndUpdateScores(question.id, game)

        // Notifier tous les joueurs du changement de phase
        io.to(`game:${gameId}`).emit('game:update', {
          type: 'phase_change',
          phase: 'results',
          scores: game.scores,
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

      // Vérifier que la phase actuelle est bien la phase de résultats
      if (game.currentPhase !== 'results') {
        return response.badRequest({
          error: "Ce n'est pas le moment de passer au tour suivant",
        })
      }

      // Récupérer la salle pour vérifier que l'utilisateur est l'hôte
      const room = await Room.find(game.roomId)
      if (room.hostId !== user.id) {
        return response.forbidden({
          error: "Seul l'hôte peut passer au tour suivant",
        })
      }

      const io = socketService.getInstance()

      // Vérifier si c'est le dernier tour
      if (game.currentRound >= game.totalRounds) {
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
        // Passer au tour suivant
        game.currentRound += 1
        game.currentPhase = 'question'

        // Sélectionner un nouveau joueur cible au hasard
        const targetPlayer = await selectRandomTargetPlayer(gameId, game.currentTargetPlayerId)

        // Mettre à jour le joueur cible actuel
        game.currentTargetPlayerId = targetPlayer.id
        await game.save()

        // Générer une nouvelle question
        const questionText = generateQuestion(
          game.gameMode,
          targetPlayer.displayName || targetPlayer.username
        )

        // Créer la nouvelle question
        const question = await Question.create({
          text: questionText,
          theme: game.gameMode,
          gameId: game.id,
          roundNumber: game.currentRound,
          targetPlayerId: targetPlayer.id,
        })

        // Notifier tous les joueurs du nouveau tour
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
        })

        // Après un délai, passer à la phase de réponse
        setTimeout(async () => {
          game.currentPhase = 'answer'
          await game.save()

          io.to(`game:${gameId}`).emit('game:update', {
            type: 'phase_change',
            phase: 'answer',
          })
        }, 10000) // 10 secondes pour voir la question

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
      console.error('Erreur lors du passage au tour suivant:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors du passage au tour suivant',
      })
    }
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
      // Incrémenter le nombre de parties jouées
      player.gamesPlayed += 1

      // Si le joueur est le gagnant, incrémenter le nombre de victoires
      if (player.id === winnerId) {
        player.gamesWon += 1

        // Ajouter des points d'expérience pour la victoire
        player.experiencePoints += 50
      } else {
        // Ajouter des points d'expérience pour la participation
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
