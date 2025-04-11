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
  async join({ request, response, auth }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const { roomCode } = request.params()

      const room = await Room.findBy('code', roomCode)
      if (!room) {
        return response.notFound({ error: 'Salle non trouvée' })
      }

      // Ajouter le joueur à la salle
      await room.related('players').attach([user.id])

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
      const { roomCode } = params

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
