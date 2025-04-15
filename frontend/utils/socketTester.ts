import axios from 'axios';
import SocketService from '@/services/socketService';
import { SOCKET_URL, API_URL } from '@/config/axios';
import UserIdManager from './userIdManager';
import GameWebSocketService from '@/services/gameWebSocketService';
import { Alert } from 'react-native';

/**
 * Utilitaire pour tester la connexion WebSocket
 */
export const testSocketConnection = async () => {
  console.log('🧪 Démarrage du test de connexion WebSocket...');
  
  try {
    // Utiliser la méthode asynchrone pour obtenir une instance valide
    const socket = await SocketService.getInstanceAsync();
    
    console.log(`🔌 URL WebSocket: ${SOCKET_URL}`);
    console.log(`🔌 Socket ID: ${socket.id || 'non connecté'}`);
    console.log(`🔌 État de connexion: ${socket.connected ? 'connecté' : 'déconnecté'}`);
    
    // Vérifier d'abord si le socket est connecté avant d'ajouter des écouteurs
    if (!socket.connected) {
      console.log('⚠️ Socket non connecté, attente de connexion...');
      return false;
    }
    
    // Ajouter un écouteur temporaire pour les messages de test
    socket.on('pong', (data) => {
      console.log('✅ Réponse ping reçue:', data);
    });
    
    // Envoyer un ping pour tester la communication bidirectionnelle
    console.log('🏓 Envoi d\'un ping au serveur...');
    socket.emit('ping', (response) => {
      console.log('✅ Réponse ping (callback) reçue:', response);
    });
    
    // Nettoyer les écouteurs après 5 secondes
    setTimeout(() => {
      if (socket.connected) {
        socket.off('pong');
        console.log('🧹 Écouteurs nettoyés');
      }
    }, 5000);
    
    return true;
  } catch (error) {
    console.error('❌ Erreur lors du test de connexion WebSocket:', error);
    return false;
  }
};

/**
 * Teste la soumission d'une réponse via WebSocket, avec repli vers HTTP en cas d'échec
 * @param gameId ID de la partie
 * @param questionId ID de la question
 * @param content Contenu de la réponse
 * @returns {Promise<boolean>} true si la soumission a réussi, false sinon
 */
export const testAnswerSubmission = async (
  gameId: string | number,
  questionId: string | number,
  content: string
): Promise<boolean> => {
  console.log(`🧪 Test de soumission de réponse - Game: ${gameId}, Question: ${questionId}`);
  
  try {
    // D'abord essayer via WebSocket
    console.log('🔌 Tentative via WebSocket...');
    
    try {
      const result = await GameWebSocketService.submitAnswer(
        String(gameId),
        String(questionId),
        content
      );
      
      if (result) {
        console.log('✅ Réponse soumise avec succès via WebSocket');
        return true;
      }
    } catch (wsError) {
      console.warn('⚠️ Échec de la soumission via WebSocket, tentative via HTTP:', wsError);
    }
    
    // Si WebSocket échoue, utiliser HTTP comme solution de repli
    console.log('🌐 Tentative via HTTP...');
    const userId = await UserIdManager.getUserId();
    
    const response = await axios.post(`${API_URL}/games/${gameId}/answer`, {
      question_id: questionId,
      content: content,
      user_id: userId,
    }, {
      headers: {
        'X-Retry-Mode': 'true',  // Indiquer qu'il s'agit d'une tentative de récupération
      },
      timeout: 5000  // Timeout de 5 secondes
    });
    
    if (response.data?.status === 'success') {
      console.log('✅ Réponse soumise avec succès via HTTP (solution de repli)');
      return true;
    } else {
      console.error('❌ Échec de la soumission via HTTP:', response.data);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test de soumission de réponse:', error);
    
    // Afficher une alerte utilisateur en cas d'échec complet
    Alert.alert(
      'Erreur de communication',
      'Impossible de soumettre votre réponse. Veuillez vérifier votre connexion et réessayer.',
      [{ text: 'OK' }]
    );
    
    return false;
  }
};

/**
 * Teste la soumission d'un vote via HTTP REST directement
 * @param gameId ID de la partie
 * @param answerId ID de la réponse
 * @param questionId ID de la question
 * @returns {Promise<boolean>} true si la soumission a réussi, false sinon
 */
export const testVoteSubmission = async (
  gameId: string | number,
  answerId: string | number,
  questionId: string | number
): Promise<boolean> => {
  console.log(`🧪 Test de soumission de vote - Game: ${gameId}, Answer: ${answerId}`);
  
  try {
    // Récupérer l'ID utilisateur
    const userId = await UserIdManager.getUserId();
    
    // Utiliser directement HTTP REST pour fiabilité maximale
    console.log('🌐 Envoi du vote via HTTP REST...');
    
    const response = await axios.post(`${API_URL}/games/${gameId}/vote`, {
      answer_id: answerId,
      question_id: questionId,
      voter_id: userId,
    }, {
      timeout: 8000  // Timeout augmenté pour assurer la réception
    });
    
    if (response.data?.status === 'success') {
      console.log('✅ Vote soumis avec succès via HTTP');
      return true;
    } else {
      console.error('❌ Réponse du serveur inattendue:', response.data);
      throw new Error(response.data?.error || 'Échec de la soumission via HTTP');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test de soumission de vote:', error);
    
    // Afficher une alerte utilisateur en cas d'échec complet
    Alert.alert(
      'Erreur de communication',
      'Impossible de soumettre votre vote. Veuillez vérifier votre connexion et réessayer.',
      [{ text: 'OK' }]
    );
    
    return false;
  }
};

/**
 * Optimise la connexion WebSocket en cas de problème
 * Cette fonction est utilisée par errorHandler.ts
 * @returns {Promise<boolean>} true si l'optimisation a réussi, false sinon
 */
export const optimizeWebSocketConnection = async (): Promise<boolean> => {
  console.log('🔧 Tentative d\'optimisation de la connexion WebSocket...');
  
  try {
    // Fermer et réinitialiser la connexion actuelle
    await SocketService.disconnect();
    
    // Attendre un court délai
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Établir une nouvelle connexion
    const socket = await SocketService.getInstanceAsync(true);
    
    // Vérifier si la nouvelle connexion est établie
    if (socket && socket.connected) {
      console.log('✅ Connexion WebSocket optimisée avec succès');
      return true;
    } else {
      console.log('⚠️ Échec de l\'optimisation de la connexion WebSocket');
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'optimisation de la connexion WebSocket:', error);
    return false;
  }
};

/**
 * Vérifie l'état de santé global des WebSockets et tente des réparations si nécessaire
 * @returns Objet avec le diagnostic et les actions effectuées
 */
export const diagnoseAndRepairWebSockets = async () => {
  console.log('🩺 Diagnostic WebSocket en cours...');
  
  const diagnostics = {
    initialSocketConnected: false,
    reconnectionAttempted: false,
    reconnectionSuccess: false,
    finalSocketConnected: false,
    latency: -1,
    repaired: false
  };
  
  try {
    // Vérifier l'état initial de la connexion
    const initialSocket = SocketService.getInstance();
    diagnostics.initialSocketConnected = initialSocket?.connected || false;
    
    if (!diagnostics.initialSocketConnected) {
      // Tenter une reconnexion
      console.log('🔄 Tentative de reconnexion WebSocket...');
      diagnostics.reconnectionAttempted = true;
      
      // Mesurer le temps de réponse
      const startTime = Date.now();
      
      try {
        const newSocket = await SocketService.getInstanceAsync(true);
        const endTime = Date.now();
        diagnostics.latency = endTime - startTime;
        diagnostics.reconnectionSuccess = newSocket?.connected || false;
        diagnostics.finalSocketConnected = newSocket?.connected || false;
        
        // Si la reconnexion a réussi
        if (diagnostics.reconnectionSuccess) {
          console.log(`✅ Reconnexion WebSocket réussie (latence: ${diagnostics.latency}ms)`);
          diagnostics.repaired = true;
        }
      } catch (reconnectError) {
        console.error('❌ Échec de la reconnexion WebSocket:', reconnectError);
      }
    } else {
      console.log('✅ Connexion WebSocket déjà établie');
      
      // Mesurer la latence avec un ping/pong
      const startTime = Date.now();
      try {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Timeout')), 3000);
          initialSocket.emit('ping', () => {
            clearTimeout(timeoutId);
            diagnostics.latency = Date.now() - startTime;
            resolve();
          });
        });
        console.log(`📊 Latence WebSocket: ${diagnostics.latency}ms`);
      } catch (pingError) {
        console.warn('⚠️ Erreur lors de la mesure de latence:', pingError);
      }
      
      diagnostics.finalSocketConnected = initialSocket.connected;
    }
    
    return diagnostics;
    
  } catch (error) {
    console.error('❌ Erreur lors du diagnostic WebSocket:', error);
    return {
      ...diagnostics,
      error: error.message
    };
  }
};
