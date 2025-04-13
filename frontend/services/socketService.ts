import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/config/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class SocketService {
  private static instance: Socket | null = null;
  private static isInitializing: boolean = false;
  private static initializationPromise: Promise<Socket> | null = null;
  private static connectionAttempts: number = 0;
  private static maxReconnectAttempts: number = 5;
  private static lastPingTime: number = 0;
  private static heartbeatInterval: NodeJS.Timeout | null = null;
  private static currentRoom: string | null = null;
  private static currentGame: string | null = null;
  private static activeChannels: Set<string> = new Set(); // Garder une trace des canaux actifs

  // Tentative de reconnexion si déconnecté
  private static async handleReconnect() {
    if (SocketService.connectionAttempts >= SocketService.maxReconnectAttempts) {
      console.error('🔌 Nombre maximal de tentatives de reconnexion atteint.');
      return;
    }

    SocketService.connectionAttempts++;
    console.log(`🔌 Tentative de reconnexion (${SocketService.connectionAttempts}/${SocketService.maxReconnectAttempts})...`);

    try {
      // Vérifier la connectivité internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('🌐 Pas de connexion Internet. Abandon de la reconnexion.');
        return;
      }

      // Recréer l'instance
      const newSocket = await SocketService.initialize();
      
      // Rejoindre à nouveau les canaux actifs
      SocketService.rejoinActiveChannels();
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de reconnexion:', error);
    }
  }

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
        try {
          token = await AsyncStorage.getItem('@auth_token');
        } catch (error) {
          console.error('❌ Erreur lors de la récupération du token:', error);
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
            token: token || undefined
          },
          query: {
            token: token || undefined
          },
          transports: ['websocket', 'polling']
        };

        // Créer une nouvelle instance avec un try-catch
        try {
          const socketInstance = io(SOCKET_URL, options);
          
          // Configuration des gestionnaires d'événements standard
          socketInstance.on('connect', () => {
            console.log('✅ WebSocket connecté avec succès. Socket ID:', socketInstance.id);
            SocketService.connectionAttempts = 0;
            SocketService.startHeartbeat();
            SocketService.rejoinActiveChannels();
          });

          socketInstance.on('connect_error', (error) => {
            console.error('🔌 Erreur de connexion WebSocket:', error.message);
          });

          socketInstance.on('disconnect', (reason) => {
            console.log('🔌 WebSocket déconnecté:', reason);
            if (SocketService.heartbeatInterval) {
              clearInterval(SocketService.heartbeatInterval);
              SocketService.heartbeatInterval = null;
            }
            
            if (reason === 'io server disconnect' || reason === 'io client disconnect') {
              console.log('🔌 Déconnexion manuelle, pas de reconnexion automatique.');
            } else {
              setTimeout(() => SocketService.handleReconnect(), 2000);
            }
          });
          
          // Gestionnaire d'événement générique pour le débogage
          socketInstance.onAny((event, ...args) => {
            const argStr = args.length > 0 ? JSON.stringify(args[0]).substring(0, 100) + '...' : '';
            console.log(`🔌 [SOCKET EVENT] ${event}`, argStr);
          });
          
          // Attendre que la connexion soit établie avant de résoudre
          if (!socketInstance.connected) {
            socketInstance.once('connect', () => {
              SocketService.instance = socketInstance;
              SocketService.isInitializing = false;
              console.log('✅ Service WebSocket initialisé avec succès');
              resolve(socketInstance);
            });
            
            // Configuration d'un timeout pour la connexion
            const timeout = setTimeout(() => {
              if (!socketInstance.connected) {
                console.error('🔌 Timeout lors de la connexion WebSocket');
                socketInstance.close();
                SocketService.isInitializing = false;
                reject(new Error('Timeout lors de la connexion WebSocket'));
              }
              clearTimeout(timeout);
            }, 10000); // 10 secondes de timeout
          } else {
            // Déjà connecté
            SocketService.instance = socketInstance;
            SocketService.isInitializing = false;
            console.log('✅ Service WebSocket initialisé avec succès (déjà connecté)');
            resolve(socketInstance);
          }
        } catch (socketError) {
          console.error('🔌 Erreur lors de la création du socket:', socketError);
          SocketService.isInitializing = false;
          reject(socketError);
        }
      } catch (error) {
        console.error('🔌 Erreur lors de l\'initialisation du WebSocket:', error);
        SocketService.isInitializing = false;
        reject(error);
      }
    });
    
    return SocketService.initializationPromise;
  }

  // Rejoindre tous les canaux actifs (utilisé après reconnexion)
  private static async rejoinActiveChannels() {
    if (!SocketService.instance || !SocketService.instance.connected) return;

    console.log(`🔄 Tentative de rejoindre ${SocketService.activeChannels.size} canaux après reconnexion...`);
    
    const rejoinPromises: Promise<void>[] = [];
    
    // Rejoindre la salle actuelle si elle existe
    if (SocketService.currentRoom) {
      console.log(`🚪 Rejoindre la salle ${SocketService.currentRoom} après reconnexion`);
      rejoinPromises.push(
        SocketService.joinRoom(SocketService.currentRoom).catch(err => {
          console.error(`❌ Erreur lors de la reconnexion à la salle ${SocketService.currentRoom}:`, err);
          // Ne pas faire échouer l'ensemble du processus pour une seule salle
          return Promise.resolve();
        })
      );
    }
    
    // Rejoindre le jeu actuel si il existe
    if (SocketService.currentGame) {
      console.log(`🎮 Rejoindre le jeu ${SocketService.currentGame} après reconnexion`);
      rejoinPromises.push(
        SocketService.joinGameChannel(SocketService.currentGame).catch(err => {
          console.error(`❌ Erreur lors de la reconnexion au jeu ${SocketService.currentGame}:`, err);
          // Ne pas faire échouer l'ensemble du processus pour un seul jeu
          return Promise.resolve();
        })
      );
    }
    
    // Rejoindre tous les autres canaux qui ne sont pas des salles ou des jeux déjà gérés
    SocketService.activeChannels.forEach(channel => {
      if (
        (SocketService.currentRoom && channel !== `room:${SocketService.currentRoom}`) && 
        (SocketService.currentGame && channel !== `game:${SocketService.currentGame}`)
      ) {
        console.log(`📢 Rejoindre le canal ${channel} après reconnexion`);
        SocketService.instance!.emit('join', { channel });
      }
    });
    
    // Attendre que toutes les opérations de rejointure soient terminées
    try {
      await Promise.all(rejoinPromises);
      console.log('🔄 Reconnexion aux canaux terminée avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la reconnexion aux canaux:', error);
    }
  }

  // Heartbeat pour maintenir la connexion active
  private static startHeartbeat() {
    if (SocketService.heartbeatInterval) {
      clearInterval(SocketService.heartbeatInterval);
    }

    SocketService.heartbeatInterval = setInterval(() => {
      if (SocketService.instance && SocketService.instance.connected) {
        const now = Date.now();
        SocketService.instance.emit('ping', (response: any) => {
          if (response && response.time) {
            const latency = Date.now() - now;
            SocketService.lastPingTime = latency;
          }
        });
      }
    }, 25000); // Toutes les 25 secondes
  }

  // Obtenir l'instance (créer si nécessaire) de manière asynchrone et sûre
  public static async getInstanceAsync(): Promise<Socket> {
    if (!SocketService.instance || !SocketService.instance.connected) {
      try {
        return await SocketService.initialize();
      } catch (error) {
        console.error('❌ Erreur lors de la récupération de l\'instance Socket:', error);
        throw error;
      }
    }
    return SocketService.instance;
  }

  // Vérifier si le socket est connecté
  public static isConnected(): boolean {
    return !!SocketService.instance?.connected;
  }
  
  // Version asynchrone pour vérifier la connexion
  public static async isConnectedAsync(): Promise<boolean> {
    try {
      // Si déjà connecté, retourner vrai immédiatement
      if (SocketService.instance?.connected) {
        return true;
      }
      
      // Si pas connecté, tenter d'initialiser
      const socket = await SocketService.getInstanceAsync();
      return !!socket.connected;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de la connexion Socket:', error);
      return false;
    }
  }

  // Rejoindre une salle de manière fiable
  public static async joinRoom(roomCode: string): Promise<void> {
    try {
      // Attendre d'avoir une instance Socket.IO valide
      const socket = await SocketService.getInstanceAsync();
      
      console.log(`🚪 Tentative de rejoindre la salle ${roomCode}`);
      
      // Créer une promesse pour attendre la confirmation de jointure à la salle
      const joinPromise = new Promise<void>((resolve, reject) => {
        // Configurer un écouteur d'événement de confirmation
        const onRoomJoined = (data: any) => {
          if (data && data.code === roomCode) {
            console.log(`✅ Confirmation de jointure à la salle ${roomCode} reçue`);
            socket.off('room:joined', onRoomJoined);
            clearTimeout(timeoutId);
            resolve();
          }
        };
        
        // Configurer un écouteur d'événement d'erreur
        const onJoinError = (error: any) => {
          console.error(`❌ Erreur lors de la jointure à la salle ${roomCode}:`, error);
          socket.off('room:error', onJoinError);
          clearTimeout(timeoutId);
          reject(new Error(error?.message || 'Échec de la jointure à la salle'));
        };
        
        // Configurer un timeout pour éviter de bloquer indéfiniment
        const timeoutId = setTimeout(() => {
          socket.off('room:joined', onRoomJoined);
          socket.off('room:error', onJoinError);
          console.log(`⚠️ Pas de confirmation de jointure à la salle ${roomCode} après 5 secondes, mais on continue`);
          resolve(); // On résout quand même pour ne pas bloquer l'utilisateur
        }, 5000);
        
        // Mettre en place les écouteurs
        socket.on('room:joined', onRoomJoined);
        socket.on('room:error', onJoinError);
        
        // Envoyer l'événement de jointure (un seul format pour éviter la confusion)
        socket.emit('join-room', { roomCode });
        console.log(`📤 Demande d'inscription envoyée pour la salle: ${roomCode}`);
      });
      
      // Enregistrer la salle actuelle immédiatement pour la reconnexion automatique
      SocketService.currentRoom = roomCode;
      SocketService.activeChannels.add(`room:${roomCode}`);
      
      // Attendre la confirmation ou le timeout
      await joinPromise;
      
      return;
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de rejoindre une salle:', error);
      throw error; // Propager l'erreur pour permettre la gestion en amont
    }
  }

  // Quitter une salle de manière fiable
  public static async leaveRoom(roomCode: string): Promise<void> {
    try {
      // Obtenir une instance Socket.IO
      const socket = await SocketService.getInstanceAsync();
      
      console.log(`🚪 Tentative de quitter la salle ${roomCode}`);
      
      // Créer une promesse pour attendre la confirmation de sortie de la salle
      const leavePromise = new Promise<void>((resolve) => {
        // Configurer un écouteur d'événement de confirmation
        const onRoomLeft = (data: any) => {
          if (data && data.code === roomCode) {
            console.log(`✅ Confirmation de sortie de la salle ${roomCode} reçue`);
            socket.off('room:left', onRoomLeft);
            clearTimeout(timeoutId);
            resolve();
          }
        };
        
        // Configurer un timeout pour éviter de bloquer indéfiniment
        const timeoutId = setTimeout(() => {
          socket.off('room:left', onRoomLeft);
          console.log(`⚠️ Pas de confirmation de sortie de la salle ${roomCode} après 3 secondes, mais on continue`);
          resolve(); // On résout quand même pour ne pas bloquer l'utilisateur
        }, 3000);
        
        // Mettre en place l'écouteur
        socket.on('room:left', onRoomLeft);
        
        // Envoyer l'événement de sortie (un seul format pour éviter la confusion)
        socket.emit('leave-room', { roomCode });
        console.log(`📤 Demande de désinscription envoyée pour la salle: ${roomCode}`);
      });
      
      // Mettre à jour notre état local immédiatement
      if (SocketService.currentRoom === roomCode) {
        SocketService.currentRoom = null;
      }
      SocketService.activeChannels.delete(`room:${roomCode}`);
      
      // Attendre la confirmation ou le timeout
      await leavePromise;
      
      return;
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de quitter une salle:', error);
      throw error; // Propager l'erreur pour permettre la gestion en amont
    }
  }

  // Rejoindre un canal de jeu de manière fiable
  public static async joinGameChannel(gameId: string): Promise<void> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      console.log(`🎮 Tentative de rejoindre le jeu ${gameId}`);
      
      // Créer une promesse pour attendre la confirmation de jointure au jeu
      const joinPromise = new Promise<void>((resolve) => {
        // Configurer un écouteur d'événement de confirmation
        const onGameJoined = (data: any) => {
          const receivedId = typeof data.gameId === 'number' ? data.gameId.toString() : data.gameId;
          const targetId = typeof gameId === 'number' ? gameId.toString() : gameId;
          
          if (data && receivedId === targetId) {
            console.log(`✅ Confirmation de jointure au jeu ${gameId} reçue`);
            socket.off('game:joined', onGameJoined);
            clearTimeout(timeoutId);
            resolve();
          }
        };
        
        // Configurer un timeout pour éviter de bloquer indéfiniment
        const timeoutId = setTimeout(() => {
          socket.off('game:joined', onGameJoined);
          console.log(`⚠️ Pas de confirmation de jointure au jeu ${gameId} après 5 secondes, mais on continue`);
          resolve(); // On résout quand même pour ne pas bloquer l'utilisateur
        }, 5000);
        
        // Mettre en place l'écouteur
        socket.on('game:joined', onGameJoined);
        
        // Envoyer l'événement de jointure (un seul format pour éviter la confusion)
        socket.emit('join-game', { gameId: Number(gameId) }); // Convertir en nombre pour cohérence
        console.log(`📤 Demande d'inscription envoyée pour le jeu: ${gameId}`);
      });
      
      // Mettre à jour notre état local immédiatement
      SocketService.currentGame = gameId;
      SocketService.activeChannels.add(`game:${gameId}`);
      
      // Attendre la confirmation ou le timeout
      await joinPromise;
      
      return;
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de rejoindre un jeu:', error);
      throw error;
    }
  }

  // Quitter un canal de jeu de manière fiable
  public static async leaveGameChannel(gameId: string): Promise<void> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      console.log(`🎮 Tentative de quitter le jeu ${gameId}`);
      
      // Créer une promesse pour attendre la confirmation de sortie du jeu
      const leavePromise = new Promise<void>((resolve) => {
        // Configurer un écouteur d'événement de confirmation
        const onGameLeft = (data: any) => {
          if (data && data.gameId === parseInt(gameId)) {
            console.log(`✅ Confirmation de sortie du jeu ${gameId} reçue`);
            socket.off('game:left', onGameLeft);
            clearTimeout(timeoutId);
            resolve();
          }
        };
        
        // Configurer un timeout pour éviter de bloquer indéfiniment
        const timeoutId = setTimeout(() => {
          socket.off('game:left', onGameLeft);
          console.log(`⚠️ Pas de confirmation de sortie du jeu ${gameId} après 3 secondes, mais on continue`);
          resolve(); // On résout quand même pour ne pas bloquer l'utilisateur
        }, 3000);
        
        // Mettre en place l'écouteur
        socket.on('game:left', onGameLeft);
        
        // Envoyer l'événement de sortie (un seul format pour éviter la confusion)
        socket.emit('leave-game', { gameId });
        console.log(`📤 Demande de désinscription envoyée pour le jeu: ${gameId}`);
      });
      
      // Mettre à jour notre état local immédiatement
      if (SocketService.currentGame === gameId) {
        SocketService.currentGame = null;
      }
      SocketService.activeChannels.delete(`game:${gameId}`);
      
      // Attendre la confirmation ou le timeout
      await leavePromise;
      
      return;
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de quitter un jeu:', error);
      throw error;
    }
  }

  // Récupérer la latence actuelle
  public static getLatency(): number {
    return SocketService.lastPingTime;
  }

  // Fermer la connexion WebSocket
  public static close(): void {
    if (SocketService.instance) {
      SocketService.instance.disconnect();
      SocketService.instance = null;

      if (SocketService.heartbeatInterval) {
        clearInterval(SocketService.heartbeatInterval);
        SocketService.heartbeatInterval = null;
      }
      
      SocketService.currentRoom = null;
      SocketService.currentGame = null;
      SocketService.connectionAttempts = 0;
      SocketService.activeChannels.clear();
      SocketService.initializationPromise = null;
    }
  }

  // Diagnostiquer l'état de la connexion
  public static diagnose(): {status: string, details: any} {
    const status = SocketService.instance && SocketService.instance.connected 
      ? 'connected' 
      : 'disconnected';
    
    return {
      status,
      details: {
        connected: SocketService.isConnected(),
        socketId: SocketService.instance?.id || null,
        currentRoom: SocketService.currentRoom,
        currentGame: SocketService.currentGame,
        latency: SocketService.lastPingTime,
        activeChannels: Array.from(SocketService.activeChannels),
        transport: SocketService.instance?.io?.engine?.transport?.name || null,
        isInitializing: SocketService.isInitializing,
      }
    };
  }
}

export default SocketService;
