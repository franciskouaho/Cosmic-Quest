import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'question_banks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.text('text').notNullable()
      table.string('theme', 30).notNullable().defaultTo('standard')
      table.boolean('is_active').defaultTo(true).notNullable()
      table.integer('usage_count').defaultTo(0).notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
