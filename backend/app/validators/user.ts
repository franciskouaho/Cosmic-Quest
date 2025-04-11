import vine from '@vinejs/vine'

/**
 * Validator pour la mise à jour des informations d'un utilisateur
 */
export const updateUserValidator = vine.compile(
  vine.object({
    username: vine
      .string()
      .trim()
      .minLength(3)
      .maxLength(30)
      .regex(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Le nom d'utilisateur doit contenir uniquement des lettres, chiffres et underscores"
      )
      .optional(),

    display_name: vine.string().trim().minLength(2).maxLength(50).nullable().optional(),

    avatar: vine.string().trim().nullable().optional(),
  })
)
