/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Importation des contrôleurs
const AuthController = () => import('#controllers/auth_controller')
const RoomsController = () => import('#controllers/rooms_controller')
const GamesController = () => import('#controllers/games_controller')
const UsersController = () => import('#controllers/users_controller')
const AchievementsController = () => import('#controllers/achievements_controller')

router.get('/', async ({ response }) => response.ok({ uptime: process.uptime() }))
router.get('/health', ({ response }) => response.noContent())

router
  .group(() => {
    // Routes d'authentification (publiques)
    router.post('/auth/register', [AuthController, 'register'])
    router.post('/auth/login', [AuthController, 'login'])

    // Routes protégées par authentification
    router
      .group(() => {
        // Routes pour les salles
        router
          .group(() => {
            router.get('/', [RoomsController, 'index'])
            router.post('/', [RoomsController, 'create'])
            router.get('/:code', [RoomsController, 'show'])
            router.post('/:code/join', [RoomsController, 'join'])
            router.post('/:code/leave', [RoomsController, 'leave'])
            router.post('/:code/ready', [RoomsController, 'toggleReady'])
            router.post('/:code/start', [RoomsController, 'startGame'])
          })
          .prefix('/rooms')

        // Routes pour le jeu
        router
          .group(() => {
            router.get('/:id', [GamesController, 'show'])
            router.post('/:id/answer', [GamesController, 'submitAnswer'])
            router.post('/:id/vote', [GamesController, 'submitVote'])
            router.post('/:id/next-round', [GamesController, 'nextRound'])
          })
          .prefix('/games')

        // Routes pour les utilisateurs
        router
          .group(() => {
            router.get('/profile', [UsersController, 'profile'])
            router.patch('/profile', [UsersController, 'updateProfile'])
            router.get('/stats', [UsersController, 'stats'])
            router.get('/recent-rooms', [UsersController, 'recentRooms'])
          })
          .prefix('/users')

        // Routes pour les succès
        router
          .group(() => {
            router.get('/', [AchievementsController, 'index'])
            router.post('/check', [AchievementsController, 'checkAndUnlockAchievements'])
            router.post('/award', [AchievementsController, 'awardAchievement'])
          })
          .prefix('/achievements')
      })
      .use([middleware.auth()])
  })
  .prefix('/api/v1')
