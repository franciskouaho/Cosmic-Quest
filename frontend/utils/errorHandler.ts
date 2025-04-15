import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Utilitaire pour gérer les erreurs liées aux WebSockets
 */
export const handleSocketError = async (error: any, context: string): Promise<void> => {
  // Enregistrer l'erreur avec le contexte
  console.error(`❌ Erreur Socket (${context}):`, error);
  
  // Vérifier la connexion internet
  const netInfo = await NetInfo.fetch();
  
  if (!netInfo.isConnected) {
    console.log('🌐 Pas de connexion Internet détectée');
    Alert.alert(
      'Problème de connexion',
      'Vous semblez être hors ligne. Veuillez vérifier votre connexion Internet.',
      [{ text: 'OK' }]
    );
    return;
  }
  
  // Déterminer le type d'erreur
  if (error.message?.includes('timeout')) {
    Alert.alert(
      'Délai d\'attente dépassé',
      'Le serveur met trop de temps à répondre. Veuillez réessayer.',
      [{ text: 'OK' }]
    );
  } else if (error.message?.includes('socket')) {
    // Pas d'alerte pour les erreurs de socket standards pour éviter de spammer l'utilisateur
    console.warn('⚠️ Problème de connexion WebSocket:', error.message);
  } else {
    // Pour les erreurs inconnues, afficher un message générique
    console.error('❌ Erreur non gérée:', error);
  }
};

/**
 * Gestionnaire d'erreurs spécifique pour les problèmes WebSocket récurrents
 * @param error L'erreur WebSocket
 * @param context Le contexte où l'erreur s'est produite
 * @param callback Optional callback pour des actions spécifiques
 */
export const handleWebSocketError = async (
  error: any,
  context: string,
  callback?: () => Promise<void>
): Promise<boolean> => {
  
  // Déterminer si c'est une erreur de timeout
  const isTimeout = error.message?.includes('timeout') || error.message?.includes('timed out');
  
  // Vérifier la connexion internet
  const netInfo = await NetInfo.fetch();
  
  if (!netInfo.isConnected) {
    console.log('🌐 Pas de connexion Internet détectée');
    Alert.alert(
      'Problème de connexion',
      'Vous semblez être hors ligne. Veuillez vérifier votre connexion Internet.',
      [{ text: 'OK' }]
    );
    return false;
  }
  
  try {
    // Pour les erreurs de timeout, tenter une optimisation WebSocket
    if (isTimeout) {
      console.log('⏱️ Erreur de timeout détectée, tentative d\'optimisation...');
      
      // Importer dynamiquement pour éviter les dépendances circulaires
      const { optimizeWebSocketConnection } = await import('./socketTester');
      const optimized = await optimizeWebSocketConnection();
      
      if (optimized) {
        console.log('✅ Connexion WebSocket optimisée après timeout');
        
        // Exécuter le callback si fourni
        if (callback) {
          console.log('🔄 Tentative d\'exécution de l\'opération initiale...');
          await callback();
          return true;
        }
      } else {
        console.log('⚠️ Échec de l\'optimisation WebSocket, utilisation du mode REST');
        // Ici nous pourrions basculer sur une stratégie HTTP REST
        return false;
      }
    }
    
    // Pour les autres erreurs WebSocket, essayer une réinitialisation complète
    if (error.message?.includes('socket') || error.message?.includes('WebSocket')) {
      console.log('🔄 Erreur de socket détectée, tentative de réinitialisation...');
      
      // Importer SocketService dynamiquement
      const SocketService = (await import('@/services/socketService')).default;
      
      // Forcer l'initialisation d'une nouvelle connexion
      try {
        await SocketService.getInstanceAsync(true);
        console.log('✅ Socket réinitialisé avec succès');
        
        // Exécuter le callback si fourni
        if (callback) {
          await callback();
        }
        
        return true;
      } catch (resetError) {
        console.error('❌ Échec de la réinitialisation du socket:', resetError);
      }
    }
    
    // Si aucune action spécifique n'a fonctionné, informer l'utilisateur
    Alert.alert(
      'Problème de communication',
      'Un problème de communication avec le serveur est survenu. Veuillez réessayer.',
      [{ text: 'OK' }]
    );
    
    return false;
  } catch (handlerError) {
    console.error('❌ Erreur dans le gestionnaire d\'erreurs:', handlerError);
    return false;
  }
};

/**
 * Réinitialise les connexions WebSocket en cas de problèmes persistants
 */
export const resetWebSocketConnections = async (): Promise<boolean> => {
  try {
    console.log('🔄 Réinitialisation complète des connexions WebSocket...');
    
    // Récupérer SocketService
    const SocketService = (await import('@/services/socketService')).default;
    
    // Forcer une déconnexion complète d'abord
    try {
      const socket = await SocketService.getInstanceAsync(false);
      if (socket && socket.connected) {
        socket.disconnect();
        console.log('🔌 Socket déconnecté');
      }
    } catch (disconnectError) {
      console.warn('⚠️ Erreur lors de la déconnexion:', disconnectError);
    }
    
    // Attendre un court instant
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Initialiser une nouvelle connexion
    try {
      const newSocket = await SocketService.getInstanceAsync(true);
      const isConnected = newSocket && newSocket.connected;
      
      console.log(`🔌 Nouvelle connexion initialisée: ${isConnected ? 'connecté' : 'non connecté'}`);
      
      if (!isConnected) {
        // Attendre que la connexion s'établisse
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout lors de la connexion'));
          }, 5000);
          
          newSocket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      
      console.log('✅ Connexion WebSocket réinitialisée avec succès');
      return true;
    } catch (connectError) {
      console.error('❌ Échec de la reconnexion:', connectError);
      return false;
    }
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation des connexions:', error);
    return false;
  }
};

/**
 * Gestionnaire global d'erreurs non captées
 */
export const setupGlobalErrorHandlers = () => {
  // Erreurs non gérées pour les promesses
  const originalUnhandledRejection = global.ErrorUtils.getGlobalHandler();
  
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error(`❌ ERREUR ${isFatal ? 'FATALE' : 'NON FATALE'} NON GÉRÉE:`, error);
    
    // Pour les erreurs liées aux sockets, utiliser notre gestionnaire spécialisé
    if (error.message?.includes('socket') || error.message?.includes('WebSocket')) {
      handleSocketError(error, 'non gérée').catch(console.error);
    }
    
    // Appeler le gestionnaire original
    originalUnhandledRejection(error, isFatal);
  });
  
  console.log('✅ Gestionnaire global d\'erreurs configuré');
};

export default {
  handleSocketError,
  handleWebSocketError,
  resetWebSocketConnections,
  setupGlobalErrorHandlers
};
