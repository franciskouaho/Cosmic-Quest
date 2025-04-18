import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import GameDebugger from './gameDebugger';
import SocketService from '@/services/socketService';

/**
 * Utilitaire pour gérer les erreurs liées aux WebSockets
 */
export const handleSocketError = async (error: any, context: string, gameId?: string): Promise<void> => {
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
  
  // Vérifier l'état du socket
  let socketConnected = false;
  try {
    const socket = await SocketService.getInstanceAsync();
    socketConnected = socket.connected;
  } catch (socketError) {
    console.error('❌ Erreur lors de la vérification du socket:', socketError);
  }
  
  // Déterminer le type d'erreur
  if (error.message?.includes('timeout')) {
    Alert.alert(
      'Délai d\'attente dépassé',
      'Le serveur met trop de temps à répondre. Nous allons tenter de rétablir la connexion.',
      [{ text: 'OK' }]
    );
  } else if (error.message?.includes('socket') || !socketConnected) {
    Alert.alert(
      'Problème de connexion',
      'La connexion temps réel est interrompue. Cela peut affecter la synchronisation du jeu.',
      [{ text: 'OK' }]
    );
  } else {
    // Erreurs génériques
    const errorMessage = error.message || 'Une erreur inconnue est survenue';
    
    // Message simple sans options
    Alert.alert('Erreur', errorMessage, [{ text: 'OK' }]);
  }
};

/**
 * Utilitaire spécifique pour gérer les erreurs de soumission de réponse
 */
export const handleAnswerSubmissionError = async (error: any, gameId: string, retry?: () => Promise<void>): Promise<void> => {
  console.error(`❌ Erreur lors de la soumission de réponse:`, error);
  
  // Messages spécifiques selon le code d'erreur
  let message = 'Impossible d\'envoyer votre réponse.';
  
  if (error.response?.status === 409) {
    message = 'Vous avez déjà soumis une réponse à cette question.';
  } else if (error.response?.status === 400 && error.response?.data?.code === 'TARGET_PLAYER_CANNOT_ANSWER') {
    message = 'Vous êtes la cible de cette question et ne pouvez pas y répondre.';
  } else if (error.message?.includes('Network Error')) {
    return handleSocketError(error, 'submit-answer', gameId);
  } else if (error.response?.data?.error) {
    message = error.response.data.error;
  }
  
  Alert.alert('Erreur', message, [{ text: 'OK' }]);
};

/**
 * Utilitaire pour la récupération d'erreurs critique avec réinitialisation WebSocket
 */
export const handleCriticalError = async (error: any, context: string, gameId?: string): Promise<void> => {
  console.error(`🚨 ERREUR CRITIQUE (${context}):`, error);
  
  // Tenter une réinitialisation complète de la connexion
  try {
    console.log('🔄 Tentative de réinitialisation WebSocket...');
    await SocketService.reset();
    
    // Se reconnecter au jeu si un ID est fourni
    if (gameId) {
      await GameDebugger.repairGame(gameId);
    }
    
    Alert.alert(
      'Récupération réussie',
      'La connexion a été réinitialisée avec succès.'
    );
  } catch (resetError) {
    console.error('❌ Échec de réinitialisation:', resetError);
    
    Alert.alert(
      'Erreur critique',
      'Une erreur grave est survenue. Essayez de quitter et redémarrer l\'application.',
      [{ text: 'OK' }]
    );
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
  handleAnswerSubmissionError,
  handleCriticalError,
  setupGlobalErrorHandlers
};
