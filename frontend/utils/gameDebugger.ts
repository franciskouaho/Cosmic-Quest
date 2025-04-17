import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/config/axios';
import { GameState } from '../types/gameTypes';
import { UserIdManager } from './userIdManager';

/**
 * Classe d'utilitaire pour le débogage et la récupération des jeux
 */
class GameDebugger {
  private socketService: any; // SocketService

  constructor() {
    // Importer dynamiquement pour éviter les dépendances circulaires
    import('../services/socketService').then(module => {
      this.socketService = module.default;
    });
  }

  /**
   * Force la correction d'une phase
   * @param gameId ID du jeu 
   * @param correctPhase Phase correcte à définir
   * @returns Promise<boolean> résultat de l'opération
   */
  async forcePhaseCorrection(gameId: string, correctPhase?: string): Promise<boolean> {
    try {
      console.log(`🔧 GameDebugger: Tentative de correction de phase pour le jeu ${gameId}`);
      
      if (!this.socketService) {
        console.warn('⚠️ SocketService non disponible, chargement en cours...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!this.socketService) {
          // Charger directement
          const socketModule = await import('../services/socketService');
          this.socketService = socketModule.default;
        }
      }
      
      // Vérifier si la phase est spécifiée
      if (correctPhase) {
        console.log(`🛠️ Tentative de correction vers la phase spécifique: ${correctPhase}`);
        // Logique spécifique pour définir une phase particulière
        // Pourrait être implémentée dans le futur
      }
      
      // Utiliser la méthode standard de vérification de phase
      const result = await this.socketService.forcePhaseCheck(gameId);
      
      this.log('Signal de vérification forcée envoyé au serveur');
      return result;
    } catch (error) {
      console.error('❌ Erreur lors de la correction de phase:', error);
      return false;
    }
  }
  
  /**
   * Méthode utilitaire pour le logging
   */
  private log(message: string): void {
    console.log(`🐞 GameDebugger: ${message}`);
  }
}

// Exporter une instance pour un usage simplifié
export default new GameDebugger();
