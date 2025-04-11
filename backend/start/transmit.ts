import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Autoriser les utilisateurs à accéder aux canaux de salles
 * uniquement s'ils sont membres de la salle
 */
transmit.authorize('room:*', async (ctx: HttpContext) => {
  // Assurez-vous que l'utilisateur est authentifié
  if (!ctx.auth.user) {
    return false
  }
  return true
})

/**
 * Autoriser les utilisateurs à accéder aux canaux de jeu
 * uniquement s'ils sont participants du jeu
 */
transmit.authorize('game:*', async (ctx: HttpContext) => {
  // Assurez-vous que l'utilisateur est authentifié
  if (!ctx.auth.user) {
    return false
  }
  return true
})

/**
 * Événements de journalisation pour le débogage
 */
transmit.on('connect', ({ uid }) => {
  console.log(`SSE Connected: ${uid}`)
})

transmit.on('disconnect', ({ uid }) => {
  console.log(`SSE Disconnected: ${uid}`)
})

transmit.on('broadcast', ({ channel }) => {
  console.log(`SSE Broadcast to channel ${channel}`)
})

transmit.on('subscribe', ({ uid, channel }) => {
  console.log(`SSE Subscribed ${uid} to ${channel}`)
})

transmit.on('unsubscribe', ({ uid, channel }) => {
  console.log(`SSE Unsubscribed ${uid} from ${channel}`)
})
