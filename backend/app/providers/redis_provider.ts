import { createClient } from 'redis'
import env from '#start/env'

class RedisProvider {
  private static instance: RedisProvider
  private client: any

  private constructor() {
    this.client = createClient({
      url: `redis://${env.get('REDIS_HOST')}:${env.get('REDIS_PORT')}`,
      password: env.get('REDIS_PASSWORD'),
    })

    this.client.on('error', (err: Error) => console.error('Redis Error:', err))
    this.client.on('connect', () => console.log('✅ Redis connecté'))
  }

  public static getInstance(): RedisProvider {
    if (!RedisProvider.instance) {
      RedisProvider.instance = new RedisProvider()
    }
    return RedisProvider.instance
  }

  public async connect() {
    await this.client.connect()
  }

  public getClient() {
    return this.client
  }
}

export default RedisProvider.getInstance()
