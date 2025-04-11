import api from '@/config/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocketService from './socketService';
import NetInfo from '@react-native-community/netinfo';

export interface CreateRoomPayload {
  name: string;
  game_mode: string;
  is_private?: boolean;
  max_players?: number;
  total_rounds?: number;
}

class RoomService {
  static async createRoom(payload: CreateRoomPayload) {
    try {
      console.log('🏗️ Création de salle avec payload:', payload);

      // Vérification de la connexion internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.error('❌ Pas de connexion internet disponible');
        throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
      }

      // Récupération du token d'authentification
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        console.error('❌ Aucun token d\'authentification trouvé');
        throw new Error('Vous n\'êtes pas authentifié. Veuillez vous reconnecter.');
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      console.log('🌐 Envoi de la requête de création de salle');
      const response = await api.post('/rooms', payload, { headers });
      console.log('✅ Salle créée avec succès:', response.data?.status);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur lors de la création de la salle:', error);
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Détails supplémentaires:');
        console.error('- URL API configurée:', api.defaults.baseURL);
        console.error('- Timeout configuré:', api.defaults.timeout, 'ms');
        
        // Vérifier l'état de la connexion
        const netInfo = await NetInfo.fetch();
        console.error(`- État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
      }
      
      throw error;
    }
  }

  static async joinRoom(roomCode: string) {
    try {
      console.log(`🚪 Tentative de rejoindre la salle ${roomCode}`);
      
      // Vérification de la connexion internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.error('❌ Pas de connexion internet disponible');
        throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
      }

      // Vérification et initialisation de la connexion WebSocket
      if (!SocketService.isConnected()) {
        console.log('⚠️ WebSocket non connecté. Tentative de reconnexion...');
        try {
          const socket = SocketService.reconnect();
          // Attendre un peu pour que la connexion s'établisse
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (!socket.connected) {
            console.log('⚠️ WebSocket toujours non connecté après tentative. Continuons avec la requête HTTP...');
          } else {
            console.log('✅ WebSocket reconnecté avec succès');
          }
        } catch (wsError) {
          console.error('❌ Échec de la reconnexion WebSocket:', wsError);
          // Continuons avec la requête HTTP même si WebSocket échoue
        }
      }

      // Récupération du token d'authentification
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        console.error('❌ Aucun token d\'authentification trouvé');
        throw new Error('Vous n\'êtes pas authentifié. Veuillez vous reconnecter.');
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      console.log(`🌐 Envoi de la requête pour rejoindre la salle ${roomCode}`);
      const response = await api.post(`/rooms/${roomCode}/join`, {}, { headers });
      console.log('✅ Salle rejointe avec succès:', response.data?.status);
      
      // Rejoindre le canal WebSocket de la salle, même si la connexion échoue,
      // cela permettra de rejoindre automatiquement lors de la reconnexion
      SocketService.joinRoom(roomCode);
      
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la tentative de rejoindre la salle ${roomCode}:`, error);
      throw error;
    }
  }
}

export default RoomService;
