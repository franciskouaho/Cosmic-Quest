import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Service de gestion de l'ID utilisateur
 * Centralise l'accès à l'ID utilisateur à travers l'application
 */
class UserIdManager {
  private userId: string | null = null;
  private initialized = false;

  /**
   * Définit l'ID utilisateur et le stocke dans AsyncStorage
   * @param userId ID de l'utilisateur
   */
  async setUserId(userId: string | number): Promise<void> {
    try {
      // Convertir en string si nécessaire
      const userIdStr = String(userId);
      this.userId = userIdStr;
      
      // Stocker dans AsyncStorage
      await AsyncStorage.setItem('@user_id', userIdStr);
      
      console.log(`👤 UserIdManager: ID utilisateur défini: ${userIdStr}`);
      this.initialized = true;
      
      return;
    } catch (error) {
      console.error('❌ UserIdManager: Erreur lors de la définition de l\'ID utilisateur:', error);
      throw error;
    }
  }

  /**
   * Récupère l'ID utilisateur depuis la mémoire ou AsyncStorage
   * @returns ID de l'utilisateur ou null si non défini
   */
  async getUserId(): Promise<string | null> {
    try {
      // Si déjà en mémoire, renvoyer directement
      if (this.userId) {
        return this.userId;
      }
      
      // Sinon, tenter de récupérer depuis AsyncStorage
      const storedId = await AsyncStorage.getItem('@user_id');
      
      if (storedId) {
        this.userId = storedId;
        this.initialized = true;
        console.log(`👤 UserIdManager: ID utilisateur récupéré: ${storedId}`);
      } else {
        console.log('👤 UserIdManager: Aucun ID utilisateur stocké');
      }
      
      return storedId;
    } catch (error) {
      console.error('❌ UserIdManager: Erreur lors de la récupération de l\'ID utilisateur:', error);
      return null;
    }
  }

  /**
   * Supprime l'ID utilisateur
   */
  async clearUserId(): Promise<void> {
    try {
      this.userId = null;
      await AsyncStorage.removeItem('@user_id');
      console.log('👤 UserIdManager: ID utilisateur supprimé');
    } catch (error) {
      console.error('❌ UserIdManager: Erreur lors de la suppression de l\'ID utilisateur:', error);
    }
  }

  /**
   * Vérifie si un ID utilisateur est défini
   */
  async hasUserId(): Promise<boolean> {
    const id = await this.getUserId();
    return id !== null;
  }
  
  /**
   * Synchronise l'ID utilisateur entre AsyncStorage et les headers API
   * Fonction spécifiquement demandée par le système
   */
  async syncUserId(api: any): Promise<string | null> {
    try {
      // Récupérer l'ID depuis AsyncStorage
      const userId = await this.getUserId();
      
      // Si un userId est disponible, le définir dans les en-têtes de l'API
      if (userId && api?.defaults?.headers) {
        api.defaults.headers.userId = userId;
        console.log(`👤 UserIdManager: ID utilisateur ${userId} synchronisé avec les en-têtes API`);
      } else if (!userId) {
        console.warn('⚠️ UserIdManager: Aucun ID utilisateur à synchroniser');
      }
      
      return userId;
    } catch (error) {
      console.error('❌ UserIdManager: Erreur lors de la synchronisation de l\'ID utilisateur:', error);
      return null;
    }
  }

  /**
   * Récupère le UserID de manière synchrone (sans garantie qu'il soit à jour)
   * Utile dans les contextes où async/await n'est pas possible
   */
  getUserIdSync(): string | null {
    return this.userId;
  }

  /**
   * Vérifie si le gestionnaire a été initialisé
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Affiche les informations de débogage sur les IDs utilisateur
   * dans différents contextes de l'application
   * @returns Promise avec les informations de débogage
   */
  async debugUserIds(): Promise<Record<string, any>> {
    try {
      // Récupérer les IDs depuis différentes sources
      const memoryId = this.userId;
      const asyncStorageId = await AsyncStorage.getItem('@user_id');
      const userDataString = await AsyncStorage.getItem('@user_data');
      const userData = userDataString ? JSON.parse(userDataString) : null;
      const userDataId = userData?.id || null;
      const currentUserId = await AsyncStorage.getItem('@current_user_id');
      
      // Créer l'objet de diagnostic
      const debugInfo = {
        memoryId,
        asyncStorageId,
        userDataId,
        currentUserId,
        initialized: this.initialized,
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
      };
      
      console.log('🔍 Debug UserIDs:', debugInfo);
      
      // Détecter les incohérences
      const uniqueIds = new Set([memoryId, asyncStorageId, userDataId, currentUserId].filter(Boolean));
      if (uniqueIds.size > 1) {
        console.warn('⚠️ Incohérence détectée entre les IDs utilisateur:', Array.from(uniqueIds));
        
        // Tenter de résoudre en donnant priorité à memoryId puis à userDataId
        const prioritizedId = memoryId || userDataId || asyncStorageId || currentUserId;
        
        if (prioritizedId) {
          console.log(`🔧 Tentative d'uniformisation avec ID: ${prioritizedId}`);
          await this.setUserId(prioritizedId);
        }
      }
      
      return debugInfo;
    } catch (error) {
      console.error('❌ Erreur lors du débogage des IDs utilisateur:', error);
      return {
        error: error.message || 'Erreur inconnue',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Exporter une instance singleton
export default new UserIdManager();
