import axios from 'axios';
import { getToken } from './auth';
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
  private async getAuthHeader() {
    const token = await getToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  // Récupérer le profil de l'utilisateur
  async getUserProfile() {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get(`${API_URL}/users/profile`, { headers });
      return response.data.data;
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error);
      throw error;
    }
  }

  // Récupérer les statistiques de l'utilisateur
  async getUserStats(): Promise<UserStats> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get(`${API_URL}/users/stats`, { headers });
      return response.data.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw error;
    }
  }

  // Récupérer les salles récentes de l'utilisateur
  async getUserRecentRooms(): Promise<UserRecentRoom[]> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get(`${API_URL}/users/recent-rooms`, { headers });
      return response.data.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des salles récentes:', error);
      throw error;
    }
  }

  // Mettre à jour le profil utilisateur
  async updateUserProfile(data: { username?: string; display_name?: string; avatar?: string }) {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.patch(`${API_URL}/users/profile`, data, { headers });
      return response.data.data;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
