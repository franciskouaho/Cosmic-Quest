import { createClient } from 'redis'
import env from '#start/env'

class RedisConnection {
  private static instance: RedisConnection | null = null
  private client: any | null = null
  private pubClient: any | null = null
  private subClient: any | null = null

  private constructor() {
    const options = {
      url: `redis://${env.get('REDIS_HOST')}:${env.get('REDIS_PORT')}`,
      password: env.get('REDIS_PASSWORD', ''),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        console.log(`🔄 Redis: Tentative de reconnexion dans ${delay}ms`)
        return delay
      },
    }

    this.client = createClient(options)
    this.pubClient = createClient(options)
    this.subClient = createClient(options)

    // Gestion des erreurs
    ;[this.client, this.pubClient, this.subClient].forEach((client) => {
      client.on('error', (err: Error) => console.error('Redis Error:', err))
      client.on('ready', () => console.log('✅ Redis connecté'))
      client.on('reconnecting', () => console.log('🔄 Redis: Reconnexion...'))
    })
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection()
    }
    return RedisConnection.instance
  }

  public async connect() {
    try {
      await Promise.all([this.client.connect(), this.pubClient.connect(), this.subClient.connect()])
    } catch (error) {
      console.error('❌ Erreur de connexion Redis:', error)
      throw error
    }
  }

  public getClient() {
    return this.client
  }

  public getPubClient() {
    return this.pubClient
  }

  public getSubClient() {
    return this.subClient
  }

  public async disconnect() {
    try {
      await Promise.all([
        this.client?.disconnect(),
        this.pubClient?.disconnect(),
        this.subClient?.disconnect(),
      ])
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion Redis:', error)
    }
  }
}

export default RedisConnection.getInstance()
