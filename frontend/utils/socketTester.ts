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
      
      // Ajouter une validation spécifique pour le statut de joueur ciblé
      if (data.type === 'phase_change' && data.phase === 'vote') {
        console.log('🧪 Test de validation du joueur ciblé...');
        const currentQuestion = socket?.gameState?.currentQuestion;
        const currentUser = socket?.userData?.id;
        
        if (currentQuestion && currentUser) {
          const isTarget = currentQuestion.targetPlayer?.id === currentUser;
          console.log(`🎯 Statut de joueur ciblé: ${isTarget ? 'OUI' : 'NON'}`);
          if (isTarget) {
            console.log('⚠️ Détection de joueur ciblé: cet utilisateur est la cible et devrait avoir une interface spéciale');
          }
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
        return {
          isConnected: socket.connected,
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

export default {
  testSocketConnection,
  checkSocketStatus,
  monitorGameEvents,
  testTargetPlayerScenario,
};
