import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import { updateUserValidator } from '#validators/user'
import UserRecentRoom from '#models/user_recent_room'

export default class UsersController {
  /**
   * Récupère le profil de l'utilisateur actuellement connecté
   */
  async profile({ auth, response }: HttpContext) {
    try {
      const user = await auth.authenticate()
      await user.load('achievements')

      // Récupérer les salles récentes
      const recentRooms = await UserRecentRoom.query()
        .where('user_id', user.id)
        .preload('room')
        .orderBy('joined_at', 'desc')
        .limit(5)

      // Calculer les statistiques
      const winRate = user.gamesPlayed > 0 ? (user.gamesWon / user.gamesPlayed) * 100 : 0

      return response.ok({
        status: 'success',
        data: {
          id: user.id,
          username: user.username,
          display_name: user.displayName,
          avatar: user.avatar,
          level: user.level,
          experience_points: user.experiencePoints,
          games_played: user.gamesPlayed,
          games_won: user.gamesWon,
          win_rate: winRate,
          achievements: user.achievements.map((achievement) => ({
            id: achievement.id,
            key: achievement.achievementKey,
            name: achievement.achievementName,
            description: achievement.achievementDescription,
            is_completed: achievement.isCompleted,
            progress: achievement.progress,
            created_at: achievement.createdAt,
          })),
          recent_rooms: recentRooms.map((recentRoom) => ({
            id: recentRoom.room.id,
            code: recentRoom.room.code,
            name: recentRoom.room.name,
            joined_at: recentRoom.joinedAt,
          })),
        },
      })
    } catch (error) {
      console.error('Erreur lors de la récupération du profil utilisateur:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération du profil utilisateur',
      })
    }
  }

  /**
   * Met à jour les informations du profil de l'utilisateur
   */
  async updateProfile({ request, auth, response }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const payload = await request.validateUsing(updateUserValidator)

      // Vérifier si le nom d'utilisateur est déjà pris (si changé)
      if (payload.username && payload.username !== user.username) {
        const existingUser = await User.findBy('username', payload.username)
        if (existingUser) {
          return response.conflict({
            error: "Ce nom d'utilisateur est déjà pris",
          })
        }
        user.username = payload.username
      }

      // Mise à jour des champs
      if (payload.display_name !== undefined) {
        user.displayName = payload.display_name
      }

      if (payload.avatar !== undefined) {
        user.avatar = payload.avatar
      }

      await user.save()

      return response.ok({
        status: 'success',
        message: 'Profil mis à jour avec succès',
        data: {
          id: user.id,
          username: user.username,
          display_name: user.displayName,
          avatar: user.avatar,
          level: user.level,
          experience_points: user.experiencePoints,
        },
      })
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil utilisateur:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la mise à jour du profil utilisateur',
      })
    }
  }

  /**
   * Récupère les statistiques de l'utilisateur
   */
  async stats({ auth, response }: HttpContext) {
    try {
      const user = await auth.authenticate()

      // Calculer des statistiques supplémentaires
      const winRate = user.gamesPlayed > 0 ? (user.gamesWon / user.gamesPlayed) * 100 : 0
      const experienceToNextLevel = user.level * 100 - user.experiencePoints

      return response.ok({
        status: 'success',
        data: {
          games_played: user.gamesPlayed,
          games_won: user.gamesWon,
          win_rate: winRate,
          level: user.level,
          experience_points: user.experiencePoints,
          experience_to_next_level: experienceToNextLevel,
          last_seen_at: user.lastSeenAt,
        },
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des statistiques',
      })
    }
  }

  /**
   * Récupère l'historique des salles de l'utilisateur
   */
  async recentRooms({ auth, response }: HttpContext) {
    try {
      const user = await auth.authenticate()

      const recentRooms = await UserRecentRoom.query()
        .where('user_id', user.id)
        .preload('room')
        .orderBy('joined_at', 'desc')
        .limit(10)

      return response.ok({
        status: 'success',
        data: recentRooms.map((recentRoom) => ({
          id: recentRoom.room.id,
          code: recentRoom.room.code,
          name: recentRoom.room.name,
          game_mode: recentRoom.room.gameMode,
          status: recentRoom.room.status,
          joined_at: recentRoom.joinedAt,
        })),
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des salles récentes:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des salles récentes',
      })
    }
  }
}
