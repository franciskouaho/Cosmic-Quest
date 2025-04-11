import { DateTime } from 'luxon'
import { HttpContext } from '@adonisjs/core/http'
import { createRoomValidator, readyStatusValidator } from '#validators/room'
import socketService from '#services/socket_service'

import Room from '#models/room'
import Game from '#models/game'
import UserRecentRoom from '#models/user_recent_room'

// Fonction utilitaire pour générer un code de salle aléatoire
const generateRoomCode = (length = 6) => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return code
}

export default class RoomsController {
  /**
   * Liste toutes les salles publiques disponibles
   */
  async index({ response }: HttpContext) {
    try {
      const rooms = await Room.query()
        .where('status', 'waiting')
        .where('is_private', false)
        .preload('host')
        .preload('players')

      return response.ok({
        status: 'success',
        data: rooms.map((room) => ({
          id: room.id,
          code: room.code,
          name: room.name,
          host: {
            id: room.host.id,
            username: room.host.username,
            displayName: room.host.displayName,
          },
          players: room.players.length,
          maxPlayers: room.maxPlayers,
          gameMode: room.gameMode,
          isPrivate: room.is_private,
          createdAt: room.createdAt,
        })),
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des salles:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des salles',
      })
    }
  }

  /**
   * Crée une nouvelle salle
   */
  async create({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()

      // Log les données brutes reçues pour le débogage
      console.log('Données reçues pour création de salle:', request.all())

      // Validation du payload
      const payload = await request.validateUsing(createRoomValidator)
      console.log('Validation réussie, payload:', payload)

      // Normalisation des champs pour supporter les deux formats (snake_case et camelCase)
      const normalizedPayload = {
        name: payload.name,
        is_private: payload.is_private ?? payload.isPrivate ?? false,
        max_players: payload.max_players ?? payload.maxPlayers ?? 6,
        game_mode: payload.game_mode ?? payload.gameMode ?? 'standard',
        total_rounds: payload.total_rounds ?? payload.totalRounds ?? 5,
        settings: payload.settings ?? null,
      }

      console.log('Payload normalisé:', normalizedPayload)

      // Générer un code unique pour la salle
      let isUnique = false
      let code = ''

      while (!isUnique) {
        code = generateRoomCode()
        const existingRoom = await Room.findBy('code', code)
        if (!existingRoom) {
          isUnique = true
        }
      }

      // Créer la salle avec gestion explicite des types
      const room = await Room.create({
        code,
        name: normalizedPayload.name,
        hostId: user.id,
        is_private: !!normalizedPayload.is_private, // Convertir en boolean explicitement
        maxPlayers: Number(normalizedPayload.max_players), // Convertir en number
        gameMode: String(normalizedPayload.game_mode),
        totalRounds: Number(normalizedPayload.total_rounds),
        settings: normalizedPayload.settings,
      })

      // Ajouter l'hôte en tant que joueur dans la salle
      await room.related('players').attach({
        [user.id]: {
          is_ready: true, // L'hôte est toujours prêt par défaut
          joined_at: DateTime.now().toSQL(),
        },
      })

      // Ajouter cette salle aux salles récentes de l'utilisateur
      await UserRecentRoom.create({
        userId: user.id,
        roomId: room.id,
      })

      // Recharger la salle avec les relations
      await room.load('host')
      await room.load('players')

      return response.created({
        status: 'success',
        message: 'Salle créée avec succès',
        data: {
          id: room.id,
          code: room.code,
          name: room.name,
          host: {
            id: room.host.id,
            username: room.host.username,
            displayName: room.host.displayName,
          },
          players: room.players.length,
          maxPlayers: room.maxPlayers,
          gameMode: room.gameMode,
          isPrivate: room.is_private,
          totalRounds: room.totalRounds,
          createdAt: room.createdAt,
        },
      })
    } catch (error) {
      if (error.name === 'ValidationException') {
        console.error('Erreur de validation:', error)
        return response.badRequest({
          error: 'Données de validation invalides',
          details: error.messages || error.message,
        })
      }

      console.error('Erreur détaillée lors de la création de la salle:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la création de la salle',
        message: error.message,
      })
    }
  }

  /**
   * Affiche les détails d'une salle spécifique
   */
  async show({ params, response }: HttpContext) {
    try {
      const room = await Room.query()
        .where('code', params.code)
        .preload('host')
        .preload('players', (query) => {
          query.pivotColumns(['is_ready', 'score'])
        })
        .first()

      if (!room) {
        return response.notFound({
          error: 'Salle non trouvée',
        })
      }

      // S'assurer que players est toujours un tableau, même s'il est vide
      const playersData = room.players
        ? room.players.map((player) => ({
            id: player.id,
            username: player.username,
            displayName: player.displayName,
            avatar: player.avatar,
            level: player.level,
            isHost: player.id === room.hostId,
            isReady: player.$extras.pivot_is_ready,
            score: player.$extras.pivot_score,
          }))
        : []

      return response.ok({
        status: 'success',
        data: {
          id: room.id,
          code: room.code,
          name: room.name,
          host: {
            id: room.host.id,
            username: room.host.username,
            displayName: room.host.displayName,
            avatar: room.host.avatar,
          },
          status: room.status,
          isPrivate: room.is_private,
          maxPlayers: room.maxPlayers,
          gameMode: room.gameMode,
          totalRounds: room.totalRounds,
          settings: room.settings,
          players: playersData, // Toujours un tableau
          createdAt: room.createdAt,
          startedAt: room.startedAt,
        },
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des détails de la salle:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des détails de la salle',
      })
    }
  }

  /**
   * Rejoindre une salle existante
   */
  async join({ request, response, auth, params }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const roomCode = params.code

      console.log(`Tentative de rejoindre la salle avec le code: ${roomCode}`)

      const room = await Room.findBy('code', roomCode)
      if (!room) {
        return response.notFound({ error: 'Salle non trouvée' })
      }

      // Vérifier si l'utilisateur est déjà dans la salle
      const isAlreadyInRoom = await room
        .related('players')
        .query()
        .where('user_id', user.id)
        .first()

      if (isAlreadyInRoom) {
        console.log(
          `L'utilisateur ${user.username} (ID: ${user.id}) est déjà dans la salle ${roomCode}`
        )
        return response.ok({
          status: 'success',
          message: 'Vous êtes déjà dans cette salle',
          data: { alreadyJoined: true },
        })
      }

      // Ajouter le joueur à la salle avec la date de jointure
      await room.related('players').attach({
        [user.id]: {
          is_ready: false, // Par défaut, le joueur qui rejoint n'est pas prêt
          joined_at: DateTime.now().toSQL(),
        },
      })

      // Notifier les autres joueurs via Socket.IO
      const io = socketService.getInstance()
      io.to(`room:${roomCode}`).emit('room:update', {
        type: 'player_joined',
        player: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        },
      })

      return response.ok({
        status: 'success',
        message: 'Vous avez rejoint la salle avec succès',
      })
    } catch (error) {
      console.error('Erreur lors de la tentative de rejoindre la salle:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la tentative de rejoindre la salle',
      })
    }
  }

  /**
   * Quitter une salle
   */
  async leave({ response, auth, params }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const roomCode = params.code

      console.log(`Tentative de quitter la salle avec le code: ${roomCode}`)

      const room = await Room.findBy('code', roomCode)
      if (!room) {
        return response.notFound({ error: 'Salle non trouvée' })
      }

      // Retirer le joueur de la salle
      await room.related('players').detach([user.id])

      // Notifier les autres joueurs via Socket.IO
      const io = socketService.getInstance()
      io.to(`room:${roomCode}`).emit('room:update', {
        type: 'player_left',
        playerId: user.id,
      })

      return response.ok({
        status: 'success',
        message: 'Vous avez quitté la salle avec succès',
      })
    } catch (error) {
      console.error('Erreur lors de la tentative de quitter la salle:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la tentative de quitter la salle',
      })
    }
  }

  /**
   * Activer/désactiver le statut "prêt" d'un joueur
   */
  async toggleReady({ request, response, auth, params }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const payload = await request.validateUsing(readyStatusValidator)

      // Trouver la salle par son code
      const room = await Room.findBy('code', params.code)
      if (!room) {
        return response.notFound({
          error: 'Salle non trouvée',
        })
      }

      // Vérifier si le joueur est dans la salle
      const isPlayerInRoom = await room.related('players').query().where('user_id', user.id).first()
      if (!isPlayerInRoom) {
        return response.badRequest({
          error: "Vous n'êtes pas dans cette salle",
        })
      }

      // Si l'utilisateur est l'hôte, il ne peut pas changer son statut
      if (room.hostId === user.id) {
        return response.badRequest({
          error: "L'hôte est toujours considéré comme prêt",
        })
      }

      // Mettre à jour le statut du joueur
      await room.related('players').sync(
        {
          [user.id]: {
            is_ready: payload.is_ready,
          },
        },
        false
      ) // false = ne pas détacher les autres relations

      // Remplacer transmit.emit par socketService
      const io = socketService.getInstance()
      io.to(`room:${room.code}`).emit('room:update', {
        type: 'player_ready_status',
        playerId: user.id,
        isReady: payload.is_ready,
      })

      return response.ok({
        status: 'success',
        message: `Statut mis à jour: ${payload.is_ready ? 'Prêt' : 'En attente'}`,
        data: {
          isReady: payload.is_ready,
        },
      })
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la mise à jour du statut',
      })
    }
  }

  /**
   * Démarrer la partie
   */
  async startGame({ response, auth, params }: HttpContext) {
    try {
      const user = await auth.authenticate()

      // Trouver la salle par son code
      const room = await Room.findBy('code', params.code)
      if (!room) {
        return response.notFound({
          error: 'Salle non trouvée',
        })
      }

      // Vérifier que l'utilisateur est bien l'hôte de la salle
      if (room.hostId !== user.id) {
        return response.forbidden({
          error: "Seul l'hôte peut démarrer la partie",
        })
      }

      // Vérifier que tous les joueurs sont prêts (sauf l'hôte qui est toujours prêt)
      const notReadyPlayers = await room
        .related('players')
        .query()
        .where('user_id', '!=', user.id)
        .wherePivot('is_ready', false)
        .count('* as count')

      const notReadyCount = notReadyPlayers[0].$extras.count

      if (notReadyCount > 0) {
        return response.badRequest({
          error: 'Tous les joueurs ne sont pas prêts',
        })
      }

      // Vérifier qu'il y a au moins 2 joueurs
      const playersCount = await room.related('players').query().count('* as count')
      const count = playersCount[0].$extras.count

      if (count < 2) {
        return response.badRequest({
          error: 'Il faut au moins 2 joueurs pour commencer une partie',
        })
      }

      // Mettre à jour le statut de la salle
      room.status = 'playing'
      room.startedAt = DateTime.now()
      await room.save()

      // Créer une nouvelle partie
      const game = await Game.create({
        roomId: room.id,
        currentRound: 1,
        totalRounds: room.totalRounds,
        status: 'in_progress',
        gameMode: room.gameMode,
        currentPhase: 'question',
      })

      // Charger les joueurs pour initialiser les scores
      const players = await room.related('players').query()
      const scores = {}

      // Initialiser les scores à 0 pour tous les joueurs
      players.forEach((player) => {
        scores[player.id] = 0
      })

      // Mettre à jour les scores dans le jeu
      game.scores = scores
      await game.save()

      // NOUVEAU CODE: Générer la première question
      try {
        // Sélectionner un joueur cible aléatoire
        const randomIndex = Math.floor(Math.random() * players.length)
        const targetPlayer = players[randomIndex]

        // Mettre à jour le joueur cible dans le jeu
        game.currentTargetPlayerId = targetPlayer.id
        await game.save()

        // Récupérer une question depuis la base de données
        const questionService = (await import('#services/question_service')).default
        const questionFromDB = await questionService.getRandomQuestionByTheme(game.gameMode)

        // En cas d'échec, générer une question de secours
        let questionText = ''
        if (questionFromDB) {
          questionText = questionService.formatQuestion(
            questionFromDB.text,
            targetPlayer.displayName || targetPlayer.username
          )
        } else {
          // Fallback question
          const GamesController = (await import('#controllers/ws/game_controller')).default
          const gameController = new GamesController()

          // Utiliser la méthode generateFallbackQuestion via une méthode publique temporaire
          questionText = gameController.generateQuestion(
            game.gameMode,
            targetPlayer.displayName || targetPlayer.username
          )
        }

        // Créer la question
        const Question = (await import('#models/question')).default
        const question = await Question.create({
          text: questionText,
          theme: game.gameMode,
          gameId: game.id,
          roundNumber: 1,
          targetPlayerId: targetPlayer.id,
        })

        console.log(
          `✅ Première question générée pour le jeu ${game.id} avec le joueur cible ${targetPlayer.id}`
        )

        // Définir les durées pour chaque phase
        const questionPhaseDuration = 15 // 15 secondes pour la phase question (augmenté de 10 à 15)
        const io = socketService.getInstance()

        // Notifier les clients du début de la phase question avec le compteur
        io.to(`game:${game.id}`).emit('game:update', {
          type: 'new_round',
          round: 1,
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

        // Passer à la phase de réponse après un délai
        setTimeout(async () => {
          game.currentPhase = 'answer'
          await game.save()

          // Définir la durée pour la phase réponse
          const answerPhaseDuration = 45 // 45 secondes pour répondre (augmenté de 30 à 45)

          // Notifier les joueurs du changement de phase avec le compteur
          io.to(`game:${game.id}`).emit('game:update', {
            type: 'phase_change',
            phase: 'answer',
            timer: {
              duration: answerPhaseDuration,
              startTime: Date.now(),
            },
          })

          console.log(`✅ Passage à la phase 'answer' pour le jeu ${game.id}`)
        }, questionPhaseDuration * 1000) // Convertir en millisecondes
      } catch (questionError) {
        console.error('❌ Erreur lors de la génération de la première question:', questionError)
      }

      // Remplacer transmit.emit par socketService pour notifier du début de la partie
      const io = socketService.getInstance()
      io.to(`room:${room.code}`).emit('room:update', {
        type: 'game_started',
        gameId: game.id,
      })

      return response.ok({
        status: 'success',
        message: 'La partie a démarré',
        data: {
          gameId: game.id,
        },
      })
    } catch (error) {
      console.error('Erreur lors du démarrage de la partie:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors du démarrage de la partie',
      })
    }
  }
}
