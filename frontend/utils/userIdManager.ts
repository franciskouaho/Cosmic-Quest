import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/config/axios';
import { queryClient } from '@/config/queryClient';

const USER_ID_KEY = '@current_user_id';

/**
 * Utilitaire pour gérer l'ID utilisateur de manière cohérente dans toute l'application
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
      // Définir dans les headers API
      if (api && api.defaults) {
        api.defaults.headers.userId = userIdString;
      } else {
        console.warn('⚠️ API non disponible pour définir userId dans headers');
      }
      
      // Sauvegarder dans AsyncStorage
      await AsyncStorage.setItem(USER_ID_KEY, userIdString);
      
      console.log(`👤 UserIdManager: ID utilisateur ${userIdString} défini et sauvegardé`);
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
      if (api && api.defaults && api.defaults.headers.userId) {
        return String(api.defaults.headers.userId);
      }
      
      // Sinon vérifier AsyncStorage
      const storedId = await AsyncStorage.getItem(USER_ID_KEY);
      if (storedId) {
        // Mettre à jour les headers API avec l'ID récupéré
        if (api && api.defaults) {
          api.defaults.headers.userId = storedId;
        }
        return storedId;
      }
      
      // Essayer de récupérer depuis les données utilisateur complètes
      try {
        const userData = await AsyncStorage.getItem('@user_data');
        if (userData) {
          const user = JSON.parse(userData);
          if (user && user.id) {
            const userIdStr = String(user.id);
            // Synchroniser dans les headers et le stockage dédié
            if (api && api.defaults) {
              api.defaults.headers.userId = userIdStr;
            }
            await AsyncStorage.setItem(USER_ID_KEY, userIdStr);
            return userIdStr;
          }
        }
      } catch (err) {
        console.warn('⚠️ Erreur lors de la récupération des données utilisateur complètes:', err);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'ID utilisateur:', error);
      return null;
    }
  },
  
  /**
   * Synchroniser l'ID utilisateur entre headers API, AsyncStorage et context
   */
  syncUserId: async (userId?: string | number): Promise<string | null> => {
    // Si un ID est fourni, le définir
    if (userId) {
      await UserIdManager.setUserId(userId);
      return String(userId);
    }
    
    // Sinon, tenter de récupérer l'ID existant
    return await UserIdManager.getUserId();
  },
  
  /**
   * Vérifier si l'utilisateur est la cible d'une question
   */
  isUserTargetPlayer: (userId: string | number | null | undefined, targetPlayerId: string | number | null | undefined): boolean => {
    if (!userId || !targetPlayerId) return false;
    
    const userIdStr = String(userId);
    const targetIdStr = String(targetPlayerId);
    
    return userIdStr === targetIdStr;
  },
  
  /**
   * Récupérer l'ID depuis React Query cache
   */
  getIdFromReactQueryCache: (): string | null => {
    try {
      const userData = queryClient.getQueryData(['user']) as any;
      if (userData && userData.id) {
        return String(userData.id);
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération depuis ReactQuery cache:', error);
      return null;
    }
  },
  
  /**
   * Débogage des identifiants utilisateur dans le système
   */
  debugUserIds: async (): Promise<void> => {
    try {
      // Récupérer toutes les sources d'ID utilisateur possibles pour le débogage
      const apiHeaderId = api?.defaults?.headers?.userId ? String(api.defaults.headers.userId) : 'non défini';
      const asyncStorageId = await AsyncStorage.getItem(USER_ID_KEY) || 'non défini';
      const reactQueryCacheId = UserIdManager.getIdFromReactQueryCache() || 'non défini';
      
      let userDataId = 'non défini';
      try {
        const userData = await AsyncStorage.getItem('@user_data');
        if (userData) {
          const user = JSON.parse(userData);
          userDataId = user?.id ? String(user.id) : 'non défini';
        }
      } catch (err) {
        userDataId = `erreur: ${err.message}`;
      }
      
      console.log(`📊 DEBUG UserID: 
        API Headers: ${apiHeaderId}
        AsyncStorage (dédié): ${asyncStorageId}
        AsyncStorage (user_data): ${userDataId}
        ReactQuery cache: ${reactQueryCacheId}
      `);
    } catch (error) {
      console.error('❌ Erreur lors du débogage des IDs utilisateur:', error);
    }
  }
};

export default UserIdManager;
