import vine from '@vinejs/vine'

/**
 * Validator pour soumettre une réponse à une question
 */
export const answerValidator = vine.compile(
  vine.object({
    content: vine.string().trim().minLength(1).maxLength(500),
    question_id: vine.number().positive(),
  })
)

/**
 * Validator pour voter pour une réponse
 */
export const voteValidator = vine.compile(
  vine.object({
    answer_id: vine.number().positive(),
    question_id: vine.number().positive(),
  })
)

/**
 * Validator pour passer au tour suivant
 */
export const nextRoundValidator = vine.compile(
  vine.object({
    game_id: vine.number().positive(),
  })
)

export const gameValidator = vine.compile(
  vine.object({
    displayName: vine.string().optional(),
  })
)
