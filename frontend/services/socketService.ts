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
  private static rejoinActiveChannels() {
    if (!SocketService.instance || !SocketService.instance.connected) return;

    console.log(`🔄 Tentative de rejoindre ${SocketService.activeChannels.size} canaux après reconnexion...`);
    
    // Rejoindre la salle actuelle si elle existe
    if (SocketService.currentRoom) {
      console.log(`🚪 Rejoindre la salle ${SocketService.currentRoom} après reconnexion`);
      SocketService.instance.emit('join-room', { roomCode: SocketService.currentRoom });
    }
    
    // Rejoindre le jeu actuel si il existe
    if (SocketService.currentGame) {
      console.log(`🎮 Rejoindre le jeu ${SocketService.currentGame} après reconnexion`);
      SocketService.instance.emit('join-game', { gameId: SocketService.currentGame });
    }

    // Rejoindre tous les autres canaux
    SocketService.activeChannels.forEach(channel => {
      if (
        (channel !== `room:${SocketService.currentRoom}`) && 
        (channel !== `game:${SocketService.currentGame}`)
      ) {
        console.log(`📢 Rejoindre le canal ${channel} après reconnexion`);
        SocketService.instance.emit('join', { channel });
      }
    });
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

  // Version synchrone (legacy) mais avec gestion d'erreurs améliorée
  public static getInstance(): Socket {
    if (!SocketService.instance) {
      console.log('⚠️ Socket.IO non initialisé, tentative d\'initialisation synchrone');
      
      // Si une initialisation est déjà en cours, on patiente un peu
      if (SocketService.isInitializing) {
        console.log('⚠️ Initialisation déjà en cours, renvoi d\'un socket vide temporaire');
        // Renvoyer un objet factice qui ne lancera pas d'erreur lors des appels
        return {
          on: () => console.log('⚠️ Socket pas encore initialisé, événement ignoré'),
          emit: () => console.log('⚠️ Socket pas encore initialisé, émission ignorée'),
          off: () => console.log('⚠️ Socket pas encore initialisé, désabonnement ignoré'),
          connected: false,
          id: null
        } as any;
      }
      
      // Lancer l'initialisation de manière synchrone
      try {
        SocketService.initialize().catch(err => {
          console.error('❌ Échec de l\'initialisation du socket en arrière-plan:', err);
        });
        
        // Renvoyer un objet factice en attendant
        return {
          on: () => console.log('⚠️ Socket en cours d\'initialisation, événement en attente'),
          emit: () => console.log('⚠️ Socket en cours d\'initialisation, émission en attente'),
          off: () => console.log('⚠️ Socket en cours d\'initialisation, désabonnement en attente'),
          connected: false,
          id: null
        } as any;
      } catch (error) {
        console.error('❌ Échec de l\'initialisation synchrone du socket:', error);
        throw error;
      }
    }
    return SocketService.instance;
  }

  // Vérifier si le socket est connecté
  public static isConnected(): boolean {
    return !!SocketService.instance?.connected;
  }

  // Rejoindre une salle de manière fiable
  public static async joinRoom(roomCode: string): Promise<void> {
    try {
      // Attendre d'avoir une instance Socket.IO valide
      const socket = await SocketService.getInstanceAsync();
      
      // Envoyer l'événement approprié en fonction du serveur
      // Essayer avec 'join-room' qui est le format côté serveur
      socket.emit('join-room', { roomCode });
      
      // Également essayer avec 'room:join' comme fallback
      setTimeout(() => {
        socket.emit('room:join', { roomCode });
      }, 100);
      
      // Enregistrer la salle actuelle
      SocketService.currentRoom = roomCode;
      SocketService.activeChannels.add(`room:${roomCode}`);
      
      console.log(`✅ Demande d'inscription envoyée pour la salle: ${roomCode}`);
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de rejoindre une salle:', error);
    }
  }

  // Quitter une salle de manière fiable
  public static async leaveRoom(roomCode: string): Promise<void> {
    try {
      // Obtenir une instance Socket.IO
      const socket = await SocketService.getInstanceAsync();
      
      // Essayer les deux formats d'événement
      socket.emit('leave-room', { roomCode });
      setTimeout(() => {
        socket.emit('room:leave', { roomCode });
      }, 100);
      
      // Mettre à jour notre état local
      if (SocketService.currentRoom === roomCode) {
        SocketService.currentRoom = null;
      }
      SocketService.activeChannels.delete(`room:${roomCode}`);
      
      console.log(`✅ Demande de désinscription envoyée pour la salle: ${roomCode}`);
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de quitter une salle:', error);
    }
  }

  // Rejoindre un canal de jeu de manière fiable
  public static async joinGameChannel(gameId: string): Promise<void> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      // Essayer les deux formats d'événement
      socket.emit('join-game', { gameId });
      setTimeout(() => {
        socket.emit('game:join', { gameId });
      }, 100);
      
      // Mettre à jour notre état local
      SocketService.currentGame = gameId;
      SocketService.activeChannels.add(`game:${gameId}`);
      
      console.log(`✅ Demande d'inscription envoyée pour le jeu: ${gameId}`);
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de rejoindre un jeu:', error);
    }
  }

  // Quitter un canal de jeu de manière fiable
  public static async leaveGameChannel(gameId: string): Promise<void> {
    try {
      const socket = await SocketService.getInstanceAsync();
      
      // Essayer les deux formats d'événement
      socket.emit('leave-game', { gameId });
      setTimeout(() => {
        socket.emit('game:leave', { gameId });
      }, 100);
      
      // Mettre à jour notre état local
      if (SocketService.currentGame === gameId) {
        SocketService.currentGame = null;
      }
      SocketService.activeChannels.delete(`game:${gameId}`);
      
      console.log(`✅ Demande de désinscription envoyée pour le jeu: ${gameId}`);
    } catch (error) {
      console.error('🔌 Erreur lors de la tentative de quitter un jeu:', error);
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
