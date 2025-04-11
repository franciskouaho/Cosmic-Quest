import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'

import User from '#models/user'
import Game from '#models/game'
import UserRecentRoom from '#models/user_recent_room'

export default class Room extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column({ columnName: 'host_id' })
  declare hostId: number

  @belongsTo(() => User, { foreignKey: 'hostId' })
  declare host: BelongsTo<typeof User>

  @column()
  declare status: 'waiting' | 'playing' | 'finished'

  @column()
  declare is_private: boolean

  @column({ columnName: 'max_players' })
  declare maxPlayers: number

  @column({ columnName: 'game_mode' })
  declare gameMode: 'standard' | 'crazy' | 'fun' | 'dark' | 'personal'

  @column({ columnName: 'total_rounds' })
  declare totalRounds: number

  @column()
  declare settings: Record<string, any> | null

  @manyToMany(() => User, {
    pivotTable: 'room_players',
    pivotColumns: ['is_ready', 'score', 'joined_at', 'left_at'],
  })
  declare players: ManyToMany<typeof User>

  @hasMany(() => Game)
  declare games: HasMany<typeof Game>

  @hasMany(() => UserRecentRoom)
  declare userRecentRooms: HasMany<typeof UserRecentRoom>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime({ columnName: 'started_at' })
  declare startedAt: DateTime | null

  @column.dateTime({ columnName: 'ended_at' })
  declare endedAt: DateTime | null
}
