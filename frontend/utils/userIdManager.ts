import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/axios';

const USER_ID_KEY = '@current_user_id';

/**
 * Utilitaire pour gérer l'ID utilisateur dans l'application
 */
export const UserIdManager = {
  /**
   * Définir l'ID utilisateur dans les headers API et AsyncStorage
   */
  setUserId: async (userId: string | number): Promise<void> => {
    if (!userId) {
      console.warn('⚠️ Tentative de définir un ID utilisateur vide');
      return;
    }
    
    const userIdString = String(userId);
    
    try {
      // Définir l'ID dans les headers API
      api.defaults.headers.userId = userIdString;
      
      // Sauvegarder dans AsyncStorage
      await AsyncStorage.setItem(USER_ID_KEY, userIdString);
      
      console.log(`👤 ID utilisateur ${userIdString} défini et sauvegardé`);
    } catch (error) {
      console.error('❌ Erreur lors de la définition de l\'ID utilisateur:', error);
    }
  },
  
  /**
   * Récupérer l'ID utilisateur depuis les headers API ou AsyncStorage
   */
  getUserId: async (): Promise<string | null> => {
    try {
      // D'abord vérifier les headers API
      if (api.defaults.headers.userId) {
        return String(api.defaults.headers.userId);
      }
      
      // Sinon vérifier AsyncStorage
      const storedId = await AsyncStorage.getItem(USER_ID_KEY);
      if (storedId) {
        // Mettre à jour les headers API avec l'ID récupéré
        api.defaults.headers.userId = storedId;
        return storedId;
      }
      
      console.warn('⚠️ Aucun ID utilisateur trouvé');
      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'ID utilisateur:', error);
      return null;
    }
  },
  
  /**
   * Synchroniser l'ID utilisateur dans toute l'application
   */
  syncUserId: async (userId?: string | number): Promise<string | null> => {
    try {
      // Si un ID est fourni, le définir
      if (userId) {
        await UserIdManager.setUserId(userId);
        return String(userId);
      }
      
      // Sinon, essayer de récupérer l'ID existant
      const currentId = await UserIdManager.getUserId();
      
      if (!currentId) {
        console.warn('⚠️ Impossible de synchroniser l\'ID utilisateur: aucun ID trouvé ou fourni');
      }
      
      return currentId;
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation de l\'ID utilisateur:', error);
      return null;
    }
  }
};

export default UserIdManager;
