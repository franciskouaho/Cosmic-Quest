import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '@/config/axios';
import UserIdManager from '@/utils/userIdManager';
import api from '@/config/axios';

// Types pour le diagnostic
interface DiagnosticResult {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  socketId: string | null;
  clientsCount?: number;
  rooms?: string[];
  details?: any;
  error?: string;
}

/**
 * Service pour gérer les communications WebSocket avec le serveur
 */
class SocketService {
  private socket: Socket | null = null;
  private activeRooms: Set<string> = new Set();
  private activeGames: Set<string> = new Set();
  private isConnecting: boolean = false;
  private reconnectTimers: NodeJS.Timeout[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private currentRoom: string | null = null;
  private currentGame: string | null = null;
  private lastError: string | null = null;
  private joinRoomAttempts: Record<string, number> = {}; // Pour suivre les tentatives de rejoindre une salle
  private joinRoomMaxAttempts: number = 3;
  private customServerUrl: string | null = null; // Pour supporter différentes URL de serveur

  /**
   * Initialise la connexion Socket.IO et gère la reconnexion
   * @param forceNew Force la création d'une nouvelle connexion même si une existe déjà
   * @returns Une Promise résolue avec la socket
   */
  async getInstanceAsync(forceNew: boolean = false): Promise<Socket> {
    try {
      // Si une connexion est en cours, attendre qu'elle se termine
      if (this.isConnecting) {
        console.log('🔌 Connexion Socket.IO déjà en cours, attente...');
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!this.isConnecting && this.socket) {
              clearInterval(checkInterval);
              resolve(this.socket);
            }
          }, 100);
        });
      }

      // Si la socket existe déjà et est connectée, la retourner (sauf si forceNew est true)
      if (this.socket?.connected && !forceNew) {
        console.log('✅ Socket.IO déjà initialisé et connecté');
        return this.socket;
      }

      this.isConnecting = true;

      // Si la socket existe mais n'est pas connectée, tenter de la reconnecter (sauf si forceNew est true)
      if (this.socket && !forceNew) {
        console.log('🔌 Tentative de reconnexion Socket.IO...');
        this.socket.connect();

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout lors de la reconnexion Socket.IO'));
          }, 5000);

          this.socket!.once('connect', () => {
            clearTimeout(timeout);
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            console.log('🟢 Socket.IO reconnecté, ID:', this.socket!.id);
            resolve(this.socket!);
          });
        });
      }

      // Si forceNew est true ou si la socket n'existe pas, créer une nouvelle connexion
      if (forceNew && this.socket) {
        console.log('🔄 Déconnexion de l\'ancienne socket pour en créer une nouvelle');
        this.socket.disconnect();
        this.socket = null;
      }

      // Récupérer et synchroniser l'ID utilisateur avant la connexion
      const userId = await this.syncUserId();

      // Récupérer le token
      const token = await AsyncStorage.getItem('@auth_token');

      // Déterminer l'URL du serveur (utiliser l'URL personnalisée si définie)
      const serverUrl = this.customServerUrl || SOCKET_URL;

      console.log(`🔌 Tentative de connexion à ${serverUrl} avec options:`, {
        auth: { token, userId },
        autoConnect: true,
        query: { token, userId },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling']
      });

      // Créer une nouvelle instance Socket.IO
      this.socket = io(serverUrl, {
        auth: { token, userId },
        autoConnect: true,
        query: { token, userId },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling']
      });

      // Configurer les gestionnaires d'événements
      return new Promise((resolve, reject) => {
        if (!this.socket) {
          this.isConnecting = false;
          reject(new Error('Échec de la création de la socket'));
          return;
        }

        // Timeout si la connexion prend trop de temps
        const timeout = setTimeout(() => {
          this.isConnecting = false;
          reject(new Error('Timeout lors de la connexion Socket.IO'));
        }, 10000);

        // Gestionnaire de connexion
        this.socket.on('connect', async () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          console.log('🟢 Socket.IO connecté, ID:', this.socket!.id);

          // Tenter de synchroniser l'ID utilisateur avec la connexion WebSocket
          try {
            if (userId) {
              // Synchroniser l'ID utilisateur via l'API
              if (api?.defaults?.headers) {
                api.defaults.headers.userId = userId;
                console.log(`👤 ID utilisateur ${userId} synchronisé avec les en-têtes API`);
              }

              // Envoyer un événement au serveur pour mettre à jour l'association utilisateur-socket
              this.socket!.emit('user:identify', { userId });
              console.log(`👤 Identification utilisateur envoyée au serveur WebSocket`);
            }
          } catch (syncError) {
            console.error('❌ Erreur lors de la synchronisation de l\'ID utilisateur:', syncError);
          }

          // Rejoindre à nouveau les salles actives après reconnexion
          this.reconnectToActiveChannels();

          resolve(this.socket!);
        });

        // Gestionnaire d'erreur de connexion
        this.socket.on('connect_error', (error) => {
          console.error('🔌 Erreur de connexion Socket.IO:', error.message);

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.isConnecting = false;
            reject(error);
          }
        });

        // Gestionnaire de déconnexion
        this.socket.on('disconnect', (reason) => {
          console.log('🔴 Socket.IO déconnecté. Raison:', reason);

          // Tenter de se reconnecter si la déconnexion était due à une erreur réseau
          if (reason === 'io server disconnect' || reason === 'transport close' || reason === 'transport error') {
            this.scheduleReconnect();
          }
        });

        // Confirmation de connexion du serveur
        this.socket.on('connection:success', (data) => {
          console.log('🔌 Confirmation serveur Socket.IO:', data.message);
        });
      });
    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Erreur lors de l\'initialisation de Socket.IO:', error);
      throw error;
    }
  }

  /**
   * Synchronise et récupère l'ID utilisateur de manière fiable
   * @returns L'ID utilisateur sous forme de chaîne ou null si non trouvé
   */
  private async syncUserId(): Promise<string | null> {
    try {
      let userId = await UserIdManager.getUserId();

      if (!userId) {
        // Essayer de récupérer depuis @user_data
        const userDataStr = await AsyncStorage.getItem('@user_data');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          if (userData && userData.id) {
            userId = userData.id;
            await UserIdManager.setUserId(userId);
            console.log(`👤 ID utilisateur récupéré depuis user_data: ${userId}`);
          }
        }

        if (!userId) {
          // Essayer de récupérer depuis @current_user_id
          const currentUserId = await AsyncStorage.getItem('@current_user_id');
          if (currentUserId) {
            userId = currentUserId;
            await UserIdManager.setUserId(userId);
            console.log(`👤 ID utilisateur récupéré depuis current_user_id: ${userId}`);
          }
        }
      }

      if (!userId) {
        console.warn('⚠️ Aucun ID utilisateur disponible pour le socket');
      } else {
        console.log(`👤 ID utilisateur pour Socket.IO: ${userId}`);
        console.log(`👤 [Socket Init] ID utilisateur ${userId} défini`);
      }

      return userId;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des identifiants:', error);
      return null;
    }
  }

  /**
   * Initialise le service en s'assurant qu'une connexion unique est établie
   * @returns Promise<void>
   */
  async initialize(): Promise<void> {
    try {
      // Tenter d'obtenir une instance de socket
      await this.getInstanceAsync();
      console.log('✅ SocketService initialisé avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de SocketService:', error);
      this.lastError = error.message || 'Erreur inconnue';
      throw error;
    }
  }

  /**
   * Définit une URL de serveur personnalisée (utile pour les tests ou environnements différents)
   * @param url L'URL du serveur WebSocket
   */
  setCustomServerUrl(url: string | null): void {
    this.customServerUrl = url;
    console.log(`🔧 URL du serveur WebSocket définie sur: ${url || 'valeur par défaut'}`);
  }

  /**
   * Rejoindre une salle spécifique
   * @param roomCode Code de la salle à rejoindre
   * @returns Promise résolu quand la salle est rejointe ou en cas d'erreur
   */
  async joinRoom(roomCode: string): Promise<void> {
    try {
      console.log(`🚪 SocketService: Tentative de rejoindre la salle ${roomCode}`);

      // Initialiser le compteur de tentatives si nécessaire
      if (!this.joinRoomAttempts[roomCode]) {
        this.joinRoomAttempts[roomCode] = 0;
      }

      // Si trop de tentatives, abandonner
      if (this.joinRoomAttempts[roomCode] >= this.joinRoomMaxAttempts) {
        throw new Error(`Abandon après ${this.joinRoomMaxAttempts} tentatives de rejoindre la salle ${roomCode}`);
      }

      // Incrémenter le compteur de tentatives
      this.joinRoomAttempts[roomCode]++;

      // S'assurer que la connexion socket est établie avant de tenter de rejoindre
      const socket = await this.getInstanceAsync();

      if (!socket.connected) {
        console.log('🔄 Socket non connecté, tentative de reconnexion...');
        await new Promise<void>((resolve, reject) => {
          socket.connect();

          // Ajouter un timeout si la connexion prend trop de temps
          const timeout = setTimeout(() => {
            reject(new Error('Timeout lors de la connexion à la salle'));
          }, 5000);

          socket.once('connect', () => {
            clearTimeout(timeout);
            console.log('🟢 Socket reconnecté avec succès');
            resolve();
          });
        });
      }

      // Envoyer l'événement pour rejoindre la salle
      return new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error('Socket non initialisé'));
          return;
        }

        // Récupérer l'ID utilisateur de manière synchrone si possible
        const userId = UserIdManager.getUserIdSync();

        // Émettre l'événement avec les données nécessaires
        socket.emit('join-room', { 
          roomCode,
          userId,
          timestamp: Date.now()
        });

        // S'abonner à la confirmation de jointure
        const confirmationTimeout = setTimeout(() => {
          socket.off('room:joined');
          console.warn(`⏱️ Timeout lors de la tentative de rejoindre la salle ${roomCode}`);
          
          // Au lieu de rejeter immédiatement, essayer de vérifier l'état de la connexion
          this.checkConnectionStatus().then(() => {
            reject(new Error(`Timeout lors de la tentative de rejoindre la salle ${roomCode}`));
          });
        }, 5000);

        // Gestionnaire pour la confirmation
        socket.once('room:joined', (data) => {
          clearTimeout(confirmationTimeout);

          if (data && data.roomCode === roomCode) {
            console.log(`🚪 Socket confirmé: salle ${roomCode} rejointe avec succès`);
            this.activeRooms.add(roomCode);
            this.currentRoom = roomCode;
            
            // Réinitialiser le compteur de tentatives en cas de succès
            this.joinRoomAttempts[roomCode] = 0;
            
            resolve();
          } else {
            reject(new Error('Données de confirmation incorrectes'));
          }
        });

        console.log(`📤 Demande de rejoindre la salle ${roomCode} envoyée`);
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de rejoindre la salle ${roomCode}:`, error);
      this.lastError = error.message || 'Erreur inconnue';
      
      // En cas d'erreur de timeout, essayer à nouveau avec un délai exponentiel
      if (error.message?.includes('Timeout') && this.joinRoomAttempts[roomCode] < this.joinRoomMaxAttempts) {
        const delay = Math.min(Math.pow(2, this.joinRoomAttempts[roomCode]) * 500, 5000);
        console.log(`🔄 Nouvelle tentative de rejoindre la salle ${roomCode} dans ${delay}ms (tentative ${this.joinRoomAttempts[roomCode]}/${this.joinRoomMaxAttempts})...`);
        
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this.joinRoom(roomCode).then(resolve).catch(reject);
          }, delay);
        });
      }
      
      throw error;
    }
  }

  /**
   * Rejoint une salle avec une gestion automatique des erreurs et des nouvelles tentatives
   * @param roomCode Code de la salle à rejoindre
   * @param maxAttempts Nombre maximum de tentatives (par défaut: 3)
   */
  async reconnectToRoom(roomCode: string, maxAttempts: number = 3): Promise<boolean> {
    let attempts = 0;
    let lastError = null;

    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 Tentative ${attempts + 1}/${maxAttempts} de reconnexion à la salle ${roomCode}`);
        await this.joinRoom(roomCode);
        return true; // Succès
      } catch (error) {
        lastError = error;
        attempts++;
        
        if (attempts < maxAttempts) {
          // Attendre avec un délai exponentiel avant la prochaine tentative
          const delay = Math.min(Math.pow(2, attempts) * 500, 5000);
          console.log(`⏱️ Attente de ${delay}ms avant la prochaine tentative...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ Échec de reconnexion à la salle ${roomCode} après ${maxAttempts} tentatives`);
    console.error('Dernière erreur:', lastError);
    return false; // Échec
  }

  /**
   * Vérifie l'état de la connexion et tente de résoudre les problèmes courants
   */
  async checkConnectionStatus(): Promise<void> {
    if (!this.socket) {
      console.log('🔍 Socket non initialisée, initialisation...');
      await this.initialize();
      return;
    }

    if (!this.socket.connected) {
      console.log('🔍 Socket non connectée, tentative de reconnexion...');
      this.socket.connect();
      
      // Attendre un court instant pour voir si la connexion s'établit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⏱️ La reconnexion n\'a pas été immédiate');
          resolve();
        }, 1000);

        this.socket!.once('connect', () => {
          clearTimeout(timeout);
          console.log('🟢 Socket reconnectée avec succès');
          resolve();
        });
      });
    }

    // Journaliser l'état actuel
    this.logDebugInfo();
  }

  /**
   * Journalise les informations de débogage sur l'état actuel
   */
  logDebugInfo(): void {
    const debugInfo = {
      isConnected: this.socket?.connected || false,
      socketId: this.socket?.id,
      activeRooms: Array.from(this.activeRooms),
      activeGames: Array.from(this.activeGames),
      currentRoom: this.currentRoom,
      currentGame: this.currentGame,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
    };
    
    console.log('📊 État actuel du service WebSocket:', debugInfo);
  }

  /**
   * Quitter une salle spécifique
   * @param roomCode Code de la salle à quitter
   * @returns Promise résolu quand la salle est quittée ou en cas d'erreur
   */
  async leaveRoom(roomCode: string): Promise<void> {
    try {
      console.log(`🚪 SocketService: Tentative de quitter la salle ${roomCode}`);

      // S'assurer que la connexion socket est établie
      const socket = await this.getInstanceAsync();

      if (!socket.connected) {
        console.log('Socket non connecté, sortie silencieuse...');
        this.activeRooms.delete(roomCode);
        if (this.currentRoom === roomCode) {
          this.currentRoom = null;
        }
        return;
      }

      // Envoyer l'événement pour quitter la salle
      return new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error('Socket non initialisé'));
          return;
        }

        // Émettre l'événement
        socket.emit('leave-room', { roomCode });

        // S'abonner à la confirmation
        const confirmationTimeout = setTimeout(() => {
          socket.off('room:left');
          // On ne rejette pas la promesse en cas de timeout, on effectue juste un nettoyage local
          console.log(`⚠️ Pas de confirmation de sortie de salle ${roomCode}, nettoyage local`);
          this.activeRooms.delete(roomCode);
          if (this.currentRoom === roomCode) {
            this.currentRoom = null;
          }
          resolve();
        }, 3000);

        socket.once('room:left', (data) => {
          clearTimeout(confirmationTimeout);

          if (data && data.roomCode === roomCode) {
            console.log(`🚪 Salle ${roomCode} quittée avec succès`);
            this.activeRooms.delete(roomCode);
            if (this.currentRoom === roomCode) {
              this.currentRoom = null;
            }
            resolve();
          } else {
            console.warn('⚠️ Données de confirmation incorrectes lors du départ');
            // Nettoyage local même en cas de données incorrectes
            this.activeRooms.delete(roomCode);
            if (this.currentRoom === roomCode) {
              this.currentRoom = null;
            }
            resolve();
          }
        });

        console.log(`📤 Demande de quitter la salle ${roomCode} envoyée`);
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de quitter la salle ${roomCode}:`, error);

      // Nettoyage local même en cas d'erreur
      this.activeRooms.delete(roomCode);
      if (this.currentRoom === roomCode) {
        this.currentRoom = null;
      }
      this.lastError = error.message || 'Erreur inconnue';

      throw error;
    }
  }

  /**
   * Quitter un canal de jeu spécifique
   * @param gameId ID du jeu à quitter
   * @returns Promise résolu quand le jeu est quitté ou en cas d'erreur
   */
  async leaveGameChannel(gameId: string): Promise<void> {
    try {
      console.log(`🎮 SocketService: Tentative de quitter le jeu ${gameId}`);

      // S'assurer que la connexion socket est établie
      const socket = await this.getInstanceAsync();

      if (!socket.connected) {
        console.log('Socket non connecté, sortie silencieuse du canal de jeu...');
        this.activeGames.delete(gameId);
        if (this.currentGame === gameId) {
          this.currentGame = null;
        }
        return;
      }

      // Envoyer l'événement pour quitter le jeu
      return new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error('Socket non initialisé'));
          return;
        }

        // Émettre l'événement
        socket.emit('leave-game', { gameId });

        // S'abonner à la confirmation
        const confirmationTimeout = setTimeout(() => {
          socket.off('game:left');
          // On ne rejette pas la promesse en cas de timeout, on effectue juste un nettoyage local
          console.log(`⚠️ Pas de confirmation de sortie du jeu ${gameId}, nettoyage local`);
          this.activeGames.delete(gameId);
          if (this.currentGame === gameId) {
            this.currentGame = null;
          }
          resolve();
        }, 3000);

        socket.once('game:left', (data) => {
          clearTimeout(confirmationTimeout);

          if (data && data.gameId === gameId) {
            console.log(`🎮 Jeu ${gameId} quitté avec succès`);
            this.activeGames.delete(gameId);
            if (this.currentGame === gameId) {
              this.currentGame = null;
            }
            resolve();
          } else {
            console.warn('⚠️ Données de confirmation incorrectes lors du départ du jeu');
            // Nettoyage local même en cas de données incorrectes
            this.activeGames.delete(gameId);
            if (this.currentGame === gameId) {
              this.currentGame = null;
            }
            resolve();
          }
        });

        console.log(`📤 Demande de quitter le jeu ${gameId} envoyée`);
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de quitter le jeu ${gameId}:`, error);

      // Nettoyage local même en cas d'erreur
      this.activeGames.delete(gameId);
      if (this.currentGame === gameId) {
        this.currentGame = null;
      }
      this.lastError = error.message || 'Erreur inconnue';

      // Ne pas propager l'erreur pour éviter de bloquer la navigation
      console.log(`🧹 Nettoyage local effectué pour le jeu ${gameId} malgré l'erreur`);
      return Promise.resolve();
    }
  }

  /**
   * Rejoindre un canal de jeu spécifique
   * @param gameId ID du jeu à rejoindre
   * @returns Promise résolu quand le jeu est rejoint ou en cas d'erreur
   */
  async joinGameChannel(gameId: string): Promise<void> {
    try {
      console.log(`🎮 SocketService: Tentative de rejoindre le jeu ${gameId}`);

      // S'assurer que la connexion socket est établie
      const socket = await this.getInstanceAsync();

      // Envoyer l'événement pour rejoindre le jeu
      return new Promise<void>((resolve, reject) => {
        if (!socket) {
          reject(new Error('Socket non initialisé'));
          return;
        }

        // Récupérer l'ID utilisateur de manière synchrone si possible
        const userId = UserIdManager.getUserIdSync();

        // Émettre l'événement
        socket.emit('join-game', { 
          gameId,
          userId,
          timestamp: Date.now()
        });

        // S'abonner à la confirmation
        const confirmationTimeout = setTimeout(() => {
          socket.off('game:joined');
          reject(new Error(`Timeout lors de la tentative de rejoindre le jeu ${gameId}`));
        }, 5000);

        socket.once('game:joined', (data) => {
          clearTimeout(confirmationTimeout);

          if (data && data.gameId === gameId) {
            console.log(`🎮 Socket confirmé: jeu ${gameId} rejoint avec succès`);
            this.activeGames.add(gameId);
            this.currentGame = gameId;
            resolve();
          } else {
            reject(new Error('Données de confirmation incorrectes'));
          }
        });

        console.log(`📤 Demande de rejoindre le jeu ${gameId} envoyée`);
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de rejoindre le jeu ${gameId}:`, error);
      this.lastError = error.message || 'Erreur inconnue';
      throw error;
    }
  }

  /**
   * Force la vérification de phase d'un jeu
   * @param gameId ID du jeu
   * @returns Promise<boolean> résultat de l'opération
   */
  async forcePhaseCheck(gameId: string): Promise<boolean> {
    try {
      console.log(`🔍 Vérification forcée de phase pour le jeu ${gameId}`);
      
      // S'assurer que la connexion est établie
      const socket = await this.getInstanceAsync();

      // Émettre l'événement de vérification
      return new Promise<boolean>((resolve) => {
        socket.emit('game:force_check', { gameId });
        
        // Réussir après un court délai pour permettre au serveur de traiter la demande
        setTimeout(() => {
          resolve(true);
        }, 1000);
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification forcée de phase:`, error);
      return false;
    }
  }

  /**
   * Envoie un événement pour passer au tour suivant
   * @param gameId ID du jeu
   * @param force Forcer le passage même si toutes les conditions ne sont pas remplies (hôte uniquement)
   * @returns Promise<boolean> résultat de l'opération
   */
  async nextRound(gameId: string, force: boolean = false): Promise<boolean> {
    try {
      console.log(`🎮 Demande de passage au tour suivant pour ${gameId} (force=${force})`);
      
      // S'assurer que la connexion est établie
      const socket = await this.getInstanceAsync();

      // Envoyer l'événement de passage au tour suivant
      return new Promise<boolean>((resolve, reject) => {
        socket.emit('game:next_round', { gameId, forceAdvance: force }, (response: any) => {
          if (response && response.success) {
            console.log(`✅ Passage au tour suivant réussi`);
            resolve(true);
          } else {
            const errorMessage = response?.error || 'Échec du passage au tour suivant';
            console.error(`❌ Échec du passage au tour suivant: ${errorMessage}`);
            reject(new Error(errorMessage));
          }
        });

        // En cas d'absence de réponse, échouer après un délai
        setTimeout(() => {
          reject(new Error('Pas de réponse du serveur pour le passage au tour suivant'));
        }, 5000);
      });
    } catch (error) {
      console.error(`❌ Erreur lors du passage au tour suivant:`, error);
      throw error;
    }
  }

  /**
   * Soumet une réponse à une question
   * @param data Données de la réponse (gameId, questionId, content)
   * @returns Promise<boolean> résultat de l'opération
   */
  async submitAnswer(data: { gameId: string; questionId: string; content: string }): Promise<boolean> {
    try {
      console.log(`🎮 Soumission de réponse pour le jeu ${data.gameId}`);
      
      // S'assurer que la connexion est établie
      const socket = await this.getInstanceAsync();

      // Récupérer l'userId
      const userId = await UserIdManager.getUserId();

      // Envoyer l'événement de soumission de réponse
      return new Promise<boolean>((resolve, reject) => {
        // Utiliser le bon nom d'événement 'game:submit_answer' au lieu de 'game:submit-answer'
        socket.emit('game:submit_answer', { 
          ...data,
          userId,
          timestamp: Date.now()
        }, (response: any) => {
          if (response && response.success) {
            console.log(`✅ Réponse soumise avec succès`);
            resolve(true);
          } else {
            const errorMessage = response?.error || 'Échec de la soumission de réponse';
            console.error(`❌ Échec de la soumission de réponse: ${errorMessage}`);
            reject(new Error(errorMessage));
          }
        });

        // En cas d'absence de réponse, échouer après un délai
        setTimeout(() => {
          reject(new Error('Pas de réponse du serveur pour la soumission de réponse'));
        }, 5000);
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la soumission de réponse:`, error);
      throw error;
    }
  }

  /**
   * Soumet un vote pour une réponse
   * @param data Données du vote (gameId, answerId, questionId)
   * @returns Promise<boolean> résultat de l'opération
   */
  async submitVote(data: { gameId: string; answerId: string; questionId: string }): Promise<boolean> {
    try {
      console.log(`🎮 Soumission de vote pour le jeu ${data.gameId}, réponse ${data.answerId}`);
      
      // S'assurer que la connexion est établie
      const socket = await this.getInstanceAsync();

      // Récupérer l'userId
      const userId = await UserIdManager.getUserId();

      // Envoyer l'événement de soumission de vote
      return new Promise<boolean>((resolve, reject) => {
        // Utiliser le bon nom d'événement 'game:submit_vote' au lieu de 'game:submit-vote'
        socket.emit('game:submit_vote', { 
          ...data,
          userId,
          timestamp: Date.now()
        }, (response: any) => {
          if (response && response.success) {
            console.log(`✅ Vote soumis avec succès`);
            resolve(true);
          } else {
            const errorMessage = response?.error || 'Échec de la soumission du vote';
            console.error(`❌ Échec de la soumission du vote: ${errorMessage}`);
            reject(new Error(errorMessage));
          }
        });

        // En cas d'absence de réponse, échouer après un délai
        setTimeout(() => {
          reject(new Error('Pas de réponse du serveur pour la soumission du vote'));
        }, 5000);
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la soumission du vote:`, error);
      throw error;
    }
  }

  /**
   * Rejoindre à nouveau les salles et jeux actifs après reconnexion
   */
  private async reconnectToActiveChannels(): Promise<void> {
    console.log('🔄 Reconnexion aux canaux actifs...');
    
    try {
      // S'assurer que l'ID utilisateur est disponible
      const userId = await UserIdManager.getUserId();
      if (!userId) {
        console.warn('⚠️ Reconnexion sans ID utilisateur');
      }
      
      // Rejoindre les salles
      const rooms = Array.from(this.activeRooms);
      for (const roomCode of rooms) {
        console.log(`🔌 Reconnexion à la salle ${roomCode}`);
        
        try {
          this.socket?.emit('join-room', { roomCode, userId });
        } catch (roomError) {
          console.error(`❌ Erreur lors de la reconnexion à la salle ${roomCode}:`, roomError);
        }
      }
      
      // Rejoindre les jeux
      const games = Array.from(this.activeGames);
      for (const gameId of games) {
        console.log(`🔌 Reconnexion au jeu ${gameId}`);
        
        try {
          this.socket?.emit('join-game', { gameId, userId });
        } catch (gameError) {
          console.error(`❌ Erreur lors de la reconnexion au jeu ${gameId}:`, gameError);
        }
      }
      
      console.log(`✅ Tentative de reconnexion effectuée pour ${rooms.length} salles et ${games.length} jeux`);
    } catch (error) {
      console.error('❌ Erreur lors de la tentative de reconnexion:', error);
      
      // Réessayer après un court délai
      setTimeout(() => {
        this.reconnectToActiveChannels().catch(console.error);
      }, 1000);
    }
  }

  /**
   * Planifie une tentative de reconnexion avec délai exponentiel
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('⚠️ Nombre maximum de tentatives de reconnexion atteint');
      return;
    }

    const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 30000);
    console.log(`⏱️ Planification de la reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

    const timer = setTimeout(async () => {
      try {
        await this.getInstanceAsync();
        console.log('🟢 Reconnexion réussie');
      } catch (error) {
        console.error('❌ Échec de la reconnexion:', error);
        this.reconnectAttempts++;
        this.scheduleReconnect();
      }
    }, delay);

    this.reconnectTimers.push(timer);
  }

  /**
   * Diagnostic de la connexion WebSocket
   * @returns DiagnosticResult contenant les informations sur l'état de la connexion
   */
  diagnose(): DiagnosticResult {
    if (!this.socket) {
      return {
        status: 'disconnected',
        socketId: null,
        details: {
          connectionState: 'uninitialized',
          currentRoom: this.currentRoom,
          currentGame: this.currentGame,
          lastError: this.lastError
        },
        error: 'Socket non initialisé'
      };
    }

    return {
      status: this.socket.connected ? 'connected' : 'disconnected',
      socketId: this.socket.id || null,
      rooms: Array.from(this.activeRooms),
      details: {
        connectionState: this.socket.connected ? 'connected' : (this.isConnecting ? 'connecting' : 'disconnected'),
        currentRoom: this.currentRoom,
        currentGame: this.currentGame,
        lastError: this.lastError
      }
    };
  }

  /**
   * Vérifie si la socket est connectée
   * @returns true si connecté, false sinon
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Assure une connexion socket pour un jeu spécifique, avec reconnexion si nécessaire
   * @param gameId ID du jeu auquel se connecter
   * @returns Promise<boolean> avec le résultat de l'opération
   */
  async ensureSocketConnection(gameId: string): Promise<boolean> {
    try {
      const socket = await this.getInstanceAsync();

      if (!socket.connected) {
        console.log('🔄 Socket non connecté, reconnexion...');
        socket.connect();

        // Attendre la connexion
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout lors de la reconnexion WebSocket'));
          }, 5000);

          socket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      // Rejoindre le canal de jeu si spécifié
      if (gameId) {
        await this.joinGameChannel(gameId);
      }

      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'assurance de la connexion WebSocket:', error);
      this.lastError = error.message || 'Erreur inconnue';
      return false;
    }
  }
}

// Exporter l'instance singleton
export default new SocketService();