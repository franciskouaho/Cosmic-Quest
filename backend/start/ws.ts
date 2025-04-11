import app from '@adonisjs/core/services/app'
import { Server } from 'socket.io'
import server from '@adonisjs/core/services/server'
import { AppSocketHandler } from '#services/ws'

app.ready(() => {
  const io = new Server(server.getNodeServer(), {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  // Initialiser le gestionnaire de socket
  const socketHandler = new AppSocketHandler(io)
  socketHandler.boot()
})
