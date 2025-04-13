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
  setupGlobalErrorHandlers
};
