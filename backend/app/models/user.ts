import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'

import Room from '#models/room'
import Game from '#models/game'
import Answer from '#models/answer'
import Vote from '#models/vote'
import UserAchievement from '#models/user_achievement'
import UserRecentRoom from '#models/user_recent_room'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare username: string

  @column({ columnName: 'display_name' })
  declare displayName: string | null

  @column()
  declare avatar: string | null

  @column()
  declare level: number

  @column({ columnName: 'experience_points' })
  declare experiencePoints: number

  @column({ columnName: 'games_played' })
  declare gamesPlayed: number

  @column({ columnName: 'games_won' })
  declare gamesWon: number

  @column()
  declare is_active: boolean

  @column.dateTime({ columnName: 'last_seen_at' })
  declare lastSeenAt: DateTime | null

  @hasMany(() => Room, {
    foreignKey: 'host_id',
  })
  declare hostedRooms: HasMany<typeof Room>

  @manyToMany(() => Room, {
    pivotTable: 'room_players',
    pivotColumns: ['is_ready', 'score', 'joined_at', 'left_at'],
  })
  declare rooms: ManyToMany<typeof Room>

  @hasMany(() => Answer)
  declare answers: HasMany<typeof Answer>

  @hasMany(() => Vote, {
    foreignKey: 'voter_id',
  })
  declare votes: HasMany<typeof Vote>

  @hasMany(() => UserAchievement)
  declare achievements: HasMany<typeof UserAchievement>

  @hasMany(() => UserRecentRoom)
  declare recentRooms: HasMany<typeof UserRecentRoom>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  static accessTokens = DbAccessTokensProvider.forModel(User)
}
