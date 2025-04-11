import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config/axios';
import NetInfo from '@react-native-community/netinfo';
import SocketService from '@/services/socketService'; // Ajout de l'import manquant

export interface Room {
  id: number;
  code: string;
  name: string;
  host: {
    id: number;
    username: string;
    displayName: string;
    avatar?: string;
  };
  status: 'waiting' | 'playing' | 'finished';
  isPrivate: boolean;
  maxPlayers: number;
  gameMode: string;
  totalRounds: number;
  players: Array<{
    id: number;
    username: string;
    displayName: string;
    avatar?: string;
    level: number;
    isHost: boolean;
    isReady: boolean;
    score?: number;
  }>;
  createdAt: string;
  startedAt?: string;
}

export interface CreateRoomPayload {
  name: string;
  game_mode: string;
  is_private?: boolean;
  max_players?: number;
  total_rounds?: number;
  settings?: Record<string, any>;
}

export interface ReadyStatusPayload {
  is_ready: boolean;
}

class RoomService {
  private async getAuthHeader() {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      console.log('🔐 Token récupéré pour requête:', token ? 'trouvé' : 'non trouvé');
      return {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du token:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  }
  
  private async checkNetworkConnection() {
    const netInfo = await NetInfo.fetch();
    const isConnected = netInfo.isConnected;
    
    if (!isConnected) {
      console.error(`❌ Pas de connexion réseau (Type: ${netInfo.type})`);
      throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
    }
    
    return true;
  }

  // Liste toutes les salles disponibles
  async getRooms(): Promise<Room[]> {
    console.log('📋 Récupération de la liste des salles');
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/rooms`;
      console.log('🌐 Envoi requête GET:', url);
      
      // Ajouter un timeout plus long pour les appareils à connexion lente
      const response = await axios.get(url, { 
        headers,
        timeout: 20000 // 20 secondes
      });
      
      console.log('✅ Réponse salles reçue:', response.status);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des salles:', error);
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Connexion au serveur impossible.');
        console.error('- URL tentée:', `${API_URL}/rooms`);
        
        const netInfo = await NetInfo.fetch();
        console.error(`- État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
      } else {
        console.error('Détails:', error.response?.data || error.message);
      }
      
      throw error;
    }
  }

  // Récupère les détails d'une salle spécifique
  async getRoomByCode(roomCode: string): Promise<Room> {
    console.log(`🔍 Récupération des détails de la salle ${roomCode}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/rooms/${roomCode}`;
      console.log('🌐 Envoi requête GET:', url);
      
      const response = await axios.get(url, { 
        headers,
        timeout: 20000 // 20 secondes
      });
      
      console.log('✅ Détails de la salle reçus:', response.status);
      return response.data.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la récupération de la salle ${roomCode}:`, error);
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Connexion au serveur impossible.');
        
        const netInfo = await NetInfo.fetch();
        console.error(`- État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
      } else {
        console.error('Détails:', error.response?.data || error.message);
      }
      
      throw error;
    }
  }

  // Crée une nouvelle salle
  async createRoom(payload: CreateRoomPayload): Promise<Room> {
    console.log('🏗️ Création d\'une nouvelle salle avec payload:', payload);
    try {
      await this.checkNetworkConnection();
      
      // Format simplifié sans transformations complexes
      const formattedPayload = {
        name: payload.name,
        game_mode: payload.game_mode,
        max_players: payload.max_players || 6,
        total_rounds: payload.total_rounds || 5,
        is_private: payload.is_private || false,
      };
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/rooms`;
      console.log('🌐 Envoi requête POST:', url, formattedPayload);
      
      const response = await axios.post(url, formattedPayload, { 
        headers,
        timeout: 20000 // 20 secondes
      });
      
      console.log('✅ Salle créée avec succès:', response.status);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Erreur lors de la création de la salle:', error);
      
      // Afficher des détails plus précis sur l'erreur
      if (error.response?.data) {
        console.error('Détails:', error.response.data);
      }
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Connexion au serveur impossible.');
        
        const netInfo = await NetInfo.fetch();
        console.error(`- État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
        console.error(`- URL API configurée: ${API_URL}`);
        
        throw new Error('Problème de connexion au serveur. Veuillez vérifier votre connexion internet et réessayer.');
      } else {
        console.error('Détails:', error.response?.data || error.message);
      }
      
      throw error;
    }
  }

  // Rejoindre une salle
  async joinRoom(roomCode: string): Promise<{ status: string; message: string }> {
    console.log(`🚪 Tentative de rejoindre la salle ${roomCode}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/rooms/${roomCode}/join`;
      console.log('🌐 Envoi requête POST:', url);
      
      try {
        const response = await axios.post(url, {}, { 
          headers,
          timeout: 20000 // 20 secondes
        });
        
        console.log('✅ Salle rejointe avec succès:', response.status);
        
        // Rejoindre également via WebSocket après succès HTTP en utilisant try/catch
        try {
          // Utilisation sécurisée avec import existant
          SocketService.joinRoom(roomCode);
          console.log(`✅ Demande WebSocket pour rejoindre la salle ${roomCode} envoyée`);
        } catch (socketError) {
          console.error('❌ Erreur WebSocket ignorée:', socketError);
          // Continue malgré l'erreur WebSocket car la requête HTTP a réussi
        }
        
        return response.data;
      } catch (axiosError: any) {
        console.error(`❌ Erreur HTTP lors de la tentative de rejoindre la salle ${roomCode}:`, 
          axiosError.response?.status || 'Sans statut', 
          axiosError.response?.data || axiosError.message);
        throw axiosError;
      }
    } catch (error: any) {
      console.error(`❌ Erreur lors de la tentative de rejoindre la salle ${roomCode}:`, error);
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Connexion au serveur impossible.');
        
        const netInfo = await NetInfo.fetch();
        console.error(`- État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
        
        throw new Error('Problème de connexion au serveur. Veuillez vérifier votre connexion internet et réessayer.');
      } else {
        console.error('Détails:', error.response?.data || error.message);
      }
      
      throw error;
    }
  }

  // Quitter une salle
  async leaveRoom(roomCode: string): Promise<{ status: string; message: string }> {
    console.log(`🚶 Tentative de quitter la salle ${roomCode}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/rooms/${roomCode}/leave`;
      console.log('🌐 Envoi requête POST:', url);
      
      const response = await axios.post(url, {}, { 
        headers,
        timeout: 20000 // 20 secondes
      });
      
      console.log('✅ Salle quittée avec succès:', response.status);
      
      // Également quitter la salle via WebSocket
      try {
        SocketService.leaveRoom(roomCode);
        console.log(`✅ Demande WebSocket pour quitter la salle ${roomCode} envoyée`);
      } catch (socketError) {
        console.error('❌ Erreur WebSocket ignorée lors de la tentative de quitter:', socketError);
      }
      
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la tentative de quitter la salle ${roomCode}:`, error);
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Connexion au serveur impossible.');
        
        const netInfo = await NetInfo.fetch();
        console.error(`- État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
      } else {
        console.error('Détails:', error.response?.data || error.message);
      }
      
      throw error;
    }
  }

  // Changer le statut "prêt" d'un joueur
  async toggleReadyStatus(roomCode: string, isReady: boolean): Promise<{ status: string; message: string; data: { isReady: boolean } }> {
    console.log(`🔄 Mise à jour du statut dans la salle ${roomCode}:`, isReady ? 'prêt' : 'pas prêt');
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const payload: ReadyStatusPayload = { is_ready: isReady };
      const url = `${API_URL}/rooms/${roomCode}/ready`;
      console.log('🌐 Envoi requête POST:', url, payload);
      
      const response = await axios.post(url, payload, { 
        headers,
        timeout: 20000 // 20 secondes
      });
      
      console.log('✅ Statut mis à jour avec succès:', response.status);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la mise à jour du statut dans la salle ${roomCode}:`, error);
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Connexion au serveur impossible.');
        
        const netInfo = await NetInfo.fetch();
        console.error(`- État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
      } else {
        console.error('Détails:', error.response?.data || error.message);
      }
      
      throw error;
    }
  }

  // Démarrer la partie
  async startGame(roomCode: string): Promise<{ status: string; message: string; data: { gameId: number } }> {
    console.log(`🚀 Tentative de démarrage de la partie dans la salle ${roomCode}`);
    try {
      await this.checkNetworkConnection();
      
      const headers = await this.getAuthHeader();
      const url = `${API_URL}/rooms/${roomCode}/start`;
      console.log('🌐 Envoi requête POST:', url);
      
      const response = await axios.post(url, {}, { 
        headers,
        timeout: 20000 // 20 secondes
      });
      
      console.log('✅ Partie démarrée avec succès:', response.status);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors du démarrage de la partie dans la salle ${roomCode}:`, error);
      
      if (error.message.includes('Network Error')) {
        console.error('❌ Erreur réseau détectée. Connexion au serveur impossible.');
        
        const netInfo = await NetInfo.fetch();
        console.error(`- État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
        
        throw new Error('Problème de connexion au serveur. Veuillez vérifier votre connexion internet et réessayer.');
      } else {
        console.error('Détails:', error.response?.data || error.message);
      }
      
      throw error;
    }
  }
}

export const roomService = new RoomService();
