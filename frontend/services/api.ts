import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { API_URL } from '@/config/axios';

// Créer une instance axios avec la configuration de base
const api = axios.create({
  baseURL: API_URL,
  timeout: 20000, // 20 secondes
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token d'authentification à chaque requête
api.interceptors.request.use(
  async (config) => {
    try {
      // Vérifier la connexion internet avant d'envoyer la requête
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
      }
      
      // Récupérer le token depuis AsyncStorage
      const token = await AsyncStorage.getItem('@auth_token');
      
      // Log pour déboguer
      console.log(`🔐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      console.log(`🔑 Token présent: ${!!token}`);
      
      // Si le token existe, l'ajouter aux headers
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      return config;
    } catch (error) {
      console.error("❌ Erreur dans l'intercepteur de requête:", error);
      return Promise.reject(error);
    }
  },
  (error) => {
    console.error('❌ Erreur de configuration de requête:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs de réponse
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Extraire la configuration de la requête pour potentiellement la réessayer
    const originalRequest = error.config;
    
    // Si l'erreur est due à un token expiré (401) et qu'on n'a pas déjà essayé de rafraîchir le token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        console.log('🔄 Tentative de reconnexion automatique après erreur 401');
        
        // Rediriger vers la page de connexion ou essayer de rafraîchir le token
        // C'est ici qu'on pourrait implémenter une logique de rafraîchissement de token
        
        // Pour l'instant, on supprime simplement le token pour forcer la reconnexion
        await AsyncStorage.removeItem('@auth_token');
        console.log('🔑 Token supprimé après erreur 401');
        
        // Retourner l'erreur pour que l'utilisateur soit redirigé vers la page de connexion
        return Promise.reject(error);
      } catch (refreshError) {
        console.error('❌ Erreur lors de la tentative de reconnexion:', refreshError);
        return Promise.reject(refreshError);
      }
    }
    
    // Pour les autres erreurs, ajouter des logs détaillés pour le débogage
    console.error(`❌ Erreur API: ${error.response?.status || 'Réseau'} - ${error.message}`);
    if (error.response?.data) {
      console.error('Détails de l\'erreur:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

export default api;
