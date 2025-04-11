import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/config/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class SocketService {
  private static instance: Socket | null = null;
  private static activeRooms = new Set<string>();
  private static connectionAttempts = 0;
  private static maxConnectionAttempts = 3;
  
  /**
   * Récupère l'instance de Socket.IO ou en crée une nouvelle
   */
  static getInstance(): Socket {
    if (!this.instance) {
      console.log('🔌 Initialisation d\'une nouvelle connexion WebSocket');
      
      // Détermination de l'URL correcte selon la plateforme
      let wsUrl = SOCKET_URL;
      console.log(`🔌 Tentative de connexion WebSocket à ${wsUrl}`);
      
      try {
        this.instance = io(wsUrl, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: this.maxConnectionAttempts,
          reconnectionDelay: 1000,
          timeout: 10000,
          autoConnect: true,
          auth: async (cb) => {
            try {
              const token = await AsyncStorage.getItem('@auth_token');
              console.log(`🔐 Token pour authentification WebSocket: ${token ? 'présent' : 'absent'}`);
              cb({ token });
            } catch (error) {
              console.error('❌ Erreur lors de la récupération du token pour WebSocket:', error);
              cb({ token: null });
            }
          }
        });
        
        this.setupListeners();
      } catch (error) {
        console.error('❌ Erreur fatale lors de l\'initialisation du WebSocket:', error);
        // Créer un socket factice pour éviter les erreurs null
        this.createFallbackSocket();
      }
    }
    
    return this.instance!;
  }
  
  /**
   * Crée un socket factice en cas d'échec de connexion
   */
  private static createFallbackSocket() {
    // Créer un faux objet Socket avec des méthodes vides
    // pour éviter les erreurs quand la connexion est impossible
    this.instance = {
      id: 'fallback-socket',
      connected: false,
      disconnected: true,
      on: (event: string, callback: (...args: any[]) => void) => this.instance!,
      emit: (event: string, ...args: any[]) => this.instance!,
      off: (event: string) => this.instance!,
      disconnect: () => {},
      connect: () => {},
    } as any;
    
    console.warn('⚠️ Utilisation d\'un socket factice (la connexion au serveur a échoué)');
  }
  
  /**
   * Configure les écouteurs d'événements de base pour la socket
   */
  private static setupListeners() {
    if (!this.instance) return;
    
    this.instance.on('connect', () => {
      console.log(`✅ Connexion WebSocket établie (ID: ${this.instance?.id})`);
      this.connectionAttempts = 0; // Réinitialiser le compteur en cas de succès
    });
    
    this.instance.on('disconnect', (reason) => {
      console.log(`❌ Déconnexion WebSocket: ${reason}`);
    });
    
    this.instance.on('connect_error', (error) => {
      this.connectionAttempts++;
      console.error(`❌ Erreur de connexion WebSocket (tentative ${this.connectionAttempts}/${this.maxConnectionAttempts}):`, error.message);
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.error('❌ Nombre maximal de tentatives atteint, arrêt des tentatives de reconnexion');
        this.instance?.disconnect();
      }
    });
  }
  
  /**
   * Rejoint une salle via WebSocket
   */
  static joinRoom(roomCode: string) {
    console.log(`🚪 Tentative de rejoindre la salle WebSocket ${roomCode}`);
    
    try {
      const socket = this.getInstance();
      
      if (!socket || !socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative d\'envoi de l\'événement join-room ignorée');
        return;
      }
      
      socket.emit('join-room', { roomCode });
      this.activeRooms.add(roomCode);
      
      console.log(`✅ Demande envoyée pour rejoindre la salle ${roomCode}`);
      console.log(`📊 Salles actives: ${Array.from(this.activeRooms).join(', ')}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de rejoindre la salle ${roomCode}:`, error);
    }
  }
  
  /**
   * Quitte une salle via WebSocket
   */
  static leaveRoom(roomCode: string) {
    console.log(`🚶 Tentative de quitter la salle WebSocket ${roomCode}`);
    
    try {
      const socket = this.getInstance();
      
      if (!socket || !socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative d\'envoi de l\'événement leave-room ignorée');
        return;
      }
      
      socket.emit('leave-room', { roomCode });
      this.activeRooms.delete(roomCode);
      
      console.log(`✅ Demande envoyée pour quitter la salle ${roomCode}`);
      console.log(`📊 Salles actives: ${Array.from(this.activeRooms).join(', ')}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de quitter la salle ${roomCode}:`, error);
    }
  }

  /**
   * Déconnecte la socket WebSocket
   */
  static disconnect() {
    console.log('🔌 Demande de déconnexion WebSocket');
    if (this.instance) {
      // Vider la liste des salles actives
      this.activeRooms.clear();
      
      this.instance.disconnect();
      this.instance = null;
      console.log('✅ Déconnexion WebSocket réussie');
    } else {
      console.log('ℹ️ Aucune connexion WebSocket active à déconnecter');
    }
  }
  
  /**
   * Rejoint un canal de jeu via WebSocket
   */
  static joinGameChannel(gameId: string) {
    console.log(`🎮 Tentative de rejoindre le canal de jeu ${gameId}`);
    
    try {
      const socket = this.getInstance();
      
      if (!socket || !socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative d\'envoi de l\'événement join-game ignorée');
        return;
      }
      
      socket.emit('join-game', { gameId });
      console.log(`✅ Demande envoyée pour rejoindre le canal de jeu ${gameId}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de rejoindre le canal de jeu ${gameId}:`, error);
    }
  }
  
  /**
   * Quitte un canal de jeu via WebSocket
   */
  static leaveGameChannel(gameId: string) {
    console.log(`🎮 Tentative de quitter le canal de jeu ${gameId}`);
    
    try {
      const socket = this.getInstance();
      
      if (!socket || !socket.connected) {
        console.warn('⚠️ Socket non connecté, tentative d\'envoi de l\'événement leave-game ignorée');
        return;
      }
      
      socket.emit('leave-game', { gameId });
      console.log(`✅ Demande envoyée pour quitter le canal de jeu ${gameId}`);
    } catch (error) {
      console.error(`❌ Erreur lors de la tentative de quitter le canal de jeu ${gameId}:`, error);
    }
  }
}

export default SocketService;
