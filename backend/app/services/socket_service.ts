import env from '#start/env'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import type { Server as HttpServer } from 'node:http'
import redisProvider from '#providers/redis_provider'

export class SocketService {
  private io: Server | null = null

  // Méthodes pour la gestion des locks Redis
  private async acquireLock(key: string, ttl: number = 30): Promise<boolean> {
    try {
      const result = await redisProvider.getClient().set(key, Date.now().toString(), {
        NX: true,
        EX: ttl,
      })
      return result === 'OK'
    } catch (error) {
      console.error("❌ Erreur lors de l'acquisition du lock:", error)
      return false
    }
  }

  private async releaseLock(key: string): Promise<void> {
    try {
      await redisProvider.getClient().del(key)
    } catch (error) {
      console.error('❌ Erreur lors de la libération du lock:', error)
    }
  }

  // Méthode utilitaire pour gérer un lock avec un timeout
  public async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = 30
  ): Promise<T | null> {
    const lockAcquired = await this.acquireLock(key, ttl)

    if (!lockAcquired) {
      console.warn(`⚠️ Impossible d'acquérir le lock pour ${key}`)
      return null
    }

    try {
      return await callback()
    } finally {
      await this.releaseLock(key)
    }
  }

  init(httpServer: HttpServer) {
    if (this.io) {
      console.log('⚠️ Socket.IO déjà initialisé. Ignorer la réinitialisation.')
      return this.io
    }

    try {
      this.io = new Server(httpServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 10000, // Réduire de 20000 à 10000
        pingInterval: 15000, // Réduire de 25000 à 15000
        connectTimeout: 15000, // Réduire de 30000 à 15000
        retries: 3,
        reconnectionDelayMax: 5000,
        reconnectionDelay: 1000,
        maxHttpBufferSize: 1e8, // 100 MB
      })

      // S'assurer que Redis est connecté avant de configurer l'adaptateur
      const pubClient = redisProvider.getPubClient()
      const subClient = redisProvider.getSubClient()

      if (!pubClient.isOpen || !subClient.isOpen) {
        throw new Error('Redis clients not connected')
      }

      this.io.adapter(createAdapter(pubClient, subClient))

      // Ajouter une gestion d'erreur pour l'adaptateur
      this.io.of('/').adapter.on('error', (error) => {
        console.error('❌ Erreur adaptateur Redis:', error)
        // Tenter de reconnecter l'adaptateur
        this.reconnectAdapter()
      })

      console.log('⚡ Initialisation du service WebSocket...')

      this.io.use((socket, next) => {
        try {
          const token = socket.handshake.auth?.token
          console.log(`🔐 Nouvelle connexion WebSocket - Token présent: ${!!token}`)

          // Vous pouvez vérifier le token ici si nécessaire
          // Pour l'instant on accepte toutes les connexions
          next()
        } catch (error) {
          console.error("❌ Erreur d'authentification WebSocket:", error)
          next(new Error("Erreur d'authentification"))
        }
      })

      this.io.on('connection', (socket) => {
        console.log(`🟢 Nouveau client connecté: ${socket.id}`)

        // Envoyer un événement de confirmation pour tester la connexion
        socket.emit('connection:success', { message: 'Connexion WebSocket établie avec succès' })

        // Gestion des salles
        socket.on('join-room', (data) => {
          try {
            const roomCode = typeof data === 'object' ? data.roomCode : data
            const roomChannel = `room:${roomCode}`

            socket.join(roomChannel)
            console.log(`🚪 Client ${socket.id} a rejoint la salle ${roomCode}`)

            // Confirmer au client qu'il a bien rejoint la salle
            socket.emit('room:joined', { roomCode })
          } catch (error) {
            console.error(`❌ Erreur lors de la jointure à la salle:`, error)
            socket.emit('error', { message: 'Erreur lors de la jointure à la salle' })
          }
        })

        socket.on('leave-room', (data) => {
          try {
            const roomCode = typeof data === 'object' ? data.roomCode : data
            const roomChannel = `room:${roomCode}`

            socket.leave(roomChannel)
            console.log(`🚪 Client ${socket.id} a quitté la salle ${roomCode}`)

            // Confirmer au client qu'il a bien quitté la salle
            socket.emit('room:left', { roomCode })
          } catch (error) {
            console.error(`❌ Erreur lors du départ de la salle:`, error)
            socket.emit('error', { message: 'Erreur lors du départ de la salle' })
          }
        })

        // Gestion des jeux
        socket.on('join-game', (data) => {
          try {
            const gameId = typeof data === 'object' ? data.gameId : data
            const gameChannel = `game:${gameId}`

            socket.join(gameChannel)
            console.log(`🎮 Client ${socket.id} a rejoint le jeu ${gameId}`)

            // Confirmer au client qu'il a bien rejoint le jeu
            socket.emit('game:joined', { gameId })
          } catch (error) {
            console.error(`❌ Erreur lors de la jointure au jeu:`, error)
            socket.emit('error', { message: 'Erreur lors de la jointure au jeu' })
          }
        })

        socket.on('leave-game', (data) => {
          try {
            const gameId = typeof data === 'object' ? data.gameId : data
            const gameChannel = `game:${gameId}`

            socket.leave(gameChannel)
            console.log(`🎮 Client ${socket.id} a quitté le jeu ${gameId}`)

            // Confirmer au client qu'il a bien quitté le jeu
            socket.emit('game:left', { gameId })
          } catch (error) {
            console.error(`❌ Erreur lors du départ du jeu:`, error)
            socket.emit('error', { message: 'Erreur lors du départ du jeu' })
          }
        })

        // Nouveau gestionnaire pour le passage au tour suivant via WebSocket
        socket.on('game:next_round', async (data, callback) => {
          try {
            console.log(
              `🎮 [WebSocket] Demande de passage au tour suivant pour le jeu ${data.gameId}`
            )

            // Récupérer l'ID utilisateur depuis l'authentification avec fallbacks multiples
            const userId =
              socket.handshake.auth?.userId ||
              socket.handshake.headers?.userId ||
              socket.handshake.query?.userId ||
              data.userId // Ajout de data.userId comme source

            if (!userId) {
              console.error(
                `❌ [WebSocket] ID utilisateur non fourni pour le passage au tour suivant`
              )
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'ID utilisateur non fourni',
                })
              }
              return
            }

            console.log(`👤 [WebSocket] Utilisateur ${userId} demande le passage au tour suivant`)

            // Récupérer les modèles nécessaires
            const Game = (await import('#models/game')).default
            const Room = (await import('#models/room')).default
            const Question = (await import('#models/question')).default
            const Vote = (await import('#models/vote')).default

            // Récupérer le jeu
            const game = await Game.find(data.gameId)

            if (!game) {
              console.error(`❌ [WebSocket] Jeu ${data.gameId} non trouvé`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Jeu non trouvé',
                })
              }
              return
            }

            // Récupérer la salle pour vérifier l'hôte
            const room = await Room.find(game.roomId)

            // Vérifier si l'utilisateur est l'hôte (en convertissant en string pour comparaison sûre)
            const isHost = String(room.hostId) === String(userId)
            console.log(
              `👑 [WebSocket] Vérification hôte: hostId=${room.hostId}, userId=${userId}, isHost=${isHost}`
            )

            if (!isHost && !data.forceAdvance) {
              console.error(
                `❌ [WebSocket] L'utilisateur ${userId} n'est pas l'hôte (${room.hostId}) de la partie`
              )

              // Si l'option forceAdvance est définie à true, l'utilisateur est un administrateur
              if (data.isAdmin) {
                console.log(`⚠️ [WebSocket] Passage forcé par administrateur ${userId}`)
              } else {
                if (typeof callback === 'function') {
                  callback({
                    success: false,
                    error: "Seul l'hôte peut passer au tour suivant",
                    details: {
                      userId: userId,
                      hostId: room.hostId,
                    },
                  })
                }
                return
              }
            }

            // Vérifier que la partie est en cours
            if (game.status !== 'in_progress') {
              console.error(`❌ [WebSocket] La partie ${data.gameId} n'est pas en cours`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: "La partie n'est pas en cours",
                })
              }
              return
            }

            // Vérifier que nous sommes dans une phase valide
            const validPhases = ['results', 'vote']
            if (!validPhases.includes(game.currentPhase) && !data.forceAdvance) {
              console.error(
                `❌ [WebSocket] Phase incorrecte pour le passage au tour suivant: ${game.currentPhase}`
              )
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error:
                    'Veuillez attendre la fin de la phase actuelle avant de passer au tour suivant',
                  details: {
                    currentPhase: game.currentPhase,
                  },
                })
              }
              return
            }

            // Si en phase vote, vérifier qu'il y a eu des votes sauf si forceAdvance=true
            if (game.currentPhase === 'vote' && !data.forceAdvance) {
              const currentQuestion = await Question.query()
                .where('game_id', data.gameId)
                .where('round_number', game.currentRound)
                .first()

              if (!currentQuestion) {
                console.error(
                  `❌ [WebSocket] Question non trouvée pour le jeu ${data.gameId}, tour ${game.currentRound}`
                )
                if (typeof callback === 'function') {
                  callback({
                    success: false,
                    error: 'Question non trouvée',
                  })
                }
                return
              }

              const votes = await Vote.query()
                .where('question_id', currentQuestion.id)
                .count('* as count')
              const voteCount = Number.parseInt(votes[0].$extras.count || '0', 10)

              if (voteCount === 0) {
                console.error(`❌ [WebSocket] Aucun vote pour la question ${currentQuestion.id}`)

                // Si forceAdvance est true, continuer malgré tout
                if (data.forceAdvance) {
                  console.log(
                    `⚠️ [WebSocket] Passage forcé au tour suivant malgré l'absence de votes`
                  )
                } else {
                  if (typeof callback === 'function') {
                    callback({
                      success: false,
                      error: 'Veuillez attendre la fin des votes avant de passer au tour suivant',
                      details: {
                        currentPhase: game.currentPhase,
                        hasVotes: false,
                      },
                    })
                  }
                  return
                }
              }
            }

            // Importer le contrôleur de jeu
            const GameController = (await import('#controllers/ws/game_controller')).default
            const controller = new GameController()

            // Envoyer un acquittement immédiat pour éviter les timeouts
            if (typeof callback === 'function') {
              callback({
                success: true,
                message: 'Traitement du passage au tour suivant en cours...',
              })
            }

            try {
              // Tenter le passage au tour suivant directement via le contrôleur
              console.log(
                `🚀 [WebSocket] Exécution de nextRound via le contrôleur pour ${data.gameId}`
              )

              // Créer un contexte minimal pour appeler la méthode du contrôleur
              const mockContext = {
                params: { id: data.gameId },
                auth: {
                  authenticate: async () => ({ id: userId }),
                },
                response: {
                  ok: (data) => {
                    console.log(`✅ [WebSocket] nextRound exécuté avec succès:`, data)

                    // Confirmer spécifiquement l'action next_round à tout le monde
                    socket.emit('next_round:confirmation', {
                      success: true,
                      message: data.message || 'Nouveau tour démarré',
                      gameId: data.gameId,
                      round: game.currentRound + 1,
                      data: data.data,
                    })

                    this.io.to(`game:${data.gameId}`).emit('game:update', {
                      type: 'phase_change',
                      phase: 'question', // Phase par défaut au début d'un tour
                      round: game.currentRound + 1,
                      message: 'Nouveau tour commencé',
                    })

                    return data
                  },
                  notFound: (data) => {
                    console.error(`❌ [WebSocket] Ressource non trouvée:`, data)
                    socket.emit('next_round:error', {
                      success: false,
                      error: 'Ressource non trouvée',
                    })
                    return data
                  },
                  forbidden: (data) => {
                    console.error(`❌ [WebSocket] Accès interdit:`, data)
                    socket.emit('next_round:error', {
                      success: false,
                      error: data.error || 'Accès interdit',
                    })
                    return data
                  },
                  badRequest: (data) => {
                    console.error(`❌ [WebSocket] Requête invalide:`, data)
                    socket.emit('next_round:error', {
                      success: false,
                      error: data.error || 'Requête invalide',
                    })
                    return data
                  },
                  internalServerError: (data) => {
                    console.error(`❌ [WebSocket] Erreur serveur:`, data)
                    socket.emit('next_round:error', {
                      success: false,
                      error: data.error || 'Erreur serveur',
                    })
                    return data
                  },
                },
              }

              // Appeler directement la méthode du contrôleur avec notre contexte
              await controller.nextRound(mockContext)

              console.log(`✅ [WebSocket] Traitement nextRound terminé pour ${data.gameId}`)
            } catch (controllerError) {
              console.error(`❌ [WebSocket] Erreur lors de l'appel au contrôleur:`, controllerError)
              socket.emit('next_round:error', {
                success: false,
                error: controllerError.message || 'Erreur lors du passage au tour suivant',
              })
            }
          } catch (error) {
            console.error(`❌ [WebSocket] Erreur lors du passage au tour suivant:`, error)
            socket.emit('next_round:error', {
              success: false,
              error: error.message || 'Une erreur est survenue lors du passage au tour suivant',
            })

            if (typeof callback === 'function' && !callback.called) {
              callback.called = true
              callback({
                success: false,
                error: 'Une erreur est survenue lors du passage au tour suivant',
              })
            }
          }
        })

        // Gestionnaire pour récupérer l'état du jeu
        socket.on('game:get_state', async (data, callback) => {
          try {
            console.log(
              `🎮 [WebSocket] Demande d'état du jeu ${data.gameId} par ${data.userId || 'utilisateur inconnu'}`
            )

            // Récupérer l'ID utilisateur depuis l'authentification avec fallbacks multiples
            const userId =
              socket.handshake.auth?.userId ||
              socket.handshake.headers?.userId ||
              socket.handshake.query?.userId ||
              data.userId

            if (!userId) {
              console.error(
                `❌ [WebSocket] ID utilisateur non fourni pour la récupération d'état de jeu`
              )
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'ID utilisateur non fourni',
                })
              }
              return
            }

            // Importer le contrôleur de jeu
            const GameController = (await import('#controllers/ws/game_controller')).default
            const controller = new GameController()

            try {
              // Récupérer l'état du jeu via la méthode du contrôleur
              const gameState = await controller.getGameState(data.gameId, userId)

              console.log(
                `✅ [WebSocket] État du jeu ${data.gameId} récupéré avec succès pour ${userId}`
              )

              // Retourner les données au client
              if (typeof callback === 'function') {
                callback({
                  success: true,
                  data: gameState,
                })
              }
            } catch (controllerError) {
              console.error(
                `❌ [WebSocket] Erreur lors de la récupération de l'état du jeu:`,
                controllerError
              )

              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error:
                    controllerError.message || "Erreur lors de la récupération de l'état du jeu",
                })
              }
            }
          } catch (error) {
            console.error(`❌ [WebSocket] Erreur lors du traitement de game:get_state:`, error)
            if (typeof callback === 'function') {
              callback({
                success: false,
                error: "Une erreur est survenue lors de la récupération de l'état du jeu",
              })
            }
          }
        })

        // Événement pour tester la connexion
        socket.on('ping', (callback) => {
          if (typeof callback === 'function') {
            callback({ status: 'success', time: new Date().toISOString() })
          } else {
            socket.emit('pong', { status: 'success', time: new Date().toISOString() })
          }
        })

        socket.on('disconnect', () => {
          console.log(`🔴 Client déconnecté: ${socket.id}`)
        })

        socket.on('error', (error) => {
          console.error(`🚨 Erreur WebSocket pour ${socket.id}:`, error)
        })
      })

      // Ajouter une gestion d'erreur plus robuste
      this.io.on('connect_error', (error) => {
        console.error('❌ Erreur de connexion Socket.IO:', error)
        // Tenter une reconnexion immédiate
        this.io?.connect()
      })

      const port = env.get('PORT')
      console.log(`✅ Serveur WebSocket en écoute sur le port ${port}`)

      return this.io
    } catch (error) {
      console.error("❌ Erreur lors de l'initialisation du serveur WebSocket:", error)
      throw error
    }
  }

  private async reconnectAdapter() {
    try {
      const pubClient = redisProvider.getPubClient()
      const subClient = redisProvider.getSubClient()

      await Promise.all([pubClient.connect(), subClient.connect()])

      this.io?.adapter(createAdapter(pubClient, subClient))
      console.log('✅ Adaptateur Redis reconnecté')
    } catch (error) {
      console.error('❌ Erreur reconnexion adaptateur:', error)
    }
  }

  getInstance() {
    if (!this.io) {
      throw new Error('Socket.IO non initialisé')
    }
    return this.io
  }

  // Méthode pour diffuser un message à tous les clients
  broadcast(event: string, data: any) {
    if (!this.io) {
      console.error('❌ Socket.IO non initialisé, impossible de diffuser le message')
      return
    }

    this.io.emit(event, data)
    console.log(`📢 Message diffusé sur l'événement "${event}"`)
  }

  // Méthode pour diffuser un message à une salle spécifique
  broadcastToRoom(roomCode: string, event: string, data: any) {
    if (!this.io) {
      console.error('❌ Socket.IO non initialisé, impossible de diffuser le message')
      return
    }

    this.io.to(`room:${roomCode}`).emit(event, data)
    console.log(`📢 Message diffusé à la salle "${roomCode}" sur l'événement "${event}"`)
  }

  // Méthode pour diffuser un message à un jeu spécifique
  broadcastToGame(gameId: string, event: string, data: any) {
    if (!this.io) {
      console.error('❌ Socket.IO non initialisé, impossible de diffuser le message')
      return
    }

    this.io.to(`game:${gameId}`).emit(event, data)
    console.log(`📢 Message diffusé au jeu "${gameId}" sur l'événement "${event}"`)
  }
}

export default new SocketService()
