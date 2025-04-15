import AsyncStorage from '@react-native-async-storage/async-storage';
import SocketService from '@/services/socketService';
import api from '@/config/axios';
import UserIdManager from './userIdManager';

/**
 * Utilitaire pour récupérer l'état d'un jeu bloqué ou inaccessible
 */
class GameStateRecovery {
  /**
   * Récupère un état minimal pour un jeu qui génère des erreurs persistantes
   * @param gameId ID du jeu à récupérer
   * @returns Un état minimal permettant à l'interface de fonctionner
   */
  static async recoverFromPersistentError(gameId: string): Promise<any> {
    console.log(`🔄 [GameStateRecovery] Tentative de récupération pour le jeu ${gameId}...`);
    
    try {
      // 1. Essayer d'abord de récupérer depuis le stockage local
      const persistedState = await this.getPersistedState(gameId);
      if (persistedState) {
        console.log(`💾 [GameStateRecovery] État récupéré depuis le stockage local`);
        return {
          ...persistedState,
          recovered: true
        };
      }
      
      // 2. Essayer via l'API de récupération d'urgence
      try {
        const userId = await UserIdManager.getUserId();
        
        // Ajouter un header spécial pour indiquer le mode de récupération
        const headers = { 'X-Recovery-Mode': 'true' };
        if (userId) headers['userId'] = String(userId);
        
        const response = await api.get(`/games/${gameId}`, { headers });
        
        if (response.data?.data) {
          console.log(`✅ [GameStateRecovery] État récupéré via l'API d'urgence`);
          
          // Stocker l'état récupéré pour les futurs problèmes
          this.persistState(gameId, response.data.data);
          
          return {
            ...response.data.data,
            recovered: true
          };
        }
      } catch (apiError) {
        console.error(`❌ [GameStateRecovery] Échec de l'API de récupération:`, apiError);
      }
      
      // 3. Dernière chance: créer un état synthétique minimal
      console.log(`⚠️ [GameStateRecovery] Création d'un état minimal pour ${gameId}`);
      
      // Récupérer les données minimales dont on pourrait avoir besoin
      const minimalState = await this.createMinimalState(gameId);
      
      return {
        ...minimalState,
        recovered: true,
        minimal: true
      };
    } catch (error) {
      console.error(`❌ [GameStateRecovery] Échec de la récupération:`, error);
      
      // État absolument minimal en cas d'échec complet
      return {
        game: {
          id: gameId,
          currentRound: 1,
          totalRounds: 5,
          currentPhase: 'question',
          scores: {}
        },
        players: [],
        answers: [],
        currentQuestion: null,
        recovered: true,
        minimal: true,
        failed: true
      };
    }
  }
  
  /**
   * Tente de forcer la récupération d'un jeu via le serveur
   */
  static async forceGameRecovery(gameId: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameStateRecovery] Demande de récupération forcée pour ${gameId}...`);
      
      // 1. Essayer via l'API de récupération
      const userId = await UserIdManager.getUserId();
      const response = await api.post(`/games/${gameId}/recover-state`, { userId });
      
      if (response.data?.status === 'success') {
        console.log(`✅ [GameStateRecovery] Récupération serveur réussie`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ [GameStateRecovery] Échec de la récupération forcée:`, error);
      return false;
    }
  }
  
  /**
   * Force la progression d'un jeu bloqué
   */
  static async forceGameProgress(gameId: string): Promise<boolean> {
    try {
      console.log(`🔄 [GameStateRecovery] Tentative de déblocage pour ${gameId}...`);
      
      // 1. Forcer une vérification de phase
      const socket = await SocketService.getInstanceAsync();
      
      socket.emit('game:force_check', { gameId });
      console.log(`📤 [GameStateRecovery] Signal de vérification forcée envoyé`);
      
      // 2. Attendre un peu
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. Essayer de forcer le passage au tour suivant si c'est un cas de blocage
      socket.emit('game:next_round', { 
        gameId,
        forceAdvance: true,
        timestamp: Date.now()
      });
      console.log(`📤 [GameStateRecovery] Signal de forçage de tour suivant envoyé`);
      
      return true;
    } catch (error) {
      console.error(`❌ [GameStateRecovery] Échec du forçage de progression:`, error);
      return false;
    }
  }
  
  /**
   * Récupère un état de jeu persisté localement
   */
  private static async getPersistedState(gameId: string): Promise<any | null> {
    try {
      const savedState = await AsyncStorage.getItem(`game_state_${gameId}`);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Si l'état date de moins de 5 minutes, le considérer comme valide pour la récupération
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed.state;
        }
      }
      return null;
    } catch (error) {
      console.warn(`⚠️ [GameStateRecovery] Erreur lors de la récupération de l'état persisté:`, error);
      return null;
    }
  }
  
  /**
   * Persiste un état de jeu localement
   */
  private static async persistState(gameId: string, state: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `game_state_${gameId}`, 
        JSON.stringify({
          state,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.warn(`⚠️ [GameStateRecovery] Erreur lors de la persistence de l'état:`, error);
    }
  }
  
  /**
   * Crée un état minimal à partir des données disponibles
   */
  private static async createMinimalState(gameId: string): Promise<any> {
    // Essayer de récupérer des morceaux d'informations depuis le stockage
    const userId = await UserIdManager.getUserId();
    
    // État minimal par défaut
    return {
      game: {
        id: gameId,
        currentRound: 1,
        totalRounds: 5,
        currentPhase: 'loading', // Commencer en phase loading pour forcer une actualisation
        scores: {}
      },
      players: [],
      currentQuestion: null,
      answers: [],
      currentUserState: {
        hasAnswered: false,
        hasVoted: false,
        isTargetPlayer: false
      }
    };
  }
}

export default GameStateRecovery;
