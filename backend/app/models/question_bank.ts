import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class QuestionBank extends BaseModel {
  static table = 'question_banks'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare text: string

  @column()
  declare theme: 'standard' | 'fun' | 'dark' | 'personal' | 'crazy'

  @column()
  declare isActive: boolean

  @column()
  declare usageCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
