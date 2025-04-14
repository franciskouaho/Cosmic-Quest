import env from '#start/env'
import { Server } from 'socket.io'
import type { Server as HttpServer } from 'node:http'

export class SocketService {
  private io: Server | null = null

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
        pingTimeout: 20000,
        pingInterval: 25000,
        connectTimeout: 30000,
        maxHttpBufferSize: 1e8, // 100 MB
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

        // Nouveau gestionnaire pour forcer la vérification de phase
        socket.on('game:force_check', async (data) => {
          try {
            const gameId = data.gameId
            console.log(`🔄 [WebSocket] Demande de vérification forcée pour le jeu ${gameId}`)

            // Importer le contrôleur de jeu de manière dynamique
            const GameController = (await import('#controllers/ws/game_controller')).default
            const controller = new GameController()

            // Récupérer les données nécessaires
            const game = await Game.find(gameId)
            if (!game) {
              console.error(`❌ [WebSocket] Jeu non trouvé: ${gameId}`)
              return
            }

            // Récupérer la question actuelle
            const question = await Question.query()
              .where('game_id', gameId)
              .where('round_number', game.currentRound)
              .first()

            if (!question) {
              console.error(`❌ [WebSocket] Question non trouvée pour le jeu ${gameId}`)
              return
            }

            // Utiliser la méthode du contrôleur pour vérifier et faire progresser la phase
            const success = await controller.checkAndProgressPhase(gameId, question.id)

            console.log(
              `${success ? '✅' : 'ℹ️'} [WebSocket] Vérification forcée ${success ? 'a mis à jour' : "n'a pas modifié"} la phase`
            )
          } catch (error) {
            console.error('❌ [WebSocket] Erreur lors de la vérification forcée:', error)
          }
        })

        // Nouveau gestionnaire pour la soumission de réponses
        socket.on('game:submit_answer', async (data, callback) => {
          try {
            console.log(`🎮 [WebSocket] Réception d'une réponse via WebSocket:`, data)

            // Extraire les données
            const { gameId, questionId, content } = data

            // Vérifier que toutes les données nécessaires sont présentes
            if (!gameId || !questionId || !content) {
              console.error(`❌ [WebSocket] Données manquantes pour la soumission de réponse`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Données incomplètes pour la soumission de la réponse',
                })
              }
              return
            }

            // Récupérer l'ID utilisateur depuis les informations de session
            const userId = socket.handshake.auth?.userId || socket.handshake.headers?.userId

            if (!userId) {
              console.error(`❌ [WebSocket] ID utilisateur manquant pour la soumission de réponse`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'ID utilisateur manquant',
                })
              }
              return
            }

            // Récupérer le jeu et la question
            const Game = (await import('#models/game')).default
            const Question = (await import('#models/question')).default
            const Answer = (await import('#models/answer')).default

            // Vérifier que le jeu existe
            const game = await Game.find(gameId)
            if (!game) {
              console.error(`❌ [WebSocket] Jeu non trouvé: ${gameId}`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Jeu non trouvé',
                })
              }
              return
            }

            // Vérifier que la question existe
            const question = await Question.query()
              .where('id', questionId)
              .where('game_id', gameId)
              .first()

            if (!question) {
              console.error(`❌ [WebSocket] Question non trouvée: ${questionId}`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Question non trouvée',
                })
              }
              return
            }

            // Vérifier que l'utilisateur n'est pas la cible
            if (question.targetPlayerId === Number(userId)) {
              console.error(`❌ [WebSocket] L'utilisateur est la cible: ${userId}`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Vous êtes la cible de cette question et ne pouvez pas y répondre',
                  code: 'TARGET_PLAYER_CANNOT_ANSWER',
                })
              }
              return
            }

            // Vérifier que l'utilisateur n'a pas déjà répondu
            const existingAnswer = await Answer.query()
              .where('question_id', questionId)
              .where('user_id', userId)
              .first()

            if (existingAnswer) {
              console.error(`❌ [WebSocket] L'utilisateur a déjà répondu: ${userId}`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Vous avez déjà répondu à cette question',
                })
              }
              return
            }

            try {
              // Créer la réponse avec un objet bien formé
              const answer = await Answer.create({
                questionId: Number(questionId),
                userId: Number(userId),
                content: String(content).trim(),
                votesCount: 0,
                isSelected: false,
              })

              console.log(`✅ [WebSocket] Réponse créée avec succès: ID=${answer.id}`)

              // Envoyer une confirmation directe à l'émetteur
              if (typeof callback === 'function') {
                callback({
                  success: true,
                  answerId: answer.id,
                })
              }

              // Récupérer les informations utilisateur
              const User = (await import('#models/user')).default
              const user = await User.find(userId)

              // Notifier tous les joueurs de la nouvelle réponse
              this.io.to(`game:${gameId}`).emit('game:update', {
                type: 'new_answer',
                answer: {
                  id: answer.id,
                  content: answer.content,
                  playerId: userId,
                  playerName: user ? user.displayName || user.username : 'Joueur',
                },
              })

              // Envoyer également une confirmation spécifique
              socket.emit('answer:confirmation', {
                success: true,
                questionId,
                answerId: answer.id,
              })

              // Vérifier si toutes les réponses ont été soumises pour avancer la phase
              const GameController = (await import('#controllers/ws/game_controller')).default
              const controller = new GameController()
              await controller.checkAndProgressPhase(gameId, questionId)
            } catch (createError) {
              console.error(`❌ [WebSocket] Erreur lors de la création de la réponse:`, createError)

              // Log plus détaillé pour mieux comprendre le problème
              console.error(`🔎 Détails de l'erreur:`, {
                message: createError.message,
                stack: createError.stack,
                data: { questionId, userId, content },
              })

              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Erreur lors de la création de la réponse: ' + createError.message,
                })
              }
            }
          } catch (error) {
            console.error(`❌ [WebSocket] Erreur lors de la soumission de réponse:`, error)
            if (typeof callback === 'function') {
              callback({
                success: false,
                error: 'Erreur lors de la soumission de la réponse',
              })
            }
          }
        })

        // Nouveau gestionnaire pour la soumission de votes
        socket.on('game:submit_vote', async (data, callback) => {
          try {
            console.log(`🗳️ [WebSocket] Réception d'un vote via WebSocket:`, data)

            // Extraire les données
            const { gameId, answerId, questionId } = data

            // Vérifier que toutes les données nécessaires sont présentes
            if (!gameId || !answerId || !questionId) {
              console.error(`❌ [WebSocket] Données manquantes pour la soumission de vote`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Données incomplètes pour la soumission du vote',
                })
              }
              return
            }

            // Récupérer l'ID utilisateur depuis les informations de session
            const userId = socket.handshake.auth?.userId || socket.handshake.headers?.userId

            if (!userId) {
              console.error(`❌ [WebSocket] ID utilisateur manquant pour la soumission de vote`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'ID utilisateur manquant',
                })
              }
              return
            }

            // Importer dynamiquement les modèles pour éviter les dépendances circulaires
            const Game = (await import('#models/game')).default
            const Question = (await import('#models/question')).default
            const Answer = (await import('#models/answer')).default
            const Vote = (await import('#models/vote')).default

            // Vérifier que le jeu existe
            const game = await Game.find(gameId)
            if (!game) {
              console.error(`❌ [WebSocket] Jeu non trouvé: ${gameId}`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Jeu non trouvé',
                })
              }
              return
            }

            // Vérifier que la question existe
            const question = await Question.query()
              .where('id', questionId)
              .where('game_id', gameId)
              .first()

            if (!question) {
              console.error(`❌ [WebSocket] Question non trouvée: ${questionId}`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Question non trouvée',
                })
              }
              return
            }

            // Vérifier que la réponse existe
            const answer = await Answer.query()
              .where('id', answerId)
              .where('question_id', question.id)
              .first()

            if (!answer) {
              console.error(`❌ [WebSocket] Réponse non trouvée: ${answerId}`)
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Réponse non trouvée',
                })
              }
              return
            }

            // Vérifier que l'utilisateur ne vote pas pour sa propre réponse
            if (answer.userId === Number(userId)) {
              console.error(
                `❌ [WebSocket] L'utilisateur ${userId} a tenté de voter pour sa propre réponse`
              )
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Vous ne pouvez pas voter pour votre propre réponse',
                })
              }
              return
            }

            // Vérifier que l'utilisateur n'a pas déjà voté
            const existingVote = await Vote.query()
              .where('question_id', question.id)
              .where('voter_id', userId)
              .first()

            if (existingVote) {
              console.error(
                `❌ [WebSocket] L'utilisateur ${userId} a déjà voté pour cette question`
              )
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Vous avez déjà voté pour cette question',
                })
              }
              return
            }

            try {
              // Créer le vote
              const vote = await Vote.create({
                questionId: Number(questionId),
                voterId: Number(userId),
                answerId: Number(answerId),
              })

              console.log(`✅ [WebSocket] Vote créé avec succès: ID=${vote.id}`)

              // Incrémenter le compteur de votes sur la réponse
              answer.votesCount = (answer.votesCount || 0) + 1
              await answer.save()

              // Envoyer une confirmation directe à l'émetteur
              if (typeof callback === 'function') {
                callback({
                  success: true,
                  voteId: vote.id,
                })
              }

              // Notifier tous les joueurs du nouveau vote
              this.io.to(`game:${gameId}`).emit('game:update', {
                type: 'new_vote',
                vote: {
                  voterId: userId,
                  answerId: answerId,
                },
              })

              // Envoyer également une confirmation spécifique
              socket.emit('vote:confirmation', {
                success: true,
                questionId,
                voteId: vote.id,
              })

              // Importer le contrôleur de jeu pour vérifier la progression de phase
              const GameController = (await import('#controllers/ws/game_controller')).default
              const controller = new GameController()

              // Vérifier si tous les joueurs qui peuvent voter l'ont fait
              const room = await (await import('#models/room')).default.find(game.roomId)
              const players = await room.related('players').query()
              const targetPlayer = players.find((p) => p.id === question.targetPlayerId)

              if (targetPlayer) {
                // Dans une partie standard, seule la cible vote
                // Si c'est le joueur cible qui a voté, c'est suffisant pour passer à la phase suivante
                if (Number(userId) === targetPlayer.id) {
                  console.log(`✅ [WebSocket] Le joueur ciblé a voté, passage en phase résultats`)

                  // Passer à la phase de résultats
                  game.currentPhase = 'results'
                  await game.save()

                  // Calculer les points et mettre à jour les scores
                  await controller.calculateAndUpdateScores(question.id, game)

                  // Notifier tous les joueurs du changement de phase
                  this.io.to(`game:${gameId}`).emit('game:update', {
                    type: 'phase_change',
                    phase: 'results',
                    scores: game.scores,
                  })
                }
              }
            } catch (voteError) {
              console.error(`❌ [WebSocket] Erreur lors de la création du vote:`, voteError)

              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Erreur lors de la création du vote: ' + voteError.message,
                })
              }
            }
          } catch (error) {
            console.error(`❌ [WebSocket] Erreur lors de la soumission de vote:`, error)
            if (typeof callback === 'function') {
              callback({
                success: false,
                error: 'Erreur lors de la soumission du vote',
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

      const port = env.get('PORT')
      console.log(`✅ Serveur WebSocket en écoute sur le port ${port}`)

      return this.io
    } catch (error) {
      console.error("❌ Erreur lors de l'initialisation du serveur WebSocket:", error)
      throw error
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
