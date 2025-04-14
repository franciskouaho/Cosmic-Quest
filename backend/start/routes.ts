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
import socketService from '#services/socket_service'

// Importation des contrôleurs
const AuthController = () => import('#controllers/auth_controller')
const GamesController = () => import('#controllers/ws/game_controller')
const RoomsController = () => import('#controllers/ws/room_controller')
const UsersController = () => import('#controllers/users_controller')
const AchievementsController = () => import('#controllers/achievements_controller')
const QuestionsController = () => import('#controllers/questions_controller')

router.get('/', async ({ response }) => response.ok({ uptime: process.uptime() }))
router.get('/health', ({ response }) => response.noContent())

router
  .group(() => {
    // Routes d'authentification (publiques)
    router.post('register-or-login', [AuthController, 'registerOrLogin']).prefix('/auth')

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
            router.post('/:id/force-check-phase', [GamesController, 'forceCheckPhase'])
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

    // Route publique pour récupérer des questions aléatoires
    router.get('/questions/random', [QuestionsController, 'getRandom'])

    // Route de diagnostic WebSocket
    router.get('/ws/status', ({ response }) => {
      try {
        const io = socketService.getInstance()
        const sockets = io.sockets.sockets

        const clientCount = io.engine?.clientsCount || 0
        const socketCount = sockets ? sockets.size : 0

        return response.ok({
          status: 'success',
          data: {
            initialized: !!io,
            clientCount,
            socketCount,
            wsUrl: process.env.WS_HOST + ':' + process.env.WS_PORT,
          },
        })
      } catch (error) {
        return response.internalServerError({
          status: 'error',
          message: 'WebSocket not initialized',
          error: error.message,
        })
      }
    })
  })
  .prefix('/api/v1')
