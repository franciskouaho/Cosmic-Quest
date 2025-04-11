import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config/axios';

export interface User {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  level: number;
  experiencePoints: number;
  token?: string;
}

// Mettre à jour l'interface pour correspondre à la structure réelle de la réponse
interface AuthResponse {
  status: string;
  message: string;
  data: {
    id: number;
    username: string;
    displayName: string;
    avatar: string | null;
    level?: number;
    experiencePoints?: number;
    token: string;
    created_at?: string;
  };
}

// Fonction pour récupérer le token
export async function getToken(): Promise<string | null> {
  console.log('🔐 Récupération du token d\'authentification');
  try {
    const token = await AsyncStorage.getItem('@auth_token');
    console.log('🔐 Token trouvé:', token ? 'oui' : 'non');
    return token;
  } catch (error) {
    console.error('🔐 Erreur lors de la récupération du token:', error);
    return null;
  }
}

class AuthService {
  // Enregistrement ou connexion (selon si l'utilisateur existe déjà)
  async registerOrLogin(username: string): Promise<AuthResponse> {
    console.log(`🔐 Tentative d'authentification pour l'utilisateur: ${username}`);
    try {
      console.log('🌐 Envoi requête POST:', `${API_URL}/auth/register-or-login`);
      const response = await axios.post(`${API_URL}/auth/register-or-login`, { username });
      console.log('✅ Authentification réussie:', response.data?.status === 'success' ? 'succès' : 'échec');
      
      // Stocker immédiatement le token et les données utilisateur
      if (response.data?.status === 'success' && response.data?.data) {
        const userData = {
          id: response.data.data.id,
          username: response.data.data.username,
          displayName: response.data.data.displayName,
          avatar: response.data.data.avatar,
          level: response.data.data.level || 1,
          experiencePoints: response.data.data.experiencePoints || 0,
          token: response.data.data.token
        };
        
        await Promise.all([
          AsyncStorage.setItem('@auth_token', response.data.data.token),
          AsyncStorage.setItem('@user_data', JSON.stringify(userData))
        ]);
        
        console.log('✅ Token et données utilisateur stockés localement');
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Erreur d\'authentification:', error);
      console.error('Détails:', error.response?.data || error.message);
      throw error;
    }
  }

  // Déconnexion (côté client seulement)
  async logout(): Promise<void> {
    console.log('🔐 Déconnexion en cours');
    try {
      // Pas d'appel API pour la déconnexion - juste supprimer le token côté client
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@user_data');
      console.log('✅ Déconnexion réussie, tokens supprimés');
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
      throw error;
    }
  }

  // Vérifier si l'utilisateur est connecté
  async isAuthenticated(): Promise<boolean> {
    console.log('🔐 Vérification de l\'authentification');
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const isAuth = !!token;
      console.log('🔐 Utilisateur authentifié:', isAuth ? 'oui' : 'non');
      return isAuth;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de l\'authentification:', error);
      return false;
    }
  }

  // Récupérer les informations utilisateur stockées
  async getCurrentUser(): Promise<User | null> {
    console.log('🔐 Récupération des informations utilisateur');
    try {
      const userData = await AsyncStorage.getItem('@user_data');
      if (!userData) {
        console.log('🔐 Aucune donnée utilisateur trouvée');
        return null;
      }
      
      const user = JSON.parse(userData);
      console.log('✅ Données utilisateur récupérées:', user.username);
      return user;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des données utilisateur:', error);
      return null;
    }
  }
}

export const authService = new AuthService();
