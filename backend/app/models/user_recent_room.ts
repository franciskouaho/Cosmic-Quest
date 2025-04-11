import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import User from '#models/user'
import Room from '#models/room'

export default class UserRecentRoom extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'user_id' })
  declare userId: number

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @column({ columnName: 'room_id' })
  declare roomId: number

  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>

  @column.dateTime({ columnName: 'joined_at', autoCreate: true })
  declare joinedAt: DateTime
}
