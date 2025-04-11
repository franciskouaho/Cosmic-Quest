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
        },
        transports: ['websocket', 'polling'],
      })

      console.log('⚡ Initialisation du service WebSocket...')

      this.io.on('connection', (socket) => {
        console.log(`🟢 Nouveau client connecté: ${socket.id}`)

        // Gestion des salles
        socket.on('join:room', (data) => {
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

        socket.on('leave:room', (data) => {
          const roomCode = typeof data === 'object' ? data.roomCode : data
          const roomChannel = `room:${roomCode}`

          socket.leave(roomChannel)
          console.log(`🚪 Client ${socket.id} a quitté la salle ${roomCode}`)
        })

        // Gestion des jeux
        socket.on('join:game', (gameId) => {
          socket.join(`game:${gameId}`)
          console.log(`🎮 Client ${socket.id} a rejoint le jeu ${gameId}`)
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
}

export default new SocketService()
