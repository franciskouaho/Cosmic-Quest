import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_achievements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('achievement_key', 50).notNullable()
      table.string('achievement_name', 100).notNullable()
      table.text('achievement_description').nullable()
      table.integer('progress').defaultTo(100)
      table.boolean('is_completed').defaultTo(true)

      table.timestamp('created_at', { useTz: true }).notNullable()

      // Un utilisateur ne peut obtenir un achievement spécifique qu'une seule fois
      table.unique(['user_id', 'achievement_key'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
