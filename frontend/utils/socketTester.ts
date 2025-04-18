import socketService from '@/services/socketService';
import GameStateHelper from './gameStateHelper';
import gameService from '@/services/queries/game';

/**
 * Teste la connexion socket avec plusieurs tentatives
 */
export const testSocketConnection = async (maxAttempts: number = 3): Promise<boolean> => {
  try {
    console.log(`🔌 Test de connexion socket avec ${maxAttempts} tentatives max`);
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 Tentative ${attempts}/${maxAttempts} de connexion socket`);
      
      try {
        socketService.setAutoInit(true); // Activer l'initialisation automatique
        const socket = await socketService.getInstanceAsync(true);
        
        if (socket && socket.connected) {
          console.log('✅ Test de connexion socket réussi');
          return true;
        }
        
        console.log('⏳ Socket créé mais pas connecté, tentative de reconnexion...');
        const reconnected = await socketService.reconnect();
        
        if (reconnected) {
          console.log('✅ Reconnexion socket réussie');
          return true;
        }
        
        // Attendre un peu avant la prochaine tentative
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Erreur lors de la tentative ${attempts}:`, error);
        // Attendre un peu avant la prochaine tentative
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.error(`❌ Échec de connexion socket après ${maxAttempts} tentatives`);
    return false;
  } catch (error) {
    console.error('❌ Erreur de connexion socket:', error);
    return false;
  }
};

/**
 * Teste la soumission d'une réponse avec récupération améliorée
 */
export const testSubmitAnswer = async (
  gameId: string,
  questionId: string,
  content: string
): Promise<boolean> => {
  try {
    console.log(`🎮 Test de soumission de réponse pour le jeu ${gameId}`);
    
    // Vérifier d'abord la connexion socket
    const isConnected = await testSocketConnection(2);
    if (!isConnected) {
      console.warn('⚠️ Socket non connecté, tentative de soumission via HTTP');
      // Tenter via HTTP comme fallback (utiliser gameService)
      return await gameService.submitAnswer(gameId, questionId, content);
    }
    
    // Si connecté, utiliser le socket
    const socket = await socketService.getInstanceAsync(true);
    
    return new Promise((resolve) => {
      // Définir un timeout de 5 secondes
      const timeout = setTimeout(() => {
        console.warn('⚠️ Timeout lors de la soumission de réponse, considéré comme échec');
        resolve(false);
      }, 5000);
      
      socket.emit('game:submit_answer', { gameId, questionId, content }, (response: any) => {
        clearTimeout(timeout);
        console.log('✅ Résultat du test de soumission:', response);
        resolve(!!response?.success);
      });
    });
  } catch (error) {
    console.error('❌ Erreur lors du test de soumission:', error);
    return false;
  }
};

/**
 * Vérifie si un joueur a répondu mais est toujours en phase question
 * et tente de résoudre ce problème
 */
export const checkPhaseAfterAnswer = async (gameId: string): Promise<boolean> => {
  try {
    console.log(`🔍 Vérification de phase après réponse pour le jeu ${gameId}`);
    
    // Tenter d'obtenir l'état du jeu, même en cas d'erreur de connexion
    let gameData;
    try {
      gameData = await gameService.getGameState(gameId);
    } catch (e) {
      console.error('❌ Erreur lors de la récupération de l\'état du jeu:', e);
      return false;
    }
    
    // Vérifier l'incohérence: le joueur a répondu mais est toujours en phase question
    if (gameData.currentUserState?.hasAnswered && gameData.game.currentPhase === 'question') {
      console.log(`⚠️ Blocage détecté: A répondu mais toujours en phase question`);
      
      // Essayer d'abord via WebSocket
      try {
        // Tenter de rejoindre le canal du jeu d'abord
        await socketService.joinGameChannel(gameId);
        
        // Forcer la vérification de phase
        await socketService.forcePhaseCheck(gameId);
        console.log(`✅ Vérification de phase forcée via WebSocket`);
        
        // Attendre un moment pour que les changements prennent effet
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Vérifier à nouveau l'état
        const updatedGameData = await gameService.getGameState(gameId);
        if (updatedGameData.game.currentPhase !== 'question') {
          console.log(`✅ Phase mise à jour avec succès: ${updatedGameData.game.currentPhase}`);
          return true;
        }
      } catch (wsError) {
        console.warn(`⚠️ Échec de la correction via WebSocket:`, wsError);
      }
      
      // Si WebSocket échoue, essayer via HTTP
      try {
        const success = await gameService.forcePhaseTransition(gameId, 'answer');
        
        if (success) {
          console.log(`✅ Phase mise à jour via HTTP`);
          return true;
        }
      } catch (httpError) {
        console.warn(`⚠️ Échec de la correction via HTTP:`, httpError);
      }
      
      // Dernière approche
      try {
        return await GameStateHelper.forcePhaseTransition(gameId, 'answer');
      } catch (helperError) {
        console.error(`❌ Toutes les tentatives de correction ont échoué:`, helperError);
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de phase:', error);
    return false;
  }
};

/**
 * Vérifie et débloque un jeu potentiellement bloqué
 * avec des mécanismes de récupération améliorés
 */
export const checkAndUnblockGame = async (gameId: string): Promise<boolean> => {
  try {
    console.log(`🔍 Vérification et tentative de déblocage du jeu ${gameId}`);
    
    // Assurer que le socket est connecté
    const socketConnected = await testSocketConnection(1);
    
    if (socketConnected) {
      try {
        // Tenter de rejoindre le canal du jeu
        await socketService.joinGameChannel(gameId);
        console.log(`✅ Canal de jeu ${gameId} rejoint`);
        
        // Forcer une vérification de phase
        await socketService.forcePhaseCheck(gameId);
        console.log(`✅ Vérification de phase forcée`);
        
        // Attendre un moment pour que les changements prennent effet
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (wsError) {
        console.warn(`⚠️ Opérations WebSocket échouées:`, wsError);
      }
    }
    
    // Utiliser GameStateHelper quoi qu'il arrive
    return await GameStateHelper.checkAndUnblockGame(gameId);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de blocage:', error);
    return false;
  }
};

/**
 * Méthode de récupération d'urgence pour les jeux bloqués
 * Tente plusieurs approches pour débloquer un jeu
 */
export const emergencyGameRecovery = async (gameId: string): Promise<boolean> => {
  console.log(`🚨 RÉCUPÉRATION D'URGENCE pour le jeu ${gameId}`);
  
  try {
    // 1. Forcer une initialisation socket complète
    socketService.setAutoInit(true);
    await socketService.cleanup(); // Nettoyer complètement avant de recommencer
    
    try {
      const socket = await socketService.ensureConnection(3);
      if (socket && socket.connected) {
        console.log(`✅ Connection socket rétablie`);
      }
    } catch (socketError) {
      console.warn(`⚠️ Impossible de rétablir la connexion socket:`, socketError);
    }
    
    // 2. Tenter de rejoindre le canal avec plusieurs essais
    let joinSuccess = false;
    try {
      joinSuccess = await socketService.reconnectToRoom(`game:${gameId}`, 3);
      if (joinSuccess) {
        console.log(`✅ Rejoint le canal de jeu avec succès`);
      }
    } catch (joinError) {
      console.warn(`⚠️ Échec de rejoindre le canal:`, joinError);
    }
    
    // 3. Essayer la récupération via GameStateHelper
    const helperSuccess = await GameStateHelper.forceGameRecovery(gameId);
    
    return helperSuccess || joinSuccess;
  } catch (error) {
    console.error(`❌ Échec de la récupération d'urgence:`, error);
    return false;
  }
};

export default {
  testSocketConnection,
  testSubmitAnswer,
  checkPhaseAfterAnswer,
  checkAndUnblockGame,
  emergencyGameRecovery
};
