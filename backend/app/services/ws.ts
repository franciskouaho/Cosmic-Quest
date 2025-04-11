import { Server, Socket } from 'socket.io'
import server from '@adonisjs/core/services/server'

class Ws {
  io: Server | undefined
  private booted = false

  boot() {
    /**
     * Ignore multiple calls to the boot method
     */
    if (this.booted) {
      return
    }

    this.booted = true
    this.io = new Server(server.getNodeServer(), {
      cors: {
        origin: '*',
      },
    })

    const appSocketHandler = new AppSocketHandler(this.io)
    appSocketHandler.boot()
  }
}

export class AppSocketHandler {
  constructor(private io: Server) {}

  boot() {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected:', socket.id)

      // Gestion des salles
      socket.on('join:room', (roomCode: string) => {
        socket.join(`room:${roomCode}`)
        console.log(`Client ${socket.id} joined room ${roomCode}`)
      })

      // Gestion des jeux
      socket.on('join:game', (gameId: string) => {
        socket.join(`game:${gameId}`)
        console.log(`Client ${socket.id} joined game ${gameId}`)
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })
  }
}

export default new Ws()
