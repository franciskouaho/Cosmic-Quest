import { Redis } from '@adonisjs/redis/redis'
import app from '@adonisjs/core/services/app'
import env from '#start/env'

const redis = new Redis({
  connection: 'main',
  connections: {
    main: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 0,
      keyPrefix: 'cosmic_quest:',
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      maxRetriesPerRequest: 3,
    },
  },
})

// Exporter l'instance Redis
export default redis

// Enregistrer comme singleton
app.container.singleton('redis', () => redis)
