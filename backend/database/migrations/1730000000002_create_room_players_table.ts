import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'room_players'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('room_id').unsigned().references('id').inTable('rooms').onDelete('CASCADE')
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.boolean('is_ready').defaultTo(false)
      table.integer('score').defaultTo(0)

      table.timestamp('joined_at', { useTz: true }).notNullable()
      table.timestamp('left_at', { useTz: true }).nullable()

      // Contrainte d'unicité pour éviter qu'un joueur rejoigne plusieurs fois la même salle
      table.unique(['room_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
