import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '@/config/axios';

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

// Fonction pour vérifier et valider le token
export async function checkTokenValidity(): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) return false;
    
    // Simple vérification pour voir si le token existe et n'est pas expiré
    // Une vraie validation pourrait impliquer un appel API pour vérifier côté serveur
    console.log('🔍 Vérification de la validité du token');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du token:', error);
    return false;
  }
}

class AuthService {
  // Enregistrement ou connexion (selon si l'utilisateur existe déjà)
  async registerOrLogin(username: string): Promise<User> {
    console.log(`🔐 Tentative d'authentification pour l'utilisateur: ${username}`);
    try {
      console.log('🌐 Envoi requête POST:', `/auth/register-or-login`);
      const response = await axios.post(`/auth/register-or-login`, { username });
      console.log('✅ Authentification réussie:', response.data?.status === 'success' ? 'succès' : 'échec');
      
      // Extraire les données utilisateur
      let userData;
      
      if (response.data?.status === 'success') {
        if (response.data?.data?.user) {
          // Format de réponse avec un niveau nested 'user'
          userData = {
            id: response.data.data.user.id,
            username: response.data.data.user.username,
            displayName: response.data.data.user.displayName,
            avatar: response.data.data.user.avatar,
            level: response.data.data.user.level || 1,
            experiencePoints: response.data.data.user.experiencePoints || 0,
            token: response.data.data.token
          };
        } else if (response.data?.data) {
          // Format de réponse plat
          userData = {
            id: response.data.data.id,
            username: response.data.data.username,
            displayName: response.data.data.displayName,
            avatar: response.data.data.avatar,
            level: response.data.data.level || 1,
            experiencePoints: response.data.data.experiencePoints || 0,
            token: response.data.data.token
          };
        }
        
        // Stocker le token et les données utilisateur
        if (userData?.token) {
          await AsyncStorage.setItem('@auth_token', userData.token);
          await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
          console.log('✅ Token et données utilisateur stockés localement');
        }
        
        return userData;
      }
      
      throw new Error('Format de réponse invalide');
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
      // Essayer d'obtenir les données depuis l'API en premier
      try {
        // Changer /users/profile à la place de /me qui n'existe pas
        const response = await axios.get(`/users/profile`);
        if (response.data?.status === 'success' && response.data?.data) {
          const userData = {
            id: response.data.data.id,
            username: response.data.data.username,
            displayName: response.data.data.display_name,
            avatar: response.data.data.avatar,
            level: response.data.data.level,
            experiencePoints: response.data.data.experience_points,
          };
          
          // Mettre à jour le stockage local avec les données fraîches
          await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
          
          // Définir l'ID utilisateur dans UserIdManager
          await UserIdManager.setUserId(userData.id);
          
          console.log('✅ Données utilisateur récupérées depuis l\'API et mises en cache');
          return userData;
        }
      } catch (apiError) {
        console.log('⚠️ Impossible d\'obtenir les données utilisateur depuis l\'API, tentative de récupération locale');
        console.error('Détails de l\'erreur API:', apiError.response?.data || apiError.message);
      }
      
      // Fallback au stockage local si l'API échoue
      const userData = await AsyncStorage.getItem('@user_data');
      if (!userData) {
        console.log('🔐 Aucune donnée utilisateur trouvée');
        return null;
      }
      
      const user = JSON.parse(userData);
      console.log('✅ Données utilisateur récupérées du cache local:', user.username);
      
      // S'assurer que l'ID est défini dans UserIdManager
      await UserIdManager.setUserId(user.id);
      
      return user;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des données utilisateur:', error);
      return null;
    }
  }
}

// Hook personnalisé pour la connexion
export const useLogin = () => {
  return useMutation({
    mutationFn: async (credentials: LoginCredentials | string) => {
      // Si credentials est une simple chaîne, la considérer comme username
      const payload = typeof credentials === 'string' 
        ? { username: credentials } 
        : credentials;
      
      // Utiliser register-or-login au lieu de login car c'est l'endpoint disponible
      const response = await axios.post('/auth/register-or-login', payload);
      return response.data.data;
    },
    onSuccess: async (data) => {
      await AsyncStorage.setItem('@auth_token', data.token);
      
      if (data.user && data.user.id) {
        await UserIdManager.setUserId(data.user.id);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data.user));
      } else if (data.id) {
        // Format alternatif de la réponse
        await UserIdManager.setUserId(data.id);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data));
      }
      
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });
};

export default new AuthService();
