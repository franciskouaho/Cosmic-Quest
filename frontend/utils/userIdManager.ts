/**
 * Gestionnaire d'ID utilisateur pour l'authentification dans les APIs et WebSockets
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/config/axios';
import SocketService from '@/services/socketService';

class UserIdManager {
  private static USER_ID_KEY = '@current_user_id';
  
  /**
   * Récupère l'ID utilisateur depuis le stockage local
   */
  static async getUserId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.USER_ID_KEY);
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'ID utilisateur:', error);
      return null;
    }
  }
  
  /**
   * Définit l'ID utilisateur dans le stockage local et les en-têtes API
   */
  static async setUserId(userId: string | number): Promise<boolean> {
    try {
      // Convertir en chaîne si nécessaire
      const userIdStr = String(userId);
      
      // Stocker dans AsyncStorage
      await AsyncStorage.setItem(this.USER_ID_KEY, userIdStr);
      
      // Définir dans les en-têtes API
      api.defaults.headers.userId = userIdStr;
      
      // Mettre à jour également dans le socket si disponible
      try {
        const socket = SocketService.getInstance();
        if (socket) {
          // Définir l'ID utilisateur dans l'objet auth
          socket.auth = { 
            ...socket.auth,
            userId: userIdStr 
          };
          
          console.log(`👤 UserIdManager: ID utilisateur ${userIdStr} défini dans la connexion socket`);
        }
      } catch (socketError) {
        console.warn('⚠️ Socket non initialisé, impossible de définir l\'ID utilisateur dans le socket');
      }
      
      console.log(`👤 UserIdManager: ID utilisateur ${userIdStr} défini et sauvegardé`);
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la définition de l\'ID utilisateur:', error);
      return false;
    }
  }
  
  /**
   * Supprime l'ID utilisateur du stockage local et des en-têtes API
   */
  static async removeUserId(): Promise<boolean> {
    try {
      // Supprimer de AsyncStorage
      await AsyncStorage.removeItem(this.USER_ID_KEY);
      
      // Supprimer des en-têtes API
      delete api.defaults.headers.userId;
      
      // Supprimer du socket si disponible
      try {
        const socket = SocketService.getInstance();
        if (socket && socket.auth) {
          delete socket.auth.userId;
        }
      } catch (socketError) {
        // Ignorer les erreurs ici
      }
      
      console.log('🗑️ UserIdManager: ID utilisateur supprimé');
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de l\'ID utilisateur:', error);
      return false;
    }
  }
  
  /**
   * Synchronise l'ID utilisateur entre AsyncStorage et les services
   */
  static async syncUserIdAcrossServices(): Promise<string | null> {
    try {
      // Tenter de récupérer l'ID utilisateur
      const userId = await this.getUserId();
      
      if (userId) {
        // S'assurer qu'il est défini partout
        api.defaults.headers.userId = userId;
        
        try {
          const socket = await SocketService.getInstanceAsync();
          if (socket) {
            socket.auth = { 
              ...socket.auth,
              userId 
            };
            console.log(`👤 UserIdManager: ID utilisateur ${userId} synchronisé avec le socket`);
          }
        } catch (socketError) {
          console.warn('⚠️ Erreur lors de la synchronisation de l\'ID utilisateur avec le socket:', socketError);
        }
        
        console.log(`👤 UserIdManager: ID utilisateur ${userId} synchronisé avec les services`);
      }
      
      return userId;
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation de l\'ID utilisateur:', error);
      return null;
    }
  }
}

export default UserIdManager;
