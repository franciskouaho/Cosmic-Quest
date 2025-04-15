import { createClient } from 'redis'
import env from '#start/env'

class RedisProvider {
  private static instance: RedisProvider | null = null
  private mainClient: any = null
  private pubClient: any = null
  private subClient: any = null
  private isConnecting: boolean = false
  private reconnectAttempts: number = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 5

  private constructor() {
    const options = {
      url: `redis://${env.get('REDIS_HOST')}:${env.get('REDIS_PORT')}`,
      password: env.get('REDIS_PASSWORD', ''),
      retryStrategy: (times: number) => {
        if (times > this.MAX_RECONNECT_ATTEMPTS) return null
        return Math.min(times * 1000, 3000)
      },
    }

    this.initializeClients(options)
  }

  private initializeClients(options: any) {
    this.mainClient = createClient(options)
    this.pubClient = this.mainClient.duplicate()
    this.subClient = this.mainClient.duplicate()
    ;[this.mainClient, this.pubClient, this.subClient].forEach((client) => {
      client.on('error', this.handleError.bind(this))
      client.on('connect', this.handleConnect.bind(this))
      client.on('ready', this.handleReady.bind(this))
      client.on('reconnecting', this.handleReconnecting.bind(this))
    })
  }

  private handleError(err: Error) {
    console.error('❌ Redis Error:', err)
    if (!this.isConnecting) this.reconnect()
  }

  private handleConnect() {
    console.log('🔌 Redis connecté')
    this.reconnectAttempts = 0
  }

  private handleReady() {
    console.log('✅ Redis prêt')
    this.isConnecting = false
  }

  private handleReconnecting() {
    console.log('🔄 Redis: Tentative de reconnexion...')
    this.isConnecting = true
    this.reconnectAttempts++
  }

  private async reconnect() {
    if (this.isConnecting) return
    this.isConnecting = true

    try {
      await Promise.all([
        this.mainClient?.disconnect(),
        this.pubClient?.disconnect(),
        this.subClient?.disconnect(),
      ])
      await this.connect()
    } catch (error) {
      console.error('❌ Erreur lors de la reconnexion Redis:', error)
      this.isConnecting = false
    }
  }

  public static getInstance(): RedisProvider {
    if (!RedisProvider.instance) {
      RedisProvider.instance = new RedisProvider()
    }
    return RedisProvider.instance
  }

  public async connect() {
    if (this.isConnecting) return

    try {
      this.isConnecting = true
      await Promise.all([
        this.mainClient.connect(),
        this.pubClient.connect(),
        this.subClient.connect(),
      ])
      console.log('✅ Redis connecté avec succès')
    } catch (error) {
      console.error('❌ Erreur de connexion Redis:', error)
      throw error
    } finally {
      this.isConnecting = false
    }
  }

  public getClient() {
    return this.mainClient
  }
  public getPubClient() {
    return this.pubClient
  }
  public getSubClient() {
    return this.subClient
  }
}

export default RedisProvider.getInstance()
