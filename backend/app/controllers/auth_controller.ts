import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import { registerValidator, loginValidator } from '#validators/auth'

export default class AuthController {
  /**
   * Enregistre un nouvel utilisateur
   */
  async register({ request, response }: HttpContext) {
    // Valider les données entrantes
    const payload = await request.validateUsing(registerValidator)

    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findBy('username', payload.username)
      if (existingUser) {
        return response.conflict({
          error: "Ce nom d'utilisateur est déjà pris",
        })
      }

      // Créer un nouvel utilisateur
      const user = await User.create({
        username: payload.username,
        display_name: payload.display_name || payload.username,
        avatar: payload.avatar || null,
      })

      // Retourner l'utilisateur créé
      return response.created({
        status: 'success',
        message: 'Compte créé avec succès',
        data: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar: user.avatar,
          level: user.level,
          experience_points: user.experiencePoints,
          created_at: user.createdAt,
        },
      })
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la création du compte',
      })
    }
  }

  /**
   * Connecte un utilisateur existant
   */
  async login({ request, response }: HttpContext) {
    const payload = await request.validateUsing(loginValidator)

    try {
      // Récupérer l'utilisateur par son nom d'utilisateur
      const user = await User.findBy('username', payload.username)

      // Si l'utilisateur n'existe pas
      if (!user) {
        return response.unprocessableEntity({
          error: "Nom d'utilisateur incorrect",
        })
      }

      // Mettre à jour les champs last_seen_at
      user.lastSeenAt = DateTime.now()
      await user.save()

      // Retourner l'utilisateur
      return response.ok({
        status: 'success',
        message: 'Connexion réussie',
        data: {
          user: {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar: user.avatar,
            level: user.level,
            experience_points: user.experiencePoints,
            games_played: user.gamesPlayed,
            games_won: user.gamesWon,
          },
        },
      })
    } catch (error) {
      console.error('Erreur lors de la connexion:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la connexion',
      })
    }
  }
}
