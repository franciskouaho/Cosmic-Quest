import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { SOCKET_URL } from '@/config/axios';
import UserIdManager from '@/utils/userIdManager';

// Types pour le diagnostic
interface DiagnosticResult {
  initialized: boolean;
  connected: boolean;
  pending: boolean;
  socketId?: string;
  rooms?: string[];
  url?: string;
  activeChannels: {
    rooms: string[];
    games: string[];
  };
  connectionDetails: {
    transport?: string;
    protocol?: number;
    reconnecting?: boolean;
    reconnectAttempts?: number;
  };
}

export default class SocketService {
  private static instance: Socket | null = null;
  private static isInitializing: boolean = false;
  private static initializationPromise: Promise<Socket> | null = null;
  private static activeRooms: Set<string> = new Set();
  private static activeGames: Set<string> = new Set();
  private static reconnectAttempts: number = 0;
  private static maxReconnectAttempts: number = 5;
  private static reconnectTimeout: NodeJS.Timeout | null = null;

  // Initialisation du service de socket avec gestion de promesse pour éviter les courses de condition
  public static initialize(): Promise<Socket> {
    // Si déjà initialisé et connecté, retourner l'instance existante
    if (SocketService.instance && SocketService.instance.connected) {
      console.log('✅ Socket.IO déjà initialisé et connecté');
      return Promise.resolve(SocketService.instance);
    }

    // Si déjà en cours d'initialisation, retourner la promesse existante
    if (SocketService.isInitializing && SocketService.initializationPromise) {
      console.log('⏳ Socket.IO initialisation déjà en cours, attente...');
      return SocketService.initializationPromise;
    }

    // Marquer comme en cours d'initialisation et créer une nouvelle promesse
    SocketService.isInitializing = true;
    
    SocketService.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        console.log('🔌 Initialisation de la connexion WebSocket...');

        // Récupérer le token pour l'authentification
        let token;
        let userId;
        try {
          // Récupérer le token
          token = await AsyncStorage.getItem('@auth_token');
          
          // Récupérer et synchroniser l'ID utilisateur
          userId = await UserIdManager.getUserId();
          if (userId) {
            console.log(`🔌 Socket utilisant l'ID utilisateur: ${userId}`);
          } else {
            console.warn('⚠️ Aucun ID utilisateur disponible pour le socket');
            // Afficher le diagnostic pour aider au débogage
            await UserIdManager.debugUserIds();
          }
        } catch (error) {
          console.error('❌ Erreur lors de la récupération des identifiants:', error);
        }

        // Configuration sécurisée avec valeurs par défaut
        const options = {
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          autoConnect: true,
          auth: {
            token: token || undefined,
            userId: userId || undefined
          },
          query: {
            token: token || undefined,
            userId: userId || undefined
          },
          transports: ['websocket', 'polling']
        };

        console.log(`🔌 Tentative de connexion à ${SOCKET_URL} avec options:`, options);

        // Créer l'instance de Socket.IO
        SocketService.instance = io(SOCKET_URL, options);

        // Configurer les écouteurs d'événements de base
        SocketService.instance.on('connect', () => {
          console.log(`🟢 Socket.IO connecté, ID: ${SocketService.instance?.id}`);
          SocketService.reconnectAttempts = 0;
          
          // Rejoindre à nouveau les salles et jeux actifs après reconnexion
          SocketService.rejoinActiveChannels();

          resolve(SocketService.instance!);
        });

        SocketService.instance.on('connect_error', (error) => {
          console.error('🔌 Erreur de connexion Socket.IO:', error.message);
          if (SocketService.reconnectAttempts >= SocketService.maxReconnectAttempts) {
            reject(new Error(`Échec de la connexion après ${SocketService.maxReconnectAttempts} tentatives: ${error.message}`));
          }
          SocketService.reconnectAttempts++;
        });

        SocketService.instance.on('disconnect', (reason) => {
          console.log(`🔴 Socket.IO déconnecté. Raison: ${reason}`);
          if (reason === 'io server disconnect' || reason === 'io client disconnect') {
            // La déconnexion est intentionnelle, ne pas reconnecter automatiquement
            console.log('⚠️ Déconnexion manuelle, pas de tentative de reconnexion automatique');
          } else {
            // Tenter de se reconnecter après un délai
            if (SocketService.reconnectTimeout) {
              clearTimeout(SocketService.reconnectTimeout);
            }
            SocketService.reconnectTimeout = setTimeout(() => {
              SocketService.handleReconnect();
            }, 3000);
          }
        });

        SocketService.instance.on('error', (error) => {
          console.error('🔌 Erreur Socket.IO:', error);
          reject(error);
        });

        // Gestionnaire spécifique pour les confirmations de jointure aux salles
        SocketService.instance.on('room:joined', (data) => {
          console.log(`🚪 Socket confirmé: salle ${data.roomCode} rejointe avec succès`);
        });

        SocketService.instance.on('room:left', (data) => {
          console.log(`🚪 Socket confirmé: salle ${data.roomCode} quittée avec succès`);
        });

        // Gestionnaire pour les confirmations de jointure aux jeux
        SocketService.instance.on('game:joined', (data) => {
          console.log(`🎮 Socket confirmé: jeu ${data.gameId} rejoint avec succès`);
        });

        SocketService.instance.on('game:left', (data) => {
          console.log(`🎮 Socket confirmé: jeu ${data.gameId} quitté avec succès`);
        });

        // Gestionnaire de confirmation de connexion Socket.IO
        SocketService.instance.on('connection:success', (data) => {
          console.log(`🔌 Confirmation serveur Socket.IO:`, data.message);
        });

        // Gestion des pings/pongs pour maintenir la connexion active
        SocketService.instance.on('pong', (data) => {
          console.log('🏓 Pong reçu du serveur:', data);
        });

        // Si le socket n'est pas connecté après 5 secondes, rejeter la promesse
        const connectionTimeout = setTimeout(() => {
          if (!SocketService.instance?.connected) {
            console.error('⏱️ Délai de connexion Socket.IO expiré');
            reject(new Error('Délai de connexion expiré'));
          }
        }, 5000);

        // Annuler le timeout si connecté avec succès
        if (SocketService.instance.connected) {
          clearTimeout(connectionTimeout);
          resolve(SocketService.instance);
        }

      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de Socket.IO:', error);
        SocketService.isInitializing = false;
        reject(error);
      } finally {
        // Réinitialiser le flag après l'initialisation
        setTimeout(() => {
          SocketService.isInitializing = false;
        }, 1000);
      }
    });
    
    return SocketService.initializationPromise;
  }

  // Obtenir l'instance existante ou en initialiser une nouvelle de manière asynchrone
  public static async getInstanceAsync(): Promise<Socket> {
    try {
      return await SocketService.initialize();
    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention de l\'instance Socket.IO:', error);
      throw error;
    }
  }

  // Obtenir l'instance existante de manière synchrone (peut retourner null)
  public static getInstance(): Socket {
    if (!SocketService.instance) {
      console.warn('⚠️ getInstance appelé mais l\'instance Socket.IO n\'existe pas encore');
      SocketService.initialize().catch(err => {
        console.error('❌ Erreur lors de l\'initialisation de Socket.IO dans getInstance:', err);
      });
      throw new Error('Socket.IO non initialisé');
    }
    return SocketService.instance;
  }

  // Vérifier si le socket est connecté
  public static isConnected(): boolean {
    return !!SocketService.instance && SocketService.instance.connected;
  }

  // Rejoindre une salle avec confirmation et timeout
  public static async joinRoom(roomCode: string): Promise<void> {
    if (!roomCode) {
      console.error('❌ Code de salle non fourni');
      return;
    }

    try {
      console.log(`🚪 Tentative de rejoindre la salle ${roomCode}`);
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise((resolve, reject) => {
        try {
          // Ajouter un écouteur temporaire pour la confirmation de jointure
          const onJoinConfirmation = (data: any) => {
            if (data && data.roomCode === roomCode) {
              console.log(`✅ Confirmation de jointure à la salle ${roomCode} reçue`);
              SocketService.activeRooms.add(roomCode);
              socket.off('room:joined', onJoinConfirmation);
              clearTimeout(timeout);
              resolve();
            }
          };

          // Définir un timeout pour la jointure
          const timeout = setTimeout(() => {
            socket.off('room:joined', onJoinConfirmation);
            console.warn(`⚠️ Pas de confirmation de jointure à la salle ${roomCode} après 5 secondes, mais on continue`);
            SocketService.activeRooms.add(roomCode); // On considère qu'on a rejoint la salle quand même
            resolve();
          }, 5000);

          // Écouter l'événement de confirmation
          socket.on('room:joined', onJoinConfirmation);
          
          // Envoyer la demande de jointure
          socket.emit('join-room', { roomCode });
          console.log(`📤 Demande d'inscription envoyée pour la salle: ${roomCode}`);
          
        } catch (innerError) {
          console.error(`❌ Erreur lors de la tentative de jointure à la salle ${roomCode}:`, innerError);
          reject(innerError);
        }
      });
      
    } catch (error) {
      console.error(`❌ Erreur lors de la jointure à la salle ${roomCode}:`, error);
      throw error;
    }
  }

  // Quitter une salle
  public static async leaveRoom(roomCode: string): Promise<void> {
    if (!roomCode) {
      console.error('❌ Code de salle non fourni');
      return;
    }

    try {
      console.log(`🚪 Tentative de quitter la salle ${roomCode}`);
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise((resolve, reject) => {
        try {
          // Ajouter un écouteur temporaire pour la confirmation
          const onLeaveConfirmation = (data: any) => {
            if (data && data.roomCode === roomCode) {
              console.log(`✅ Confirmation de départ de la salle ${roomCode} reçue`);
              SocketService.activeRooms.delete(roomCode);
              socket.off('room:left', onLeaveConfirmation);
              clearTimeout(timeout);
              resolve();
            }
          };

          // Définir un timeout pour la réception de confirmation
          const timeout = setTimeout(() => {
            socket.off('room:left', onLeaveConfirmation);
            console.warn(`⚠️ Pas de confirmation de sortie de la salle ${roomCode} après 3 secondes, mais on continue`);
            SocketService.activeRooms.delete(roomCode); // On considère qu'on a quitté la salle quand même
            resolve();
          }, 3000);

          // Écouter l'événement de confirmation
          socket.on('room:left', onLeaveConfirmation);
          
          // Envoyer la demande de départ
          socket.emit('leave-room', { roomCode });
          console.log(`📤 Demande de désinscription envoyée pour la salle: ${roomCode}`);
          
        } catch (innerError) {
          console.error(`❌ Erreur lors de la tentative de quitter la salle ${roomCode}:`, innerError);
          reject(innerError);
        }
      });
      
    } catch (error) {
      console.error(`❌ Erreur lors du départ de la salle ${roomCode}:`, error);
      throw error;
    }
  }

  // Rejoindre un canal de jeu
  public static async joinGameChannel(gameId: string): Promise<void> {
    if (!gameId) {
      console.error('❌ ID de jeu non fourni');
      return;
    }

    try {
      console.log(`🎮 Tentative de rejoindre le jeu ${gameId}`);
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise((resolve, reject) => {
        try {
          // Ajouter un écouteur temporaire pour la confirmation
          const onJoinConfirmation = (data: any) => {
            if (data && data.gameId.toString() === gameId.toString()) {
              console.log(`✅ Confirmation de jointure au jeu ${gameId} reçue`);
              SocketService.activeGames.add(gameId);
              socket.off('game:joined', onJoinConfirmation);
              clearTimeout(timeout);
              resolve();
            }
          };

          // Définir un timeout pour la réception de confirmation
          const timeout = setTimeout(() => {
            socket.off('game:joined', onJoinConfirmation);
            console.warn(`⚠️ Pas de confirmation de jointure au jeu ${gameId} après 5 secondes, mais on continue`);
            SocketService.activeGames.add(gameId); // On considère qu'on a rejoint le jeu quand même
            resolve();
          }, 5000);

          // Écouter l'événement de confirmation
          socket.on('game:joined', onJoinConfirmation);
          
          // Envoyer la demande de jointure
          socket.emit('join-game', { gameId });
          console.log(`📤 Demande d'inscription envoyée pour le jeu: ${gameId}`);
          
        } catch (innerError) {
          console.error(`❌ Erreur lors de la tentative de jointure au jeu ${gameId}:`, innerError);
          reject(innerError);
        }
      });
      
    } catch (error) {
      console.error(`❌ Erreur lors de la jointure au jeu ${gameId}:`, error);
      throw error;
    }
  }

  // Quitter un canal de jeu
  public static async leaveGameChannel(gameId: string): Promise<void> {
    if (!gameId) {
      console.error('❌ ID de jeu non fourni');
      return;
    }

    try {
      console.log(`🎮 Tentative de quitter le jeu ${gameId}`);
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise((resolve, reject) => {
        try {
          // Ajouter un écouteur temporaire pour la confirmation
          const onLeaveConfirmation = (data: any) => {
            if (data && data.gameId.toString() === gameId.toString()) {
              console.log(`✅ Confirmation de départ du jeu ${gameId} reçue`);
              SocketService.activeGames.delete(gameId);
              socket.off('game:left', onLeaveConfirmation);
              clearTimeout(timeout);
              resolve();
            }
          };

          // Définir un timeout pour la réception de confirmation
          const timeout = setTimeout(() => {
            socket.off('game:left', onLeaveConfirmation);
            console.warn(`⚠️ Pas de confirmation de sortie du jeu ${gameId} après 3 secondes, mais on continue`);
            SocketService.activeGames.delete(gameId); // On considère qu'on a quitté le jeu quand même
            resolve();
          }, 3000);

          // Écouter l'événement de confirmation
          socket.on('game:left', onLeaveConfirmation);
          
          // Envoyer la demande de départ
          socket.emit('leave-game', { gameId });
          console.log(`📤 Demande de désinscription envoyée pour le jeu: ${gameId}`);
          
        } catch (innerError) {
          console.error(`❌ Erreur lors de la tentative de quitter le jeu ${gameId}:`, innerError);
          reject(innerError);
        }
      });
      
    } catch (error) {
      console.error(`❌ Erreur lors du départ du jeu ${gameId}:`, error);
      throw error;
    }
  }

  // Rejoindre à nouveau tous les canaux actifs après une reconnexion
  public static async rejoinActiveChannels(): Promise<void> {
    try {
      if (!SocketService.instance || !SocketService.instance.connected) {
        console.warn('⚠️ Socket non connecté, impossible de rejoindre les canaux actifs');
        return;
      }

      console.log('🔄 Reconnexion aux canaux actifs...');
      
      // Rejoindre à nouveau toutes les salles actives
      for (const roomCode of SocketService.activeRooms) {
        try {
          console.log(`🔌 Reconnexion à la salle ${roomCode}`);
          SocketService.instance.emit('join-room', { roomCode });
        } catch (error) {
          console.error(`❌ Erreur lors de la reconnexion à la salle ${roomCode}:`, error);
        }
      }
      
      // Rejoindre à nouveau tous les jeux actifs
      for (const gameId of SocketService.activeGames) {
        try {
          console.log(`🔌 Reconnexion au jeu ${gameId}`);
          SocketService.instance.emit('join-game', { gameId });
        } catch (error) {
          console.error(`❌ Erreur lors de la reconnexion au jeu ${gameId}:`, error);
        }
      }
      
      console.log(`✅ Tentative de reconnexion effectuée pour ${SocketService.activeRooms.size} salles et ${SocketService.activeGames.size} jeux`);
    } catch (error) {
      console.error('❌ Erreur lors de la reconnexion aux canaux actifs:', error);
    }
  }

  // Méthode appelée pour gérer la reconnexion automatique
  private static async handleReconnect() {
    try {
      // Vérifier la connectivité internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('🌐 Pas de connexion Internet. Abandon de la reconnexion.');
        return;
      }

      // Synchroniser l'ID utilisateur avant de recréer l'instance
      await UserIdManager.syncUserId();
      
      console.log('🔄 Tentative de reconnexion WebSocket...');
      
      // Réinitialiser les flags pour permettre une nouvelle initialisation
      SocketService.isInitializing = false;
      SocketService.initializationPromise = null;
      
      // Forcer la création d'une nouvelle instance
      SocketService.instance = null;
      
      // Recréer l'instance
      await SocketService.initialize();
      
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de reconnexion:', error);
      
      // Programmer une nouvelle tentative après un délai
      if (SocketService.reconnectAttempts < SocketService.maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, SocketService.reconnectAttempts), 30000);
        console.log(`🔄 Nouvelle tentative de reconnexion dans ${delay / 1000} secondes...`);
        
        if (SocketService.reconnectTimeout) {
          clearTimeout(SocketService.reconnectTimeout);
        }
        
        SocketService.reconnectTimeout = setTimeout(() => {
          SocketService.handleReconnect();
        }, delay);
        
        SocketService.reconnectAttempts++;
      } else {
        console.error(`❌ Abandon des tentatives de reconnexion après ${SocketService.maxReconnectAttempts} essais.`);
      }
    }
  }

  // Vérifier et assurer la connexion WebSocket pour un jeu spécifique
  public static async ensureSocketConnection(gameId: string): Promise<void> {
    try {
      // Vérifier si l'instance existe et est connectée
      if (SocketService.instance && SocketService.instance.connected) {
        console.log(`🔌 Diagnostic WebSocket: connected`);
        
        // Si le jeu n'est pas enregistré, le rejoindre
        if (gameId && !SocketService.activeGames.has(gameId)) {
          console.log(`🔌 Reconnexion WebSocket au jeu ${gameId}`);
          await SocketService.joinGameChannel(gameId);
          console.log(`✅ Reconnexion WebSocket réussie pour le jeu ${gameId}`);
        }
      } else {
        // Initialiser une nouvelle connexion
        console.log(`🔌 Diagnostic WebSocket: not connected`);
        await SocketService.initialize();
        
        if (gameId) {
          console.log(`🔌 Initialisation de la connexion WebSocket pour le jeu ${gameId}`);
          await SocketService.joinGameChannel(gameId);
          console.log(`✅ Connexion WebSocket initialisée pour le jeu ${gameId}`);
        }
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la vérification de la connexion WebSocket:`, error);
      // Ne pas propager l'erreur pour éviter de bloquer le processus de chargement
    }
  }

  /**
   * Diagnostique l'état actuel de la connexion Socket.IO
   */
  public static diagnose(): DiagnosticResult {
    const socket = SocketService.instance;
    
    return {
      initialized: !!socket,
      connected: !!socket?.connected,
      pending: SocketService.isInitializing,
      socketId: socket?.id,
      url: socket?.io?.uri,
      activeChannels: {
        rooms: Array.from(SocketService.activeRooms),
        games: Array.from(SocketService.activeGames)
      },
      connectionDetails: {
        transport: socket?.io?.engine?.transport?.name,
        protocol: socket?.io?.engine?.protocol,
        reconnecting: SocketService.reconnectAttempts > 0,
        reconnectAttempts: SocketService.reconnectAttempts
      }
    };
  }
}
