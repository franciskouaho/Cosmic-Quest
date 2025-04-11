import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_recent_rooms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('room_id').unsigned().references('id').inTable('rooms').onDelete('CASCADE')

      table.timestamp('joined_at', { useTz: true }).notNullable()

      // Un utilisateur ne peut avoir une salle enregistrée qu'une fois dans ses récents
      table.unique(['user_id', 'room_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
