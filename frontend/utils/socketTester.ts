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
export const testSubmitAnswer = async (
  gameId: string | number, 
  questionId: string | number, 
  content: string
): Promise<boolean> => {
  console.log(`🧪 Test de soumission de réponse - Game: ${gameId}, Question: ${questionId}`);
  
  try {
    // Récupérer l'ID utilisateur
    const userId = await UserIdManager.getUserId();
    if (!userId) {
      console.error('❌ ID utilisateur non disponible pour le test');
      return false;
    }
    
    // 1. Essayer d'abord via WebSocket
    console.log('🔌 Tentative via WebSocket...');
    try {
      const socket = await SocketService.getInstanceAsync();
      
      if (!socket.connected) {
        throw new Error('Socket non connecté');
      }
      
      return new Promise((resolve) => {
        // Définir un timeout pour limiter l'attente
        const timeout = setTimeout(() => {
          console.warn('⚠️ Timeout WebSocket atteint, fallback vers HTTP...');
          resolve(false);
        }, 3000);
        
        // Tentative via WebSocket
        socket.emit('game:submit_answer', {
          gameId,
          questionId,
          content,
          userId
        }, (response: any) => {
          clearTimeout(timeout);
          
          if (response?.success) {
            console.log('✅ Réponse soumise avec succès via WebSocket');
            resolve(true);
          } else {
            console.warn('⚠️ Échec de soumission via WebSocket:', response?.error);
            resolve(false);
          }
        });
      });
    } catch (wsError) {
      console.warn('⚠️ Erreur WebSocket:', wsError.message);
      // Continuer avec HTTP en cas d'erreur WebSocket
    }
    
    // 2. Fallback: Essayer via HTTP REST
    console.log('🌐 Tentative via HTTP REST...');
    const response = await axios.post(`${API_URL}/games/${gameId}/answer`, {
      question_id: questionId,
      content,
      user_id: userId
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'userId': userId
      }
    });
    
    console.log('✅ Réponse soumise avec succès via HTTP');
    
    // 3. Attendre une synchronisation
    setTimeout(async () => {
      // Forcer une mise à jour de l'état du jeu
      await GameWebSocketService.getInstance().getGameState(String(gameId), true);
    }, 1000);
    
    return true;
  } catch (error) {
    console.error('❌ Erreur lors du test de soumission de réponse:', error);
    return false;
  }
};

/**
 * Vérifie si un jeu semble bloqué et tente de débloquer
 * @param gameId ID de la partie à vérifier
 * @returns {Promise<boolean>} true si une action de déblocage a été tentée
 */
export const checkAndUnblockGame = async (gameId: string): Promise<boolean> => {
  try {
    console.log(`🔍 Vérification de blocage pour le jeu ${gameId}...`);
    
    // Récupérer l'état complet du jeu
    const gameState = await GameWebSocketService.getInstance().getGameState(gameId, true);
    
    if (!gameState) {
      console.error("❌ Impossible de récupérer l'état du jeu");
      return false;
    }
    
    const { game, answers, currentQuestion, players } = gameState;
    
    // Vérifier si nous sommes potentiellement bloqués en phase answer
    if (game?.currentPhase === 'answer') {
      // Compter combien de joueurs peuvent répondre (tous sauf la cible)
      const nonTargetPlayers = players.filter(p => 
        p.id !== String(currentQuestion?.targetPlayer?.id)
      ).length;
      
      // Compter les réponses déjà soumises
      const answersSubmitted = answers?.length || 0;
      
      console.log(`🔍 Phase answer: ${answersSubmitted}/${nonTargetPlayers} réponses soumises`);
      
      // Si toutes les réponses sont soumises mais nous sommes toujours en phase answer
      if (answersSubmitted >= nonTargetPlayers && nonTargetPlayers > 0) {
        console.log(`⚠️ Blocage potentiel détecté: Toutes les réponses soumises mais toujours en phase answer`);
        
        // Tenter de forcer une vérification de phase sur le serveur
        await GameWebSocketService.getInstance().forceCheckPhase(gameId);
        console.log(`🔄 Tentative de déblocage effectuée pour le jeu ${gameId}`);
        return true;
      }
    }
    
    // Vérifier si nous sommes potentiellement bloqués en phase vote
    if (game?.currentPhase === 'vote') {
      // Vérifier si le temps écoulé est excessif (plus de 2 minutes)
      const currentTime = Date.now();
      const phaseStartTime = game?.phaseStartTime || 0;
      
      if (phaseStartTime && (currentTime - phaseStartTime > 120000)) {
        console.log(`⚠️ Blocage potentiel détecté: Phase vote active depuis plus de 2 minutes`);
        
        // Tenter de forcer une vérification de phase sur le serveur
        await GameWebSocketService.getInstance().forceCheckPhase(gameId);
        console.log(`🔄 Tentative de déblocage effectuée pour le jeu ${gameId}`);
        return true;
      }
    }
    
    console.log(`✅ Aucun blocage détecté pour le jeu ${gameId}`);
    return false;
  } catch (error) {
    console.error(`❌ Erreur lors de la vérification de blocage:`, error);
    return false;
  }
};
