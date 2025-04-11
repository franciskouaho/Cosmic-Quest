import vine, { SimpleMessagesProvider } from '@vinejs/vine'

// Configuration du provider de messages
vine.messagesProvider = new SimpleMessagesProvider({
  'username.regex':
    "Le nom d'utilisateur doit contenir uniquement des lettres, chiffres et underscores",
  'username.minLength': "Le nom d'utilisateur doit contenir au moins 3 caractères",
  'username.maxLength': "Le nom d'utilisateur ne doit pas dépasser 30 caractères",
  'displayName.minLength': "Le nom d'affichage doit contenir au moins 2 caractères",
  'displayName.maxLength': "Le nom d'affichage ne doit pas dépasser 50 caractères",
})

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
      .regex(/^[a-zA-Z0-9_]+$/),

    displayName: vine.string().trim().minLength(2).maxLength(50).nullable().optional(),

    avatar: vine.string().trim().nullable().optional(),
  })
)
