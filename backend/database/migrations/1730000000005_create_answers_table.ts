import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'answers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('question_id')
        .unsigned()
        .references('id')
        .inTable('questions')
        .onDelete('CASCADE')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.text('content').notNullable()
      table.integer('votes_count').defaultTo(0)
      table.boolean('is_selected').defaultTo(false)

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      // Contrainte d'unicité pour s'assurer qu'un joueur ne peut répondre qu'une fois à une question
      table.unique(['question_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
