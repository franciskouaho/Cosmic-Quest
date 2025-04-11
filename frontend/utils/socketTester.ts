import SocketService from '@/services/socketService';
import { SOCKET_URL } from '@/config/axios';

/**
 * Utilitaire pour tester la connexion WebSocket
 */
export const testSocketConnection = () => {
  console.log('🧪 Démarrage du test de connexion WebSocket...');
  
  try {
    const socket = SocketService.getInstance();
    
    console.log(`🔌 URL WebSocket: ${SOCKET_URL}`);
    console.log(`🔌 Socket ID: ${socket.id || 'non connecté'}`);
    console.log(`🔌 État de connexion: ${socket.connected ? 'connecté' : 'déconnecté'}`);
    
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
    SocketService.joinRoom('test-room');
    
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
    
    // Nettoyer les écouteurs après 5 secondes
    setTimeout(() => {
      socket.off('pong');
      socket.off('room:joined');
      socket.off('room:left');
      console.log('🧹 Nettoyage des écouteurs de test terminé');
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
export const checkSocketStatus = () => {
  try {
    const socket = SocketService.getInstance();
    return {
      isConnected: socket.connected,
      socketId: socket.id || null,
      transport: socket.io?.engine?.transport?.name || null,
      url: SOCKET_URL,
    };
  } catch (error) {
    return {
      isConnected: false,
      error: error.message,
      url: SOCKET_URL,
    };
  }
};

export default {
  testSocketConnection,
  checkSocketStatus,
};
