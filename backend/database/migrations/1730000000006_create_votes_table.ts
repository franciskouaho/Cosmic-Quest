import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'votes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('question_id')
        .unsigned()
        .references('id')
        .inTable('questions')
        .onDelete('CASCADE')
      table.integer('voter_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('answer_id').unsigned().references('id').inTable('answers').onDelete('CASCADE')

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      // Un joueur ne peut voter qu'une fois par question
      table.unique(['question_id', 'voter_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
