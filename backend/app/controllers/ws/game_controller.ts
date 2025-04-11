import type { WebSocketContext } from 'adonisjs-websocket'

export default class GameController {
  public async handle({ ws, params, auth }: WebSocketContext) {
    const gameId = params.id

    ws.on('message', async (message) => {
      if (message.toString() === 'ping') {
        return ws.send('pong')
      }

      // Broadcast le message à tous les clients dans le même jeu
      await ws.broadcast(message.toString())
    })

    ws.on('close', () => {
      console.log(`WebSocket closed for game ${gameId}`)
    })

    ws.send(JSON.stringify({ type: 'connected', gameId }))
  }
}
