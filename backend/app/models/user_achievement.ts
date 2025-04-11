import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import User from '#models/user'

export default class UserAchievement extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: number

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @column({ columnName: 'achievement_key' })
  declare achievementKey: string

  @column({ columnName: 'achievement_name' })
  declare achievementName: string

  @column({ columnName: 'achievement_description' })
  declare achievementDescription: string | null

  @column()
  declare progress: number

  @column({ columnName: 'is_completed' })
  declare isCompleted: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
