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
    
    // Utiliser une promesse avec timeout court pour test rapide
    const pingResult = await Promise.race([
      new Promise<boolean>((resolve) => {
        socket.emit('ping', (response) => {
          console.log('✅ Réponse ping (callback) reçue:', response);
          resolve(true);
        });
      }),
      new Promise<boolean>((resolve) => setTimeout(() => {
        console.log('⚠️ Timeout ping, considérant la connexion comme instable');
        resolve(false);
      }, 1000)) // Timeout à 1 seconde pour plus de réactivité
    ]);
    
    // Nettoyer les écouteurs immédiatement
    socket.off('pong');
    console.log('🧹 Écouteurs nettoyés');
    
    return pingResult;
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
export const testAndSubmitAnswer = async (gameId: string, questionId: string, content: string): Promise<boolean> => {
  try {
    // Utiliser la méthode asynchrone pour obtenir une instance valide
    const socket = await SocketService.getInstanceAsync();
    
    // Vérifier rapidement si le socket est connecté
    if (!socket.connected) {
      console.log('⚠️ Socket non connecté, utilisation HTTP immédiate...');
      return await submitAnswerViaHttp(gameId, questionId, content);
    }
    
    // Tenter l'envoi via WebSocket avec un timeout serré
    return await Promise.race([
      new Promise<boolean>((resolve) => {
        socket.emit('game:submit_answer', { gameId, questionId, content }, (response) => {
          console.log('✅ Réponse soumise via WebSocket:', response);
          resolve(true);
        });
      }),
      new Promise<boolean>(async (resolve) => {
        // Si pas de réponse en 800ms, utiliser HTTP
        await new Promise(r => setTimeout(r, 800));
        console.log('⚠️ Timeout WebSocket, utilisation HTTP...');
        resolve(await submitAnswerViaHttp(gameId, questionId, content));
      })
    ]);
  } catch (error) {
    console.error('❌ Erreur lors de la soumission de réponse:', error);
    // En cas d'erreur, tenter par HTTP
    return await submitAnswerViaHttp(gameId, questionId, content);
  }
};

// Fonction d'aide pour soumettre via HTTP
const submitAnswerViaHttp = async (gameId: string, questionId: string, content: string): Promise<boolean> => {
  try {
    // Implémentation HTTP
    const response = await fetch(`/api/games/${gameId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, content })
    });
    
    return response.ok;
  } catch (error) {
    console.error('❌ Erreur HTTP:', error);
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
