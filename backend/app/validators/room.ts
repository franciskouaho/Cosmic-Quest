import vine from '@vinejs/vine'

/**
 * Validator pour la création d'une salle
 */
export const createRoomValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(3).maxLength(50),

    // Accepter à la fois is_private et isPrivate
    is_private: vine.boolean().optional(),
    isPrivate: vine.boolean().optional(),

    // Accepter à la fois max_players et maxPlayers
    max_players: vine.number().range(2, 8).optional(),
    maxPlayers: vine.number().range(2, 8).optional(),

    // Mode de jeu avec validation de caractères alphanumériques et tirets
    game_mode: vine
      .string()
      .regex(/^[a-zA-Z0-9-]+$/)
      .optional(),
    gameMode: vine
      .string()
      .regex(/^[a-zA-Z0-9-]+$/)
      .optional(),

    // Nombre de tours
    total_rounds: vine.number().range(1, 10).optional(),
    totalRounds: vine.number().range(1, 10).optional(),

    // Utiliser un type plus générique pour settings
    settings: vine.any().optional(),
  })
)

/**
 * Validator pour rejoindre une salle
 */
export const joinRoomValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(4).maxLength(8),
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
