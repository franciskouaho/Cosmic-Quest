import { GamePhase } from '@/types/gameTypes';

/**
 * Gestionnaire central pour les transitions et déterminations de phases
 * Permet de garantir une logique cohérente à travers l'application
 */
export class PhaseManager {
  /**
   * Détermine la phase effective de jeu basée sur plusieurs facteurs:
   * - Phase fournie par le serveur
   * - État de l'utilisateur (cible ou non)
   * - Actions déjà effectuées (réponse, vote)
   * 
   * @param serverPhase Phase actuelle du jeu selon le serveur
   * @param isTarget Si l'utilisateur est la cible de la question
   * @param hasAnswered Si l'utilisateur a déjà répondu
   * @param hasVoted Si l'utilisateur a déjà voté
   * @returns Phase effective à afficher à l'utilisateur
   */
  static determineEffectivePhase(
    serverPhase: string,
    isTarget: boolean,
    hasAnswered: boolean,
    hasVoted: boolean
  ): string {
    console.log(`🎮 [PhaseManager] Détermination phase:
      - Phase serveur: ${serverPhase}
      - isTarget: ${isTarget}
      - hasAnswered: ${hasAnswered}
      - hasVoted: ${hasVoted}`);

    // Si le joueur est la cible
    if (isTarget) {
      console.log(`🎯 [PhaseManager] Joueur est la cible`);
      if (serverPhase === 'vote' && !hasVoted) {
        console.log(`🎯 [PhaseManager] Cible peut voter`);
        return 'vote';
      }
      if (serverPhase === 'vote' && hasVoted) {
        console.log(`🎯 [PhaseManager] Cible a déjà voté`);
        return 'waiting';
      }
      console.log(`🎯 [PhaseManager] Cible en attente`);
      return 'waiting';
    }

    // Si le joueur n'est pas la cible
    console.log(`👤 [PhaseManager] Joueur n'est pas la cible`);
    switch (serverPhase) {
      case 'question':
        console.log(`❓ [PhaseManager] Phase question - hasAnswered: ${hasAnswered}`);
        return hasAnswered ? 'waiting' : 'question';
      case 'answer':
        console.log(`📝 [PhaseManager] Phase answer - hasAnswered: ${hasAnswered}`);
        return hasAnswered ? 'waiting' : 'question';
      case 'vote':
        if (hasVoted) {
          console.log(`🗳️ [PhaseManager] Joueur a déjà voté`);
          return 'waiting';
        }
        console.log(`🗳️ [PhaseManager] Phase vote - hasAnswered: ${hasAnswered}`);
        return hasAnswered ? 'vote' : 'waiting_for_vote';
      case 'results':
        console.log(`🏆 [PhaseManager] Phase results`);
        return 'results';
      default:
        console.log(`❓ [PhaseManager] Phase inconnue: ${serverPhase}`);
        return serverPhase;
    }
  }

  /**
   * Dernière phase calculée, utilisée pour la détection de transitions anormales
   */
  private static lastPhase: GamePhase | null = null;
  
  /**
   * Détermine la phase suivante basée sur la phase actuelle
   */
  static getNextPhase(currentPhase: string): string | null {
    switch (currentPhase) {
      case 'question': return 'answer';
      case 'answer': return 'vote';
      case 'vote': return 'results';
      case 'results': return 'question'; // Pour démarrer un nouveau tour
      default: return null;
    }
  }
  
  /**
   * Vérifie si la transition entre deux phases est valide
   */
  static isValidTransition(fromPhase: string, toPhase: string): boolean {
    // Transitions valides normales
    const validTransitions: Record<string, string[]> = {
      'question': ['answer'],
      'answer': ['vote'],
      'vote': ['results'],
      'results': ['question']
    };
    
    // Permettre certaines transitions de récupération
    if ((fromPhase === 'question' && toPhase === 'results') ||
        (fromPhase === 'vote' && toPhase === 'question')) {
      console.warn(`⚠️ Autorisation d'une transition non standard mais récupérable: ${fromPhase} -> ${toPhase}`);
      return true;
    }
    
    return validTransitions[fromPhase]?.includes(toPhase) || false;
  }
  
  /**
   * Réinitialise le gestionnaire de phases
   */
  static reset(): void {
    this.lastPhase = null;
  }
}
