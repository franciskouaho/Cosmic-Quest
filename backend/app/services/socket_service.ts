import env from '#start/env'
import { Server } from 'socket.io'
import type { Server as HttpServer } from 'node:http'

export class SocketService {
  private io: Server | null = null

  init(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket'],
    })

    console.log('⚡ Initialisation du service WebSocket...')

    this.io.on('connection', (socket) => {
      console.log(`🟢 Nouveau client connecté: ${socket.id}`)

      socket.on('disconnect', () => {
        console.log(`🔴 Client déconnecté: ${socket.id}`)
      })

      socket.on('error', (error) => {
        console.error(`🚨 Erreur WebSocket pour ${socket.id}:`, error)
      })
    })

    const port = env.get('WS_PORT')
    console.log(`✅ Serveur WebSocket en écoute sur le port ${port}`)
  }

  getInstance() {
    if (!this.io) {
      throw new Error('Socket.IO non initialisé')
    }
    return this.io
  }
}

export default new SocketService()
