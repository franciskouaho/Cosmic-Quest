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
  ): GamePhase | string {
    console.log(`🎮 Détermination phase:
      - Phase serveur: ${serverPhase}
      - isTarget: ${isTarget}
      - hasAnswered: ${hasAnswered}
      - hasVoted: ${hasVoted}
      - Dernière phase calculée: ${this.lastPhase || 'aucune'}`
    );

    let effectivePhase: GamePhase;

    switch (serverPhase) {
      case 'question':
        effectivePhase = GamePhase.QUESTION;
        break;
        
      case 'answer':
        if (isTarget) {
          effectivePhase = GamePhase.WAITING;  
        } else {
          effectivePhase = hasAnswered ? GamePhase.WAITING : GamePhase.ANSWER;
        }
        break;

      case 'vote':
        if (isTarget && !hasVoted) {
          effectivePhase = GamePhase.VOTE;
        } else {
          effectivePhase = GamePhase.WAITING_FOR_VOTE;
        }
        break;

      case 'results':
        effectivePhase = GamePhase.RESULTS;
        break;

      default:
        console.warn(`⚠️ Phase serveur non reconnue: ${serverPhase}`);
        
        // En cas de phase non reconnue, garder la dernière phase connue ou utiliser WAITING
        effectivePhase = this.lastPhase || GamePhase.WAITING;
        
        // Si la dernière phase est RESULTS, la maintenir
        if (this.lastPhase === GamePhase.RESULTS) {
          console.log(`ℹ️ Phase maintenue: results`);
          effectivePhase = GamePhase.RESULTS;
        }
    }

    // Gérer les transitions non standards
    if (this.lastPhase && this.lastPhase !== effectivePhase) {
      // Détection des transitions anormales comme question -> results
      if (this.lastPhase === GamePhase.QUESTION && effectivePhase === GamePhase.RESULTS) {
        console.warn(`⚠️ Transition de phase non standard: question -> results`);
        // Dans ce cas, on peut conserver la transition car results est une phase finale
      }
    }

    // Stocker la dernière phase calculée
    this.lastPhase = effectivePhase;
    
    return effectivePhase;
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
