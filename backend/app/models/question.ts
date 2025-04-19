import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import Game from '#models/game'
import User from '#models/user'
import Answer from '#models/answer'
import Vote from '#models/vote'

export default class Question extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare text: string

  @column()
  declare theme: 'standard' | 'crazy' | 'fun' | 'dark' | 'personal'

  @column({ columnName: 'game_id' })
  declare gameId: number

  @belongsTo(() => Game)
  declare game: BelongsTo<typeof Game>

  @column({ columnName: 'round_number' })
  declare roundNumber: number

  @column({ columnName: 'target_player_id' })
  declare targetPlayerId: number

  @belongsTo(() => User, { foreignKey: 'targetPlayerId' })
  declare targetPlayer: BelongsTo<typeof User>

  @hasMany(() => Answer)
  declare answers: HasMany<typeof Answer>

  @hasMany(() => Vote)
  declare votes: HasMany<typeof Vote>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
