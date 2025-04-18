import io, { Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/config/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import UserIdManager from '@/utils/userIdManager';

class SocketService {
  private socket: Socket | null = null;
  private initPromise: Promise<Socket> | null = null;
  private activeRooms: Set<string> = new Set();
  private isInitializing: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 2000; // 2 secondes
  private autoInit: boolean = false; // Nouvelle propriété pour contrôler l'initialisation auto

  /**
   * Initialise la connexion socket
   * Si vous voulez éviter les connexions automatiques, passez forceInit=true
   */
  async initialize(forceInit: boolean = false): Promise<Socket> {
    // Si l'initialisation n'est pas forcée et autoInit est false, ne pas se connecter
    if (!forceInit && !this.autoInit) {
      console.log('🔌 Initialisation Socket.IO reportée (pas de forceInit)');
      throw new Error('Socket.IO initialization postponed - explicit initialization required');
    }

    // Si l'initialisation est déjà en cours, retourner la promesse existante
    if (this.initPromise) {
      console.log('🔌 Connexion Socket.IO déjà en cours, attente...');
      return this.initPromise;
    }

    // Si le socket existe déjà et est connecté, le retourner directement
    if (this.socket && this.socket.connected) {
      console.log('✅ Socket.IO déjà initialisé et connecté');
      return this.socket;
    }

    console.log('🔌 Initialisation de la connexion Socket.IO...');
    this.isInitializing = true;

    // Créer une promesse pour l'initialisation
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        // Vérifier la connexion internet
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          console.error('❌ Pas de connexion internet disponible');
          this.isInitializing = false;
          this.initPromise = null;
          reject(new Error('Pas de connexion internet'));
          return;
        }

        // Récupérer l'ID utilisateur
        const userId = await UserIdManager.getUserId();
        console.log(`👤 Initialisation socket avec ID utilisateur: ${userId || 'non défini'}`);

        // Initialiser le socket avec le SOCKET_URL configuré
        this.socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          autoConnect: true,
          auth: userId ? { userId } : undefined,
        });

        // Écouter les événements de connexion
        this.socket.on('connect', () => {
          console.log(`✅ Socket.IO connecté avec ID: ${this.socket?.id}`);
          this.reconnectAttempts = 0;
        });

        this.socket.on('connect_error', (error) => {
          console.error(`❌ Erreur de connexion Socket.IO:`, error);
        });

        this.socket.on('error', (error) => {
          console.error(`❌ Erreur Socket (non gérée):`, error);
        });

        // Écouter les événements de déconnexion
        this.socket.on('disconnect', (reason) => {
          console.warn(`🔌 Socket.IO déconnecté: ${reason}`);
          
          // Essayer de se reconnecter automatiquement si la déconnexion n'est pas volontaire
          if (reason === 'io server disconnect' || reason === 'transport close') {
            this.reconnect().catch(err => {
              console.error('❌ Échec de reconnexion automatique:', err);
            });
          }
        });

        // Vérifier si le socket est connecté
        if (this.socket.connected) {
          console.log('✅ Socket.IO connecté immédiatement');
          this.isInitializing = false;
          resolve(this.socket);
        } else {
          console.log('⏳ En attente de connexion Socket.IO...');
          
          // Configurer un délai d'attente
          const timeout = setTimeout(() => {
            console.error('❌ Délai d\'attente de connexion dépassé');
            this.isInitializing = false;
            this.initPromise = null;
            
            if (this.socket) {
              this.socket.disconnect();
              this.socket = null;
            }
            
            reject(new Error('Délai d\'attente de connexion dépassé'));
          }, 10000);
          
          // Attendre la connexion
          this.socket.once('connect', () => {
            clearTimeout(timeout);
            console.log('✅ Socket.IO connecté avec succès');
            this.isInitializing = false;
            resolve(this.socket!);
          });
        }
      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation Socket.IO:', error);
        this.isInitializing = false;
        this.initPromise = null;
        reject(error);
      }
    });

    try {
      return await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Active ou désactive l'initialisation automatique des sockets
   */
  setAutoInit(enabled: boolean): void {
    this.autoInit = enabled;
    console.log(`🔌 Initialisation automatique des sockets: ${enabled ? 'activée' : 'désactivée'}`);
  }

  /**
   * Récupère l'instance du socket (méthode synchrone)
   */
  getSocketInstance(): Socket | null {
    return this.socket;
  }

  /**
   * Récupère une instance socket de manière asynchrone (recommandé)
   * Initialise la connexion si nécessaire et si autoInit ou forceInit est true
   */
  async getInstanceAsync(forceInit: boolean = false): Promise<Socket> {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }
    
    // Si l'initialisation n'est pas activée et pas forcée, renvoyer une erreur
    if (!this.autoInit && !forceInit) {
      console.log('🔌 Demande d\'instance socket sans initialisation forcée, connexion différée');
      throw new Error('Socket not initialized and autoInit is disabled');
    }
    
    return this.initialize(forceInit);
  }

  /**
   * Vérifie si le socket est connecté
   */
  isConnected(): boolean {
    return !!this.socket && this.socket.connected;
  }

  /**
   * Reconnecte le socket si déconnecté
   */
  async reconnect(): Promise<boolean> {
    try {
      console.log('🔄 Tentative de reconnexion Socket.IO...');
      
      if (this.socket && this.socket.connected) {
        console.log('✅ Déjà connecté, reconnexion non nécessaire');
        return true;
      }
      
      // Limiter les tentatives de reconnexion
      if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        console.error(`❌ Nombre maximum de tentatives de reconnexion atteint (${this.MAX_RECONNECT_ATTEMPTS})`);
        throw new Error('Nombre maximum de tentatives de reconnexion atteint');
      }
      
      this.reconnectAttempts++;
      
      // Si déjà en initialisation, attendre le résultat
      if (this.isInitializing && this.initPromise) {
        try {
          await this.initPromise;
          return true;
        } catch (error) {
          console.error('❌ Échec de l\'initialisation en cours:', error);
          // Continuer avec une nouvelle tentative
        }
      }
      
      // Si le socket existe mais est déconnecté, essayer de le reconnecter
      if (this.socket) {
        if (!this.socket.connected) {
          console.log('🔌 Reconnexion du socket existant...');
          this.socket.connect();
          
          // Attendre la reconnexion
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              this.socket?.off('connect');
              resolve(false);
            }, 5000);
            
            this.socket.once('connect', () => {
              clearTimeout(timeout);
              console.log('✅ Socket reconnecté avec succès');
              resolve(true);
            });
          });
        }
        return true;
      }
      
      // Sinon, initialiser une nouvelle connexion
      await this.initialize();
      return true;
    } catch (error) {
      console.error('❌ Échec de reconnexion:', error);
      return false;
    }
  }

  /**
   * Tente de rejoindre une salle avec plusieurs tentatives
   */
  async reconnectToRoom(roomCode: string, maxAttempts: number = 3): Promise<boolean> {
    console.log(`🔄 Tentative de rejoindre la salle ${roomCode} avec ${maxAttempts} essais max`);
    
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        // S'assurer que le socket est connecté
        if (!this.isConnected()) {
          console.log(`🔌 Socket non connecté, tentative de reconnexion (${attempts}/${maxAttempts})...`);
          const reconnected = await this.reconnect();
          if (!reconnected) {
            console.warn(`⚠️ Échec de reconnexion à la tentative ${attempts}/${maxAttempts}`);
            
            // Attendre un peu avant de réessayer
            await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
            continue;
          }
        }
        
        // Tenter de rejoindre la salle
        const success = await this.joinRoom(roomCode);
        if (success) {
          console.log(`✅ Salle ${roomCode} rejointe avec succès à la tentative ${attempts}/${maxAttempts}`);
          return true;
        }
        
        console.warn(`⚠️ Échec de jointure à la salle à la tentative ${attempts}/${maxAttempts}`);
        
        // Attendre un peu avant de réessayer
        await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
      } catch (error) {
        console.error(`❌ Erreur lors de la tentative ${attempts}/${maxAttempts} de rejoindre la salle:`, error);
        
        // Attendre un peu avant de réessayer
        await new Promise(resolve => setTimeout(resolve, this.RECONNECT_DELAY));
      }
    }
    
    console.error(`❌ Échec de rejoindre la salle ${roomCode} après ${maxAttempts} tentatives`);
    return false;
  }

  /**
   * Rejoint une salle
   */
  async joinRoom(roomCode: string): Promise<boolean> {
    try {
      console.log(`🚪 Tentative de rejoindre la salle ${roomCode}`);
      
      if (!this.socket || !this.socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative de reconnexion...');
        await this.reconnect();
      }
      
      if (!this.socket || !this.socket.connected) {
        throw new Error('Socket non connecté après tentative de reconnexion');
      }
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout lors de la tentative de rejoindre la salle ${roomCode}`);
          resolve(false);
        }, 5000);
        
        this.socket!.emit('join-room', { roomCode }, (response: any) => {
          clearTimeout(timeout);
          
          if (response && response.success !== false) {
            console.log(`✅ Salle ${roomCode} rejointe avec succès`);
            this.activeRooms.add(roomCode);
            resolve(true);
          } else {
            console.warn(`⚠️ Échec de rejoindre la salle ${roomCode}:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
        
        // Si pas de callback disponible, considérer comme succès avec un autre événement
        this.socket!.once('room:joined', (data) => {
          clearTimeout(timeout);
          
          if (data && data.roomCode === roomCode) {
            console.log(`✅ Salle ${roomCode} rejointe avec succès (via événement)`);
            this.activeRooms.add(roomCode);
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de rejoindre la salle ${roomCode}:`, error);
      return false;
    }
  }

  /**
   * Quitte une salle
   */
  async leaveRoom(roomCode: string): Promise<boolean> {
    try {
      console.log(`🚪 Tentative de quitter la salle ${roomCode}`);
      
      if (!this.socket || !this.socket.connected) {
        console.warn('⚠️ Socket non connecté, impossible de quitter la salle');
        this.activeRooms.delete(roomCode);
        return false;
      }
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout lors de la tentative de quitter la salle ${roomCode}`);
          this.activeRooms.delete(roomCode);
          resolve(false);
        }, 5000);
        
        this.socket!.emit('leave-room', { roomCode }, (response: any) => {
          clearTimeout(timeout);
          
          this.activeRooms.delete(roomCode);
          
          if (response && response.success !== false) {
            console.log(`✅ Salle ${roomCode} quittée avec succès`);
            resolve(true);
          } else {
            console.warn(`⚠️ Échec de quitter la salle ${roomCode}:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
        
        // Si pas de callback disponible, considérer comme succès avec un autre événement
        this.socket!.once('room:left', (data) => {
          clearTimeout(timeout);
          
          this.activeRooms.delete(roomCode);
          
          if (data && data.roomCode === roomCode) {
            console.log(`✅ Salle ${roomCode} quittée avec succès (via événement)`);
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de quitter la salle ${roomCode}:`, error);
      this.activeRooms.delete(roomCode);
      return false;
    }
  }

  /**
   * Rejoint un jeu
   */
  async joinGame(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 Tentative de rejoindre le jeu ${gameId}`);
      
      if (!this.socket || !this.socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative de reconnexion...');
        await this.reconnect();
      }
      
      if (!this.socket || !this.socket.connected) {
        throw new Error('Socket non connecté après tentative de reconnexion');
      }
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout lors de la tentative de rejoindre le jeu ${gameId}`);
          resolve(false);
        }, 5000);
        
        this.socket!.emit('join-game', { gameId }, (response: any) => {
          clearTimeout(timeout);
          
          if (response && response.success !== false) {
            console.log(`✅ Jeu ${gameId} rejoint avec succès`);
            resolve(true);
          } else {
            console.warn(`⚠️ Échec de rejoindre le jeu ${gameId}:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
        
        // Si pas de callback disponible, considérer comme succès avec un autre événement
        this.socket!.once('game:joined', (data) => {
          clearTimeout(timeout);
          
          if (data && data.gameId === gameId) {
            console.log(`✅ Jeu ${gameId} rejoint avec succès (via événement)`);
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de rejoindre le jeu ${gameId}:`, error);
      return false;
    }
  }

  /**
   * Tente de rejoindre un canal de jeu (game channel)
   */
  async joinGameChannel(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 SocketService: Tentative de rejoindre le canal de jeu ${gameId}`);
      
      if (!this.socket || !this.socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative de reconnexion...');
        await this.reconnect();
      }
      
      if (!this.socket || !this.socket.connected) {
        throw new Error('Socket non connecté après tentative de reconnexion');
      }
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout lors de la tentative de rejoindre le jeu ${gameId}`);
          resolve(false);
        }, 5000);
        
        this.socket!.emit('join-game', { gameId }, (response: any) => {
          clearTimeout(timeout);
          
          if (response && response.success !== false) {
            console.log(`✅ Jeu ${gameId} rejoint avec succès`);
            resolve(true);
          } else {
            console.warn(`⚠️ Échec de rejoindre le jeu ${gameId}:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
        
        // Si pas de callback disponible, considérer comme succès avec un autre événement
        this.socket!.once('game:joined', (data) => {
          clearTimeout(timeout);
          
          if (data && data.gameId === gameId) {
            console.log(`✅ Jeu ${gameId} rejoint avec succès (via événement)`);
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de rejoindre le jeu ${gameId}:`, error);
      return false;
    }
  }

  /**
   * Quitte un canal de jeu 
   */
  async leaveGameChannel(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 SocketService: Tentative de quitter le canal de jeu ${gameId}`);
      
      if (!this.socket || !this.socket.connected) {
        console.warn('⚠️ Socket non connecté, impossible de quitter le jeu');
        return false;
      }
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout lors de la tentative de quitter le jeu ${gameId}`);
          resolve(false);
        }, 5000);
        
        this.socket!.emit('leave-game', { gameId }, (response: any) => {
          clearTimeout(timeout);
          
          if (response && response.success !== false) {
            console.log(`✅ Jeu ${gameId} quitté avec succès`);
            resolve(true);
          } else {
            console.warn(`⚠️ Échec de quitter le jeu ${gameId}:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
        
        // Si pas de callback disponible, considérer comme succès avec un autre événement
        this.socket!.once('game:left', (data) => {
          clearTimeout(timeout);
          
          if (data && data.gameId === gameId) {
            console.log(`✅ Jeu ${gameId} quitté avec succès (via événement)`);
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de quitter le jeu ${gameId}:`, error);
      return false;
    }
  }

  /**
   * Force une vérification de la phase du jeu
   */
  async forcePhaseCheck(gameId: string): Promise<boolean> {
    try {
      console.log(`🔄 SocketService: Forçage de la vérification de phase pour le jeu ${gameId}`);
      
      if (!this.socket || !this.socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative de reconnexion...');
        await this.reconnect();
      }
      
      if (!this.socket || !this.socket.connected) {
        throw new Error('Socket non connecté après tentative de reconnexion');
      }
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`⚠️ Timeout lors du forçage de vérification pour le jeu ${gameId}`);
          resolve(false);
        }, 5000);
        
        this.socket!.emit('game:force_check', { gameId }, (response: any) => {
          clearTimeout(timeout);
          
          if (response && response.success !== false) {
            console.log(`✅ Vérification forcée avec succès pour le jeu ${gameId}`);
            resolve(true);
          } else {
            console.warn(`⚠️ Échec de la vérification forcée:`, response?.error || 'Raison inconnue');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Erreur lors du forçage de vérification:`, error);
      return false;
    }
  }

  /**
   * Nettoie la connexion, à appeler lors de la déconnexion de l'application
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Nettoyage de la connexion socket...');
    
    // Quitter toutes les salles actives
    for (const roomCode of this.activeRooms) {
      try {
        await this.leaveRoom(roomCode);
      } catch (error) {
        console.warn(`⚠️ Erreur lors de la tentative de quitter la salle ${roomCode}:`, error);
      }
    }
    
    // Déconnecter le socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Réinitialiser les propriétés
    this.initPromise = null;
    this.isInitializing = false;
    this.reconnectAttempts = 0;
    this.activeRooms.clear();
    
    console.log('✅ Nettoyage socket terminé');
  }

  /**
   * Utilitaire de diagnostic pour l'analyse des problèmes
   */
  diagnose(): Record<string, any> {
    return {
      isConnected: this.isConnected(),
      socketId: this.socket?.id || null,
      isInitializing: this.isInitializing,
      reconnectAttempts: this.reconnectAttempts,
      activeRooms: Array.from(this.activeRooms),
      hasListeners: this.socket ? Object.keys(this.socket.listeners).length > 0 : false,
    };
  }
}

// Création d'une instance unique
const socketServiceInstance = new SocketService();

// Désactiver l'initialisation automatique par défaut
socketServiceInstance.setAutoInit(false);

// Export des méthodes pour maintenir la compatibilité avec le code existant
export default {
  // Méthodes d'instance
  initialize: (forceInit?: boolean) => socketServiceInstance.initialize(forceInit),
  getSocketInstance: () => socketServiceInstance.getSocketInstance(),
  getInstanceAsync: (forceInit?: boolean) => socketServiceInstance.getInstanceAsync(forceInit),
  isConnected: () => socketServiceInstance.isConnected(),
  setAutoInit: (enabled: boolean) => socketServiceInstance.setAutoInit(enabled),
  reconnect: () => socketServiceInstance.reconnect(),
  reconnectToRoom: (roomCode: string, maxAttempts?: number) => 
    socketServiceInstance.reconnectToRoom(roomCode, maxAttempts),
  joinRoom: (roomCode: string) => socketServiceInstance.joinRoom(roomCode),
  leaveRoom: (roomCode: string) => socketServiceInstance.leaveRoom(roomCode),
  joinGame: (gameId: string) => socketServiceInstance.joinGame(gameId),
  joinGameChannel: (gameId: string) => socketServiceInstance.joinGameChannel(gameId),
  leaveGameChannel: (gameId: string) => socketServiceInstance.leaveGameChannel(gameId),
  forcePhaseCheck: (gameId: string) => socketServiceInstance.forcePhaseCheck(gameId),
  cleanup: () => socketServiceInstance.cleanup(),
  diagnose: () => socketServiceInstance.diagnose()
};