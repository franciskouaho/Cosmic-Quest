import axios from '@/config/axios';
import { API_URL } from '@/config/axios';

export interface UserStats {
  games_played: number;
  games_won: number;
  win_rate: number;
  level: number;
  experience_points: number;
  experience_to_next_level: number;
  last_seen_at: string;
}

export interface UserRecentRoom {
  id: number;
  code: string;
  name: string;
  game_mode: string;
  status: string;
  joined_at: string;
}

class UserService {
  // Récupérer le profil de l'utilisateur
  async getUserProfile() {
    try {
      console.log('👤 UserService: Récupération du profil utilisateur');
      const response = await axios.get(`/users/profile`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du profil:', error);
      throw error;
    }
  }

  // Récupérer les statistiques de l'utilisateur
  async getUserStats(): Promise<UserStats> {
    try {
      console.log('📊 UserService: Récupération des statistiques utilisateur');
      const response = await axios.get(`/users/stats`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  }

  // Récupérer les salles récentes de l'utilisateur
  async getUserRecentRooms(): Promise<UserRecentRoom[]> {
    try {
      console.log('🏠 UserService: Récupération des salles récentes');
      const response = await axios.get(`/users/recent-rooms`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des salles récentes:', error);
      throw error;
    }
  }

  // Mettre à jour le profil utilisateur
  async updateUserProfile(data: { username?: string; display_name?: string; avatar?: string }) {
    try {
      console.log('✏️ UserService: Mise à jour du profil utilisateur');
      const response = await axios.patch(`/users/profile`, data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du profil:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
