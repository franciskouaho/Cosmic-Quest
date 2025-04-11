import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import { registerValidator } from '#validators/auth'
import { DateTime } from 'luxon'

export default class AuthController {
  /**
   * Enregistre un nouvel utilisateur ou connecte un utilisateur existant
   */
  async registerOrLogin({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)

    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findBy('username', payload.username)

      if (existingUser) {
        // Si l'utilisateur existe, on le connecte directement
        existingUser.lastSeenAt = DateTime.now()
        await existingUser.save()

        return response.ok({
          status: 'success',
          message: 'Connexion réussie',
          data: {
            user: {
              id: existingUser.id,
              username: existingUser.username,
              displayName: existingUser.display_name,
              avatar: existingUser.avatar,
              level: existingUser.level,
              experience_points: existingUser.experiencePoints,
              games_played: existingUser.gamesPlayed,
              games_won: existingUser.gamesWon,
            },
          },
        })
      }

      // Si l'utilisateur n'existe pas, on le crée
      const user = await User.create({
        username: payload.username,
        displayName: payload.display_name || payload.username,
        avatar: payload.avatar || null,
      })

      return response.created({
        status: 'success',
        message: 'Compte créé avec succès',
        data: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          level: user.level,
          experience_points: user.experiencePoints,
          created_at: user.createdAt,
        },
      })
    } catch (error) {
      console.error("Erreur lors de l'opération:", error)
      return response.internalServerError({
        error: "Une erreur est survenue lors de l'opération",
      })
    }
  }
}
