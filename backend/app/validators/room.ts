import vine from '@vinejs/vine'

/**
 * Validator pour la création d'une salle
 */
export const createRoomValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(3).maxLength(50),

    is_private: vine.boolean().optional(),

    max_players: vine.number().range(2, 8).optional(),

    game_mode: vine.string().in(['standard', 'crazy', 'fun', 'dark', 'personal']).optional(),

    total_rounds: vine.number().range(1, 10).optional(),

    settings: vine.object().optional(),
  })
)

/**
 * Validator pour rejoindre une salle
 */
export const joinRoomValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(6).maxLength(8),
  })
)

/**
 * Validator pour mettre à jour le statut "prêt" dans une salle
 */
export const readyStatusValidator = vine.compile(
  vine.object({
    is_ready: vine.boolean(),
  })
)
