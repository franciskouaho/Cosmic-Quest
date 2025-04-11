import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('username', 30).notNullable().unique()
      table.string('display_name', 50).nullable()
      table.string('avatar').nullable()
      table.integer('level').defaultTo(1)
      table.integer('experience_points').defaultTo(0)
      table.integer('games_played').defaultTo(0)
      table.integer('games_won').defaultTo(0)
      table.boolean('is_active').defaultTo(true)
      table.timestamp('last_seen_at', { useTz: true }).nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
