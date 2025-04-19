import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'

import Room from '#models/room'
import User from '#models/user'
import Question from '#models/question'

export default class Game extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'room_id' })
  declare roomId: number

  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>

  @column({ columnName: 'current_round' })
  declare currentRound: number

  @column({ columnName: 'total_rounds' })
  declare totalRounds: number

  @column()
  declare status: 'in_progress' | 'completed'

  @column({ columnName: 'game_mode' })
  declare gameMode: 'standard' | 'crazy' | 'fun' | 'dark' | 'personal'

  @column({ columnName: 'current_target_player_id' })
  declare currentTargetPlayerId: number | null

  @belongsTo(() => User, { foreignKey: 'currentTargetPlayerId' })
  declare currentTargetPlayer: BelongsTo<typeof User>

  @column({ columnName: 'current_phase' })
  declare currentPhase: 'question' | 'answer' | 'vote' | 'results' | 'waiting'

  @hasMany(() => Question)
  declare questions: HasMany<typeof Question>

  @manyToMany(() => User, {
    pivotTable: 'game_players',
    pivotColumns: ['score'],
  })
  declare players: ManyToMany<typeof User>

  @column()
  declare scores: Record<number, number>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime({ columnName: 'completed_at' })
  declare completedAt: DateTime | null
}
