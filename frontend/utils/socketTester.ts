import SocketService from '@/services/socketService';
import { SOCKET_URL } from '@/config/axios';

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
    
    // Tester la tentative de rejoindre une salle test
    console.log('🚪 Test de jointure à une salle test...');
    await SocketService.joinRoom('test-room');
    
    // Ajouter un écouteur temporaire pour confirmer la jointure
    socket.on('room:joined', (data) => {
      console.log('✅ Confirmation de jointure à la salle:', data);
      
      // Après confirmation, tester le départ
      console.log('🚪 Test de départ de la salle test...');
      SocketService.leaveRoom('test-room');
    });
    
    // Ajouter un écouteur temporaire pour confirmer le départ
    socket.on('room:left', (data) => {
      console.log('✅ Confirmation de départ de la salle:', data);
    });
    
    // Écouter les événements de jeu pour le débogage
    socket.on('game:update', (data) => {
      console.log('🎮 Événement game:update reçu:', data);
      
      // Amélioration de la validation pour le statut de joueur ciblé
      if (data.type === 'phase_change' && data.phase === 'vote') {
        console.log('🧪 Test de validation du joueur ciblé...');
        
        try {
          // Vérification plus robuste
          const currentQuestion = socket?.gameState?.currentQuestion;
          const currentUser = socket?.userData?.id;
          
          if (currentQuestion && currentUser) {
            // S'assurer que les IDs sont des chaînes pour comparaison
            const targetId = String(currentQuestion.targetPlayer?.id || '');
            const userId = String(currentUser);
            
            const isTarget = targetId === userId;
            console.log(`🎯 Statut de joueur ciblé: ${isTarget ? 'OUI' : 'NON'} (targetId: ${targetId}, userId: ${userId})`);
            
            if (isTarget) {
              console.log('⚠️ Détection de joueur ciblé: cet utilisateur est la cible et devrait avoir une interface spéciale');
            }
          } else {
            console.log('⚠️ Données incomplètes pour la vérification du joueur ciblé');
          }
        } catch (validationError) {
          console.error('❌ Erreur lors de la validation du joueur ciblé:', validationError);
        }
      }
    });

    // Écouter les événements de phase
    socket.on('phase_change', (data) => {
      console.log('🔄 Événement phase_change reçu:', data);
    });
    
    // Nettoyer les écouteurs après 5 secondes
    setTimeout(() => {
      if (socket.connected) {
        socket.off('pong');
        socket.off('room:joined');
        socket.off('room:left');
        // Ne pas supprimer les écouteurs de débogage du jeu pour suivre la partie
        console.log('🧹 Nettoyage des écouteurs de test terminé');
      }
    }, 5000);
    
    return true;
  } catch (error) {
    console.error('❌ Test échoué:', error);
    return false;
  }
};

/**
 * Vérifier l'état de la connexion WebSocket
 * @returns Un objet contenant l'état actuel de la connexion
 */
export const checkSocketStatus = async () => {
  try {
    // Obtenir le diagnostic complet du service
    const diagnostic = SocketService.diagnose();
    
    // Si déconnecté, tenter une initialisation à la volée
    if (diagnostic.status !== 'connected') {
      console.log('🔌 Socket non connecté, tentative d\'initialisation...');
      try {
        const socket = await SocketService.getInstanceAsync();
        const isConnected = socket.connected; // Utiliser la propriété connected directement
        return {
          isConnected,
          socketId: socket.id || null,
          transport: socket.io?.engine?.transport?.name || null,
          url: SOCKET_URL,
          reconnection: true
        };
      } catch (initError) {
        console.error('❌ Échec de l\'initialisation du socket:', initError);
      }
    }
    
    return {
      isConnected: diagnostic.details.connected,
      socketId: diagnostic.details.socketId,
      transport: diagnostic.details.transport,
      url: SOCKET_URL,
      ...diagnostic.details
    };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification du statut socket:', error);
    return {
      isConnected: false,
      error: error.message,
      url: SOCKET_URL,
    };
  }
};

/**
 * Vérifier l'état de la connexion WebSocket
 * @returns Un objet contenant l'état actuel de la connexion
 */
export const checkSocketConnection = async (): Promise<{ 
  connected: boolean; 
  socketId: string | null;
  activeRooms: string[];
  activeGames: string[];
}> => {
  try {
    // Utiliser la méthode asynchrone pour obtenir une instance valide
    const socket = await SocketService.getInstanceAsync();
    const diagnostic = SocketService.diagnose();
    
    console.log(`🔍 Diagnostic WebSocket effectué - connecté: ${socket.connected}`);
    
    return {
      connected: socket.connected,
      socketId: socket.id,
      activeRooms: diagnostic.activeChannels.rooms,
      activeGames: diagnostic.activeChannels.games,
    };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la connexion WebSocket:', error);
    return {
      connected: false,
      socketId: null,
      activeRooms: [],
      activeGames: [],
    };
  }
};

/**
 * Diagnostic avancé des événements de jeu
 * Utile pour le débogage des parties en cours
 * @param gameId ID de la partie à surveiller
 */
export const monitorGameEvents = async (gameId) => {
  try {
    const socket = await SocketService.getInstanceAsync();
    console.log(`🔍 Démarrage du monitoring pour le jeu ${gameId}...`);
    
    // Rejoindre le canal de la partie
    await SocketService.joinRoom(`game:${gameId}`);
    
    // Écouter les événements de mise à jour de la partie
    socket.on('game:update', (data) => {
      console.log(`📊 [Jeu ${gameId}] Mise à jour:`, data);
    });
    
    // Écouter les événements d'erreur
    socket.on('error', (error) => {
      console.error(`❌ [Jeu ${gameId}] Erreur:`, error);
    });
    
    console.log(`✅ Monitoring actif pour le jeu ${gameId}`);
    return true;
  } catch (error) {
    console.error('❌ Échec du monitoring:', error);
    return false;
  }
};

/**
 * Outils de diagnostic pour les situations de joueur ciblé
 * @param gameId ID de la partie
 */
export const testTargetPlayerScenario = async (gameId: string) => {
  try {
    const socket = await SocketService.getInstanceAsync();
    console.log(`🔍 Démarrage du test de scénario 'joueur ciblé' pour le jeu ${gameId}...`);
    
    // Écouter spécifiquement les mises à jour qui contiennent des informations sur le joueur ciblé
    socket.on('game:update', (data) => {
      if (data.question && data.question.targetPlayer) {
        console.log(`🎯 Joueur ciblé détecté: ${data.question.targetPlayer.displayName || data.question.targetPlayer.username} (ID: ${data.question.targetPlayer.id})`);
        
        // Vérifier si le joueur actuel est la cible
        if (socket.userData && socket.userData.id === data.question.targetPlayer.id) {
          console.log('⚠️ VOUS êtes le joueur ciblé pour cette question!');
          console.log('✅ Comportement attendu: Vous ne devriez PAS pouvoir répondre à cette question.');
        }
      }
    });
    
    console.log(`✅ Test de scénario 'joueur ciblé' activé pour le jeu ${gameId}`);
    return true;
  } catch (error) {
    console.error('❌ Échec du test de scénario:', error);
    return false;
  }
};

/**
 * Outils de diagnostic pour les situations de joueur ciblé
 * @param gameId ID de la partie
 */
export const diagTargetPlayerStatus = async (gameId: string) => {
  try {
    const socket = await SocketService.getInstanceAsync();
    console.log(`🔍 Diagnostic joueur ciblé pour le jeu ${gameId}...`);
    
    const userId = await UserIdManager.getUserId();
    
    console.log(`👤 ID utilisateur connecté: ${userId || 'non disponible'}`);
    
    if (socket.gameState?.currentQuestion?.targetPlayer) {
      const targetId = String(socket.gameState.currentQuestion.targetPlayer.id);
      console.log(`🎯 Joueur ciblé dans la question: ${targetId}`);
      
      const isTarget = userId && targetId === String(userId);
      console.log(`👉 Ce client ${isTarget ? 'EST' : 'N\'EST PAS'} le joueur ciblé`);
    } else {
      console.log('❌ Aucune information de joueur ciblé disponible');
    }
    
    return socket.gameState?.currentUserState?.isTargetPlayer || false;
  } catch (error) {
    console.error('❌ Erreur lors du diagnostic de joueur ciblé:', error);
    return false;
  }
};

/**
 * Soumettre un vote via WebSocket directement
 * @param gameId ID de la partie
 * @param answerId ID de la réponse choisie
 * @param questionId ID de la question
 * @returns Une promesse résolue si le vote a été soumis avec succès
 */
export const submitVoteViaSocket = async (gameId: string, answerId: string, questionId: string): Promise<boolean> => {
  try {
    console.log(`🗳️ Tentative de vote WebSocket - jeu: ${gameId}, réponse: ${answerId}`);
    
    const socket = await SocketService.getInstanceAsync();
    
    // Créer une promesse pour attendre la confirmation du serveur
    return new Promise((resolve, reject) => {
      // Définir un timeout pour la confirmation WebSocket
      const timeoutId = setTimeout(() => {
        console.error('⏱️ Timeout WebSocket atteint, le vote a échoué');
        reject(new Error('Le serveur a mis trop de temps à répondre. Veuillez réessayer.'));
      }, 5000);
      
      // Écouter l'événement de confirmation
      const handleConfirmation = (data) => {
        if (data.questionId === questionId) {
          console.log('✅ Confirmation WebSocket reçue pour le vote');
          clearTimeout(timeoutId);
          socket.off('vote:confirmation', handleConfirmation);
          resolve(true);
        }
      };
      
      // S'abonner à l'événement de confirmation
      socket.on('vote:confirmation', handleConfirmation);
      
      // Envoyer le vote via WebSocket
      socket.emit('game:submit_vote', {
        gameId,
        answerId,
        questionId
      }, (ackData) => {
        if (ackData && ackData.success) {
          console.log('✅ Accusé de réception WebSocket reçu pour le vote');
          clearTimeout(timeoutId);
          socket.off('vote:confirmation', handleConfirmation);
          resolve(true);
        } else if (ackData && ackData.error) {
          console.error(`❌ Erreur lors de la soumission du vote WebSocket: ${ackData.error}`);
          clearTimeout(timeoutId);
          socket.off('vote:confirmation', handleConfirmation);
          reject(new Error(ackData.error));
        }
      });
    });
  } catch (error) {
    console.error('❌ Erreur lors de la soumission du vote via WebSocket:', error);
    throw error;
  }
};

/**
 * Outils de diagnostic pour les situations de joueur ciblé
 * @param gameId ID de la partie
 */
export const diagnoseTargetPlayer = async (gameId: string) => {
  try {
    const socket = await SocketService.getInstanceAsync();
    console.log(`🔍 Diagnostic de joueur ciblé pour jeu ${gameId}...`);

    if (!socket.connected) {
      console.error('❌ Socket non connecté, diagnostic impossible');
      return { success: false, error: 'Socket non connecté' };
    }

    // Récupérer l'état actuel du jeu
    const gameState = socket.gameState;
    const userData = socket.userData;

    if (!gameState || !userData) {
      console.error('❌ Données insuffisantes pour le diagnostic');
      return { 
        success: false, 
        error: 'Données insuffisantes',
        gameStateAvailable: !!gameState,
        userDataAvailable: !!userData 
      };
    }

    const currentQuestion = gameState?.currentQuestion;
    const userId = userData.id;
    
    console.log('📊 État du jeu:', {
      currentPhase: gameState.currentPhase,
      hasCurrentQuestion: !!currentQuestion,
      questionId: currentQuestion?.id,
      hasTargetPlayer: !!currentQuestion?.targetPlayer,
      targetPlayerId: currentQuestion?.targetPlayer?.id,
      currentUserId: userId
    });

    // Vérifier si l'utilisateur est la cible
    const isTarget = currentQuestion?.targetPlayer?.id === userId;
    
    return {
      success: true,
      isTarget,
      currentPhase: gameState.currentPhase,
      userId,
      targetId: currentQuestion?.targetPlayer?.id,
      questionId: currentQuestion?.id
    };
  } catch (error) {
    console.error('❌ Erreur durant le diagnostic du joueur ciblé:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Tester la soumission d'une réponse via WebSocket
 * @param gameId ID de la partie
 * @param questionId ID de la question
 * @param content Contenu de la réponse
 */
export const testSubmitAnswerViaSocket = async (gameId: string, questionId: string, content: string) => {
  try {
    const socket = await SocketService.getInstanceAsync();
    console.log(`🧪 Test de soumission de réponse via WebSocket - jeu: ${gameId}, question: ${questionId}`);
    
    return new Promise((resolve, reject) => {
      // Configurer un timeout
      const timeoutId = setTimeout(() => {
        socket.off('answer:confirmation');
        reject(new Error('Timeout: Pas de réponse du serveur après 5 secondes'));
      }, 5000);
      
      // Écouter l'événement de confirmation
      socket.once('answer:confirmation', (data) => {
        clearTimeout(timeoutId);
        console.log('✅ Confirmation de réponse reçue:', data);
        resolve({ success: true, data });
      });
      
      // Envoyer la réponse
      socket.emit('game:submit_answer', {
        gameId,
        questionId,
        content
      }, (ackData) => {
        // Ceci est le callback d'acquittement immédiat
        console.log('📨 Acquittement immédiat reçu:', ackData);
        if (ackData && !ackData.success) {
          clearTimeout(timeoutId);
          socket.off('answer:confirmation');
          reject(new Error(`Erreur lors de la soumission: ${ackData.error || 'Inconnue'}`));
        }
      });
    });
  } catch (error) {
    console.error('❌ Erreur lors du test de soumission:', error);
    throw error;
  }
};

/**
 * Tester la soumission d'un vote via WebSocket
 */
export const testSubmitVoteViaSocket = async (gameId: string, answerId: string, questionId: string) => {
  try {
    const socket = await SocketService.getInstanceAsync();
    console.log(`🧪 Test de soumission de vote via WebSocket - jeu: ${gameId}, réponse: ${answerId}`);
    
    return new Promise((resolve, reject) => {
      // Configurer un timeout
      const timeoutId = setTimeout(() => {
        socket.off('vote:confirmation');
        reject(new Error('Timeout: Pas de réponse du serveur après 5 secondes'));
      }, 5000);
      
      // Écouter l'événement de confirmation
      socket.once('vote:confirmation', (data) => {
        clearTimeout(timeoutId);
        console.log('✅ Confirmation de vote reçue:', data);
        resolve({ success: true, data });
      });
      
      // Envoyer le vote
      socket.emit('game:submit_vote', {
        gameId,
        answerId,
        questionId
      }, (ackData) => {
        // Ceci est le callback d'acquittement immédiat
        console.log('📨 Acquittement immédiat reçu:', ackData);
        if (ackData && !ackData.success) {
          clearTimeout(timeoutId);
          socket.off('vote:confirmation');
          reject(new Error(`Erreur lors du vote: ${ackData.error || 'Inconnue'}`));
        }
      });
    });
  } catch (error) {
    console.error('❌ Erreur lors du test de vote:', error);
    throw error;
  }
};

export default {
  testSocketConnection,
  checkSocketStatus,
  checkSocketConnection,
  monitorGameEvents,
  testTargetPlayerScenario,
  diagTargetPlayerStatus,
  submitVoteViaSocket,
  diagnoseTargetPlayer,
  testSubmitAnswerViaSocket,
  testSubmitVoteViaSocket,
};
