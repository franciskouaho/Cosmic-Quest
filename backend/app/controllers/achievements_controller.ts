import { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserAchievement from '#models/user_achievement'

export default class AchievementsController {
  /**
   * Récupère tous les succès d'un utilisateur
   */
  async index({ auth, response }: HttpContext) {
    try {
      const user = await auth.authenticate()

      const achievements = await UserAchievement.query()
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')

      return response.ok({
        status: 'success',
        data: achievements.map((achievement) => ({
          id: achievement.id,
          key: achievement.achievementKey,
          name: achievement.achievementName,
          description: achievement.achievementDescription,
          is_completed: achievement.isCompleted,
          progress: achievement.progress,
          created_at: achievement.createdAt,
        })),
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des succès:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la récupération des succès',
      })
    }
  }

  /**
   * Vérifie et débloque les succès pour un utilisateur
   * Cette méthode peut être appelée après des actions importantes (victoire, niveau supérieur, etc.)
   */
  async checkAndUnlockAchievements({ auth, response }: HttpContext) {
    try {
      const user = await auth.authenticate()
      const unlockedAchievements = []

      // Récupérer les succès déjà débloqués
      const existingAchievements = await UserAchievement.query()
        .where('user_id', user.id)
        .select('achievement_key')

      const existingKeys = existingAchievements.map((a) => a.achievementKey)

      // Vérifier les conditions pour débloquer les succès

      // Succès: Premier jeu
      if (!existingKeys.includes('first_game') && user.gamesPlayed >= 1) {
        const achievement = await UserAchievement.create({
          userId: user.id,
          achievementKey: 'first_game',
          achievementName: 'Première partie',
          achievementDescription: 'Vous avez participé à votre première partie',
          progress: 100,
          isCompleted: true,
        })
        unlockedAchievements.push(achievement)
      }

      // Succès: 10 jeux joués
      if (!existingKeys.includes('game_addict') && user.gamesPlayed >= 10) {
        const achievement = await UserAchievement.create({
          userId: user.id,
          achievementKey: 'game_addict',
          achievementName: 'Accro au jeu',
          achievementDescription: 'Vous avez joué 10 parties',
          progress: 100,
          isCompleted: true,
        })
        unlockedAchievements.push(achievement)
      }

      // Succès: Première victoire
      if (!existingKeys.includes('first_win') && user.gamesWon >= 1) {
        const achievement = await UserAchievement.create({
          userId: user.id,
          achievementKey: 'first_win',
          achievementName: 'Première victoire',
          achievementDescription: 'Vous avez gagné votre première partie',
          progress: 100,
          isCompleted: true,
        })
        unlockedAchievements.push(achievement)
      }

      // Succès: Niveau 10
      if (!existingKeys.includes('level_10') && user.level >= 10) {
        const achievement = await UserAchievement.create({
          userId: user.id,
          achievementKey: 'level_10',
          achievementName: 'Niveau 10',
          achievementDescription: 'Vous avez atteint le niveau 10',
          progress: 100,
          isCompleted: true,
        })
        unlockedAchievements.push(achievement)
      }

      return response.ok({
        status: 'success',
        message:
          unlockedAchievements.length > 0 ? 'Nouveaux succès débloqués!' : 'Aucun nouveau succès',
        data: unlockedAchievements.map((achievement) => ({
          key: achievement.achievementKey,
          name: achievement.achievementName,
          description: achievement.achievementDescription,
        })),
      })
    } catch (error) {
      console.error('Erreur lors de la vérification des succès:', error)
      return response.internalServerError({
        error: 'Une erreur est survenue lors de la vérification des succès',
      })
    }
  }

  /**
   * Attribue un succès à un utilisateur (admin ou système seulement)
   */
  async awardAchievement({ request, response }: HttpContext) {
    try {
      const { userId, key, name, description } = request.all()

      // Vérifier si l'utilisateur existe
      const user = await User.find(userId)
      if (!user) {
        return response.notFound({
          error: 'Utilisateur non trouvé',
        })
      }

      // Vérifier si l'achievement existe déjà
      const existingAchievement = await UserAchievement.query()
        .where('user_id', userId)
        .where('achievement_key', key)
        .first()

      if (existingAchievement) {
        return response.conflict({
          error: 'Cet utilisateur possède déjà ce succès',
        })
      }

      // Créer le succès
      const achievement = await UserAchievement.create({
        userId,
        achievementKey: key,
        achievementName: name,
        achievementDescription: description,
        progress: 100,
        isCompleted: true,
      })

      return response.created({
        status: 'success',
        message: 'Succès attribué avec succès',
        data: achievement,
      })
    } catch (error) {
      console.error("Erreur lors de l'attribution du succès:", error)
      return response.internalServerError({
        error: "Une erreur est survenue lors de l'attribution du succès",
      })
    }
  }
}
