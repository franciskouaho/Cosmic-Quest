import axios from '@/config/axios'; // Remplace l'importation de api
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

      // Plus besoin de gérer l'authentification ici, c'est fait dans l'intercepteur
      console.log('🌐 Envoi de la requête de création de salle');
      const response = await axios.post('/rooms', payload);
      console.log('✅ Salle créée avec succès:', response.data?.status);
      
      return response.data;
    } catch (error: any) {
      console.error('❌ Erreur lors de la création de la salle:', error);
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Détails supplémentaires:');
        console.error('- URL API configurée:', axios.defaults.baseURL);
        console.error('- Timeout configuré:', axios.defaults.timeout, 'ms');
        
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

      console.log(`🌐 Envoi de la requête pour rejoindre la salle ${roomCode}`);
      
      // Première étape : vérifier l'état de la connexion WebSocket mais sans dépendre du résultat
      const isSocketConnected = SocketService.isConnected();
      console.log(`🔌 État de la connexion WebSocket: ${isSocketConnected ? 'Connecté' : 'Non connecté'}`);
      
      // Deuxième étape : effectuer la requête HTTP (sans besoin de gérer manuellement l'authentification)
      const response = await axios.post(`/rooms/${roomCode}/join`, {});
      console.log('✅ Salle rejointe avec succès:', response.data?.status);
      
      // Troisième étape : essayer d'envoyer un message WebSocket dans un bloc try-catch séparé
      try {
        // Appel direct sans stocker de référence intermédiaire
        import('./socketService').then(module => {
          const socketServiceModule = module.default;
          socketServiceModule.joinRoom(roomCode);
          console.log(`✅ Demande WebSocket pour rejoindre la salle ${roomCode} envoyée`);
        }).catch(err => {
          console.error('❌ Erreur lors du chargement du module socketService:', err);
        });
      } catch (socketError) {
        // Ne pas faire échouer l'opération à cause d'une erreur WebSocket
        console.error('❌ Erreur WebSocket ignorée:', socketError);
      }
      
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la tentative de rejoindre la salle ${roomCode}:`, error);
      throw error;
    }
  }
}

export default RoomService;
