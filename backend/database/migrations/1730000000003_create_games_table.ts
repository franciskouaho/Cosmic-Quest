import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('room_id').unsigned().references('id').inTable('rooms').onDelete('CASCADE')
      table.integer('current_round').defaultTo(1)
      table.integer('total_rounds').defaultTo(5)
      table.string('status', 20).defaultTo('in_progress').comment('in_progress, completed')
      table.string('game_mode', 30).defaultTo('standard')
      table
        .integer('current_target_player_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .string('current_phase', 30)
        .defaultTo('question')
        .comment('question, answer, vote, results, waiting')
      table.json('scores').defaultTo('{}')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
