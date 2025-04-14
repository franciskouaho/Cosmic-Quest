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

        // Nouveau gestionnaire pour vérifier si on peut passer au tour suivant
        socket.on('game:check_phase', async (data, callback) => {
          try {
            console.log(
              `🔍 [WebSocket] Vérification de la possibilité de passer au tour suivant pour le jeu ${data.gameId}`
            )

            // Récupérer le jeu
            const Game = (await import('#models/game')).default
            const game = await Game.find(data.gameId)

            if (!game) {
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Jeu non trouvé',
                  canAdvance: false,
                })
              }
              return
            }

            // Récupérer la question actuelle
            const Question = (await import('#models/question')).default
            const Vote = (await import('#models/vote')).default

            const question = await Question.query()
              .where('game_id', data.gameId)
              .where('round_number', game.currentRound)
              .first()

            if (!question) {
              if (typeof callback === 'function') {
                callback({
                  success: false,
                  error: 'Question non trouvée',
                  canAdvance: false,
                  currentPhase: game.currentPhase,
                })
              }
              return
            }

            // Vérifier la phase actuelle
            const validPhases = ['results', 'vote']
            const isValidPhase = validPhases.includes(game.currentPhase)

            // Si nous sommes en phase vote, vérifier s'il y a eu des votes
            let hasVotes = true
            if (game.currentPhase === 'vote') {
              const votes = await Vote.query().where('question_id', question.id)
              hasVotes = votes.length > 0
            }

            // On peut avancer si on est en phase résultats OU en phase vote avec des votes
            const canAdvance =
              game.currentPhase === 'results' || (game.currentPhase === 'vote' && hasVotes)

            console.log(
              `🔍 [WebSocket] Statut d'avancement: ${canAdvance ? 'peut avancer' : 'ne peut pas avancer'} (phase: ${game.currentPhase}, votes: ${hasVotes})`
            )

            if (typeof callback === 'function') {
              callback({
                success: true,
                canAdvance,
                currentPhase: game.currentPhase,
                hasVotes,
              })
            }
          } catch (error) {
            console.error(`❌ [WebSocket] Erreur lors de la vérification de phase:`, error)
            if (typeof callback === 'function') {
              callback({
                success: false,
                error: 'Erreur lors de la vérification',
                canAdvance: false,
              })
            }
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
              socket.handshake.query?.userId

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
            if (!validPhases.includes(game.currentPhase)) {
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

            // Tenter le passage au tour suivant
            if (game.currentRound >= game.totalRounds) {
              // C'est la fin du jeu
              // ...existing code...
            } else {
              // Passage au tour suivant
              // ...existing code...

              // Confirmer spécifiquement l'action next_round à tout le monde
              socket.emit('next_round:confirmation', {
                success: true,
                message: 'Nouveau tour démarré',
                gameId: data.gameId,
                round: game.currentRound,
              })

              // ...existing code...
            }
          } catch (error) {
            console.error(`❌ [WebSocket] Erreur lors du passage au tour suivant:`, error)
            if (typeof callback === 'function') {
              callback({
                success: false,
                error: 'Une erreur est survenue lors du passage au tour suivant',
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
