import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/config/axios';

class UserIdManager {
  private currentUserId: string | null = null;

  /**
   * Récupère l'ID de l'utilisateur actuel
   */
  async getUserId(): Promise<string | null> {
    // Si déjà en mémoire, retourner directement
    if (this.currentUserId) {
      return this.currentUserId;
    }
    
    try {
      // Essayer de récupérer depuis AsyncStorage
      const storedId = await AsyncStorage.getItem('@current_user_id');
      if (storedId) {
        this.currentUserId = storedId;
        return storedId;
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de l\'ID utilisateur:', error);
      return null;
    }
  }

  /**
   * Définit l'ID de l'utilisateur actuel
   */
  async setUserId(userId: string | number): Promise<boolean> {
    try {
      const userIdStr = String(userId);
      this.currentUserId = userIdStr;
      
      // Sauvegarder dans AsyncStorage pour persistance
      await AsyncStorage.setItem('@current_user_id', userIdStr);
      
      // Mettre à jour les headers d'API
      if (api.defaults.headers) {
        api.defaults.headers.userId = userIdStr;
        console.log(`👤 UserIdManager: ID utilisateur défini: ${userIdStr}`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de la définition de l\'ID utilisateur:', error);
      return false;
    }
  }

  /**
   * Efface l'ID de l'utilisateur actuel
   */
  async clearUserId(): Promise<void> {
    try {
      this.currentUserId = null;
      await AsyncStorage.removeItem('@current_user_id');
      
      // Supprimer des headers d'API de manière simplifiée
      if (api.defaults.headers) {
        delete api.defaults.headers.userId;
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de l\'ID utilisateur:', error);
    }
  }
}

export default new UserIdManager();
