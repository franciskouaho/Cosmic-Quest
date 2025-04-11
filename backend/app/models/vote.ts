import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import Question from '#models/question'
import User from '#models/user'
import Answer from '#models/answer'

export default class Vote extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'question_id' })
  declare questionId: number

  @belongsTo(() => Question)
  declare question: BelongsTo<typeof Question>

  @column({ columnName: 'voter_id' })
  declare voterId: number

  @belongsTo(() => User, { foreignKey: 'voterId' })
  declare voter: BelongsTo<typeof User>

  @column({ columnName: 'answer_id' })
  declare answerId: number

  @belongsTo(() => Answer)
  declare answer: BelongsTo<typeof Answer>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
