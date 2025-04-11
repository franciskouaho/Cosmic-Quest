import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'questions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.text('text').notNullable()
      table
        .string('theme', 30)
        .notNullable()
        .defaultTo('standard')
        .comment('standard, crazy, fun, dark, personal')
      table.integer('game_id').unsigned().references('id').inTable('games').onDelete('CASCADE')
      table.integer('round_number').notNullable()
      table
        .integer('target_player_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
