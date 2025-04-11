import vine from '@vinejs/vine'

/**
 * Validator pour l'enregistrement d'un utilisateur
 */
export const registerValidator = vine.compile(
  vine.object({
    username: vine
      .string()
      .trim()
      .minLength(3)
      .maxLength(30)
      .regex(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Le nom d'utilisateur doit contenir uniquement des lettres, chiffres et underscores"
      ),

    display_name: vine.string().trim().minLength(2).maxLength(50).nullable().optional(),

    avatar: vine.string().trim().nullable().optional(),
  })
)

/**
 * Validator pour la connexion d'un utilisateur
 * (Version simplifiée sans mot de passe pour ce prototype)
 */
export const loginValidator = vine.compile(
  vine.object({
    username: vine
      .string()
      .trim()
      .minLength(3)
      .maxLength(30)
      .regex(/^[a-zA-Z0-9_]+$/),
  })
)
