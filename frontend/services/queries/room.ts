import api from '@/services/api';
// Assurez-vous d'utiliser l'import correct
import SocketService from '@/services/socketService';

export interface Room {
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
  // Liste toutes les salles disponibles
  async getRooms(): Promise<Room[]> {
    console.log('📋 Récupération de la liste des salles');
    try {
      const url = `/rooms`;
      console.log('🌐 Envoi requête GET:', url);
      
      const response = await api.get(url);
      
      console.log('✅ Réponse salles reçue:', response.status);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des salles:', error);
      throw error;
    }
  }

  // Récupère les détails d'une salle spécifique
  async getRoomByCode(roomCode: string): Promise<Room> {
    console.log(`🔍 Récupération des détails de la salle ${roomCode}`);
    try {
      const url = `/rooms/${roomCode}`;
      console.log('🌐 Envoi requête GET:', url);
      
      const response = await api.get(url);
      
      console.log('✅ Détails de la salle reçus:', response.status);
      return response.data.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la récupération de la salle ${roomCode}:`, error);
      throw error;
    }
  }

  // Crée une nouvelle salle
  async createRoom(payload: CreateRoomPayload): Promise<Room> {
    console.log('🏗️ Création d\'une nouvelle salle avec payload:', payload);
    try {
      // Format simplifié sans transformations complexes
      const formattedPayload = {
        name: payload.name,
        game_mode: payload.game_mode,
        max_players: payload.max_players || 6,
        total_rounds: payload.total_rounds || 5,
        is_private: payload.is_private || false,
      };
      
      const url = `/rooms`;
      console.log('🌐 Envoi requête POST:', url, formattedPayload);
      
      const response = await api.post(url, formattedPayload);
      
      console.log('✅ Salle créée avec succès:', response.status);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Erreur lors de la création de la salle:', error);
      throw error;
    }
  }

  // Rejoindre une salle
  async joinRoom(roomCode: string): Promise<{ status: string; message: string }> {
    console.log(`🚪 Tentative de rejoindre la salle ${roomCode}`);
    try {
      const url = `/rooms/${roomCode}/join`;
      console.log('🌐 Envoi requête POST:', url);
      
      try {
        const response = await api.post(url, {});
        
        console.log('✅ Salle rejointe avec succès:', response.status);
        
        // Rejoindre également via WebSocket après succès HTTP en utilisant try/catch
        try {
          SocketService.joinRoom(roomCode);
          console.log(`✅ Demande WebSocket pour rejoindre la salle ${roomCode} envoyée`);
        } catch (socketError) {
          console.error('❌ Erreur WebSocket ignorée:', socketError);
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
      throw error;
    }
  }

  // Quitter une salle
  async leaveRoom(roomCode: string): Promise<{ status: string; message: string }> {
    console.log(`🚶 Tentative de quitter la salle ${roomCode}`);
    try {
      const url = `/rooms/${roomCode}/leave`;
      console.log('🌐 Envoi requête POST:', url);
      
      const response = await api.post(url, {});
      
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
      throw error;
    }
  }

  // Changer le statut "prêt" d'un joueur
  async toggleReadyStatus(roomCode: string, isReady: boolean): Promise<{ status: string; message: string; data: { isReady: boolean } }> {
    console.log(`🔄 Mise à jour du statut dans la salle ${roomCode}:`, isReady ? 'prêt' : 'pas prêt');
    try {
      const payload: ReadyStatusPayload = { is_ready: isReady };
      const url = `/rooms/${roomCode}/ready`;
      console.log('🌐 Envoi requête POST:', url, payload);
      
      const response = await api.post(url, payload);
      
      console.log('✅ Statut mis à jour avec succès:', response.status);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors de la mise à jour du statut dans la salle ${roomCode}:`, error);
      throw error;
    }
  }

  // Démarrer la partie
  async startGame(roomCode: string): Promise<{ status: string; message: string; data: { gameId: number } }> {
    console.log(`🚀 Tentative de démarrage de la partie dans la salle ${roomCode}`);
    try {
      const url = `/rooms/${roomCode}/start`;
      console.log('🌐 Envoi requête POST:', url);
      
      const response = await api.post(url, {});
      
      console.log('✅ Partie démarrée avec succès:', response.status);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Erreur lors du démarrage de la partie dans la salle ${roomCode}:`, error);
      throw error;
    }
  }
}

export const roomService = new RoomService();
