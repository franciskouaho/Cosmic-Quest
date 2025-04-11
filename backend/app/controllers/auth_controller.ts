import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import { registerValidator } from '#validators/auth'
import { DateTime } from 'luxon'

export default class AuthController {
  /**
   * Enregistre un nouvel utilisateur ou connecte un utilisateur existant
   */
  async registerOrLogin({ request, response }: HttpContext) {
    console.log('🚀 Début registerOrLogin')
    const payload = await request.validateUsing(registerValidator)
    console.log('📝 Payload reçu:', payload)

    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findBy('username', payload.username)
      console.log('🔍 Recherche utilisateur:', existingUser ? 'trouvé' : 'non trouvé')

      if (existingUser) {
        console.log('👤 Utilisateur existant, mise à jour lastSeenAt')
        existingUser.lastSeenAt = DateTime.now()
        await existingUser.save()

        // Générer le token
        console.log('🔑 Génération du token pour utilisateur existant')
        const token = await User.accessTokens.create(existingUser)
        console.log('✅ Token généré avec succès')

        return response.ok({
          status: 'success',
          message: 'Connexion réussie',
          data: {
            user: {
              id: existingUser.id,
              username: existingUser.username,
              displayName: existingUser.displayName,
              avatar: existingUser.avatar,
              level: existingUser.level,
              experience_points: existingUser.experiencePoints,
              games_played: existingUser.gamesPlayed,
              games_won: existingUser.gamesWon,
            },
            token: token.value?.release(),
          },
        })
      }

      console.log('👥 Création nouvel utilisateur')
      const user = await User.create({
        username: payload.username,
        displayName: payload.displayName || payload.username,
        avatar: payload.avatar || null,
      })
      console.log('✨ Nouvel utilisateur créé:', user.id)

      // Générer le token pour le nouvel utilisateur
      console.log('🔑 Génération du token pour nouvel utilisateur')
      const token = await User.accessTokens.create(user)
      console.log('✅ Token généré avec succès')

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
          token: token.value?.release(),
        },
      })
    } catch (error) {
      console.error('❌ Erreur dans registerOrLogin:', error)
      console.error('Stack trace:', error.stack)
      return response.internalServerError({
        error: "Une erreur est survenue lors de l'opération",
        details: error.message,
      })
    }
  }
}
