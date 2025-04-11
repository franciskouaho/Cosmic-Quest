import type { WebSocketContext } from 'adonisjs-websocket'

export default class RoomController {
  public async handle({ ws, params, auth }: WebSocketContext) {
    const roomCode = params.code

    ws.on('message', async (message) => {
      if (message.toString() === 'ping') {
        return ws.send('pong')
      }

      // Broadcast le message à tous les clients dans la même salle
      await ws.broadcast(message.toString())
    })

    ws.on('close', () => {
      console.log(`WebSocket closed for room ${roomCode}`)
    })

    ws.send(JSON.stringify({ type: 'connected', roomCode }))
  }
}
