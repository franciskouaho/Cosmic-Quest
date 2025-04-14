import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import Question from '#models/question'
import User from '#models/user'
import Vote from '#models/vote'

export default class Answer extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'question_id' })
  declare questionId: number

  @belongsTo(() => Question)
  declare question: BelongsTo<typeof Question>

  @column({ columnName: 'user_id' })
  declare userId: number

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @column()
  declare content: string

  @column({ columnName: 'votes_count' })
  declare votesCount: number

  @hasMany(() => Vote)
  declare votes: HasMany<typeof Vote>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
