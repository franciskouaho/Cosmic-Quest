import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'rooms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('code', 8).notNullable().unique().index()
      table.string('name', 50).notNullable()
      table.integer('host_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('status', 20).defaultTo('waiting').comment('waiting, playing, finished')
      table.boolean('is_private').defaultTo(false)
      table.integer('max_players').defaultTo(6)
      table
        .string('game_mode', 30)
        .defaultTo('standard')
        .comment('standard, crazy, fun, dark, personal')
      table.integer('total_rounds').defaultTo(5)
      table.json('settings').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('ended_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
