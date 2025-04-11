import { io, Socket } from 'socket.io-client';
import { WS_URL } from '@/config/axios';
import NetInfo from '@react-native-community/netinfo';

class SocketService {
  private static instance: Socket | null = null;
  private static reconnectAttempts = 0;
  private static maxReconnectAttempts = 5;
  private static activeRooms: Set<string> = new Set();

  static getInstance(): Socket {
    if (!this.instance) {
      console.log('🔌 Initialisation de la connexion WebSocket vers:', WS_URL);
      
      this.instance = io(WS_URL, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling'],
      });

      // Configuration des événements de base
      this.instance.on('connect', () => {
        console.log('🟢 Connecté au serveur WebSocket, ID:', this.instance?.id);
        this.reconnectAttempts = 0;
        
        // Rejoindre à nouveau toutes les salles actives après reconnexion
        this.activeRooms.forEach(roomCode => {
          console.log(`🔄 Rejoindre à nouveau la salle ${roomCode} après reconnexion`);
          this.instance?.emit('join:room', { roomCode });
        });
      });

      this.instance.on('disconnect', (reason) => {
        console.log('🔴 Déconnecté du serveur WebSocket, raison:', reason);
      });

      this.instance.on('error', (error) => {
        console.error('🚨 Erreur WebSocket:', error);
      });
      
      this.instance.on('connect_error', async (error) => {
        this.reconnectAttempts++;
        console.error(`🚨 Erreur de connexion WebSocket (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, error.message);
        
        // Vérifier l'état du réseau
        const netInfo = await NetInfo.fetch();
        console.log(`🌐 État réseau: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
        
        // Si nombre max de tentatives atteint, passer en mode polling
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log('🔄 Passage au mode polling après échec des websockets');
          if (this.instance) {
            // Désactiver websocket et tenter avec polling
            this.instance.io.opts.transports = ['polling'];
            this.instance.connect();
          }
        }
      });
      
      // Confirmer qu'une salle a été rejointe
      this.instance.on('room:joined', (data) => {
        console.log(`✅ Confirmation: salle ${data.roomCode} rejointe`);
      });
    }

    return this.instance;
  }

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

  static joinRoom(roomCode: string) {
    const socket = this.getInstance();
    console.log(`🚪 Tentative de rejoindre la salle ${roomCode}`);
    
    // Ajouter à la liste des salles actives
    this.activeRooms.add(roomCode);
    
    socket.emit('join:room', { roomCode });
    console.log(`✅ Demande d'entrée dans la salle ${roomCode} envoyée`);
  }

  static leaveRoom(roomCode: string) {
    const socket = this.getInstance();
    console.log(`🚪 Tentative de quitter la salle ${roomCode}`);
    
    // Retirer de la liste des salles actives
    this.activeRooms.delete(roomCode);
    
    socket.emit('leave:room', { roomCode });
    console.log(`✅ Demande de sortie de la salle ${roomCode} envoyée`);
  }

  static isConnected(): boolean {
    return !!this.instance?.connected;
  }

  static reconnect() {
    console.log('🔄 Tentative de reconnexion WebSocket');
    
    // Sauvegarder la liste des salles actives
    const activeRoomsCopy = new Set(this.activeRooms);
    
    // Déconnexion et réinitialisation
    this.disconnect();
    this.reconnectAttempts = 0;
    
    // Restaurer la liste des salles
    this.activeRooms = activeRoomsCopy;
    
    // Réinitialiser les options de transport (essayer d'abord websocket, puis polling)
    const newInstance = this.getInstance();
    if (newInstance && newInstance.io) {
      newInstance.io.opts.transports = ['websocket', 'polling'];
    }
    
    return newInstance;
  }
}

export default SocketService;
