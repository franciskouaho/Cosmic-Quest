import axios from 'axios';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Configuration pour les appels API

// URL de base pour les requêtes API REST - à adapter selon l'environnement
export const API_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:3333/api/v1'  // Android emulator
  : 'http://localhost:3333/api/v1'; // iOS simulator or web

// URL pour les connexions WebSocket - à adapter selon l'environnement
export const WS_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:3333'  // Android emulator
  : 'http://localhost:3333'; // iOS simulator or web

console.log('📱 Platform.OS:', Platform.OS);
console.log('🌍 API_URL configuré:', API_URL);
console.log('🔌 WS_URL configuré:', WS_URL);

// Vérifier périodiquement la connectivité
NetInfo.addEventListener(state => {
  console.log('🌐 État de connexion:', 
    state.isConnected 
      ? `Connecté (${state.type})` 
      : 'Non connecté');
});

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

// Log toutes les requêtes
api.interceptors.request.use(config => {
  console.log('➡️ Requête sortante:', {
    method: config.method,
    url: config.url,
    data: config.data,
    headers: config.headers,
    baseURL: config.baseURL
  });
  return config;
}, error => {
  console.error('❌ Erreur lors de la préparation de la requête:', error);
  return Promise.reject(error);
});

// Log toutes les réponses
api.interceptors.response.use(
  response => {
    console.log('✅ Réponse reçue:', {
      status: response.status,
      data: JSON.stringify(response.data).substring(0, 200) + (JSON.stringify(response.data).length > 200 ? '...' : '')
    });
    return response;
  },
  async error => {
    if (error.response) {
      // La requête a été faite et le serveur a répondu avec un status code
      console.error('❌ Erreur API (réponse serveur):', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      // La requête a été faite mais aucune réponse n'a été reçue
      console.error('❌ Erreur API (pas de réponse):', error.message);
      
      // Vérifier l'état de la connexion
      const netInfo = await NetInfo.fetch();
      console.error(`🌐 État connexion lors de l'erreur: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
    } else {
      // Une erreur s'est produite lors de la configuration de la requête
      console.error('❌ Erreur API (configuration):', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
