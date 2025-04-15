/*
|--------------------------------------------------------------------------
| HTTP server entrypoint
|--------------------------------------------------------------------------
|
| The "server.ts" file is the entrypoint for starting the AdonisJS HTTP
| server. Either you can run this file directly or use the "serve"
| command to run this file and monitor file changes
|
*/

import 'reflect-metadata'
import http from 'node:http'
import socketService from '#services/socket_service'
import { Ignitor, prettyPrintError } from '@adonisjs/core'
import redisProvider from '#providers/redis_provider'

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')

      // Initialiser Redis
      try {
        await redisProvider.connect()
      } catch (error) {
        console.error('❌ Erreur de connexion Redis:', error)
        process.exit(1)
      }
    })

    app.listen('SIGTERM', async () => {
      await redisProvider.disconnect()
      app.terminate()
    })

    app.listenIf(app.managedByPm2, 'SIGINT', async () => {
      await redisProvider.disconnect()
      app.terminate()
    })
  })
  .httpServer()
  .start((handler) => {
    const httpServer = http.createServer(handler)

    try {
      socketService.init(httpServer)
      console.log('💬 Service WebSocket initialisé')
    } catch (error) {
      console.error("❌ Erreur lors de l'initialisation du WebSocket:", error)
    }

    return httpServer
  })
  .catch((error) => {
    console.error('🔥 Erreur au démarrage des serveurs:', error)
    process.exitCode = 1
    prettyPrintError(error)
  })
