import env from '#start/env'
import { Server } from 'socket.io'
import type { Server as HttpServer } from 'node:http'

export class SocketService {
  private io: Server | null = null

  init(httpServer: HttpServer) {
    if (this.io) {
      console.log('⚠️ Socket.IO déjà initialisé. Ignorer la réinitialisation.')
      return this.io
    }

    try {
      this.io = new Server(httpServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 20000,
        pingInterval: 25000,
        connectTimeout: 30000,
        maxHttpBufferSize: 1e8, // 100 MB
      })

      console.log('⚡ Initialisation du service WebSocket...')

      this.io.use((socket, next) => {
        try {
          const token = socket.handshake.auth?.token
          console.log(`🔐 Nouvelle connexion WebSocket - Token présent: ${!!token}`)

          // Vous pouvez vérifier le token ici si nécessaire
          // Pour l'instant on accepte toutes les connexions
          next()
        } catch (error) {
          console.error("❌ Erreur d'authentification WebSocket:", error)
          next(new Error("Erreur d'authentification"))
        }
      })

      this.io.on('connection', (socket) => {
        console.log(`🟢 Nouveau client connecté: ${socket.id}`)

        // Envoyer un événement de confirmation pour tester la connexion
        socket.emit('connection:success', { message: 'Connexion WebSocket établie avec succès' })

        // Gestion des salles
        socket.on('join-room', (data) => {
          try {
            const roomCode = typeof data === 'object' ? data.roomCode : data
            const roomChannel = `room:${roomCode}`

            socket.join(roomChannel)
            console.log(`🚪 Client ${socket.id} a rejoint la salle ${roomCode}`)

            // Confirmer au client qu'il a bien rejoint la salle
            socket.emit('room:joined', { roomCode })
          } catch (error) {
            console.error(`❌ Erreur lors de la jointure à la salle:`, error)
            socket.emit('error', { message: 'Erreur lors de la jointure à la salle' })
          }
        })

        socket.on('leave-room', (data) => {
          try {
            const roomCode = typeof data === 'object' ? data.roomCode : data
            const roomChannel = `room:${roomCode}`

            socket.leave(roomChannel)
            console.log(`🚪 Client ${socket.id} a quitté la salle ${roomCode}`)

            // Confirmer au client qu'il a bien quitté la salle
            socket.emit('room:left', { roomCode })
          } catch (error) {
            console.error(`❌ Erreur lors du départ de la salle:`, error)
            socket.emit('error', { message: 'Erreur lors du départ de la salle' })
          }
        })

        // Gestion des jeux
        socket.on('join-game', (data) => {
          try {
            const gameId = typeof data === 'object' ? data.gameId : data
            const gameChannel = `game:${gameId}`

            socket.join(gameChannel)
            console.log(`🎮 Client ${socket.id} a rejoint le jeu ${gameId}`)

            // Confirmer au client qu'il a bien rejoint le jeu
            socket.emit('game:joined', { gameId })
          } catch (error) {
            console.error(`❌ Erreur lors de la jointure au jeu:`, error)
            socket.emit('error', { message: 'Erreur lors de la jointure au jeu' })
          }
        })

        socket.on('leave-game', (data) => {
          try {
            const gameId = typeof data === 'object' ? data.gameId : data
            const gameChannel = `game:${gameId}`

            socket.leave(gameChannel)
            console.log(`🎮 Client ${socket.id} a quitté le jeu ${gameId}`)

            // Confirmer au client qu'il a bien quitté le jeu
            socket.emit('game:left', { gameId })
          } catch (error) {
            console.error(`❌ Erreur lors du départ du jeu:`, error)
            socket.emit('error', { message: 'Erreur lors du départ du jeu' })
          }
        })

        // Nouveau gestionnaire pour forcer la vérification de phase
        socket.on('game:force_check', async (data) => {
          try {
            const gameId = data.gameId
            console.log(`🔄 [WebSocket] Demande de vérification forcée pour le jeu ${gameId}`)

            // Importer le contrôleur de jeu de manière dynamique
            const GameController = (await import('#controllers/ws/game_controller')).default
            const controller = new GameController()

            // Récupérer les données nécessaires
            const game = await Game.find(gameId)
            if (!game) {
              console.error(`❌ [WebSocket] Jeu non trouvé: ${gameId}`)
              return
            }

            // Récupérer la question actuelle
            const question = await Question.query()
              .where('game_id', gameId)
              .where('round_number', game.currentRound)
              .first()

            if (!question) {
              console.error(`❌ [WebSocket] Question non trouvée pour le jeu ${gameId}`)
              return
            }

            // Utiliser la méthode du contrôleur pour vérifier et faire progresser la phase
            const success = await controller.checkAndProgressPhase(gameId, question.id)

            console.log(
              `${success ? '✅' : 'ℹ️'} [WebSocket] Vérification forcée ${success ? 'a mis à jour' : "n'a pas modifié"} la phase`
            )
          } catch (error) {
            console.error('❌ [WebSocket] Erreur lors de la vérification forcée:', error)
          }
        })

        // Événement pour tester la connexion
        socket.on('ping', (callback) => {
          if (typeof callback === 'function') {
            callback({ status: 'success', time: new Date().toISOString() })
          } else {
            socket.emit('pong', { status: 'success', time: new Date().toISOString() })
          }
        })

        socket.on('disconnect', () => {
          console.log(`🔴 Client déconnecté: ${socket.id}`)
        })

        socket.on('error', (error) => {
          console.error(`🚨 Erreur WebSocket pour ${socket.id}:`, error)
        })
      })

      const port = env.get('PORT')
      console.log(`✅ Serveur WebSocket en écoute sur le port ${port}`)

      return this.io
    } catch (error) {
      console.error("❌ Erreur lors de l'initialisation du serveur WebSocket:", error)
      throw error
    }
  }

  getInstance() {
    if (!this.io) {
      throw new Error('Socket.IO non initialisé')
    }
    return this.io
  }

  // Méthode pour diffuser un message à tous les clients
  broadcast(event: string, data: any) {
    if (!this.io) {
      console.error('❌ Socket.IO non initialisé, impossible de diffuser le message')
      return
    }

    this.io.emit(event, data)
    console.log(`📢 Message diffusé sur l'événement "${event}"`)
  }

  // Méthode pour diffuser un message à une salle spécifique
  broadcastToRoom(roomCode: string, event: string, data: any) {
    if (!this.io) {
      console.error('❌ Socket.IO non initialisé, impossible de diffuser le message')
      return
    }

    this.io.to(`room:${roomCode}`).emit(event, data)
    console.log(`📢 Message diffusé à la salle "${roomCode}" sur l'événement "${event}"`)
  }

  // Méthode pour diffuser un message à un jeu spécifique
  broadcastToGame(gameId: string, event: string, data: any) {
    if (!this.io) {
      console.error('❌ Socket.IO non initialisé, impossible de diffuser le message')
      return
    }

    this.io.to(`game:${gameId}`).emit(event, data)
    console.log(`📢 Message diffusé au jeu "${gameId}" sur l'événement "${event}"`)
  }
}

export default new SocketService()
