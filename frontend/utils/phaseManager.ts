export enum GamePhase {
  LOADING = 'loading',
  QUESTION = 'question',
  ANSWER = 'answer',
  VOTE = 'vote',
  WAITING = 'waiting',
  WAITING_FOR_VOTE = 'waiting_for_vote',
  RESULTS = 'results',
  FINISHED = 'finished'
}

export class PhaseManager {
  // Transitions valides entre les phases
  static readonly VALID_TRANSITIONS = {
    'loading': ['question', 'answer', 'vote', 'results', 'waiting', 'waiting_for_vote', 'finished'],
    'question': ['answer', 'waiting', 'results'], // Ajout de results pour les cas accélérés
    'answer': ['vote', 'waiting', 'results'],     // Ajout de results pour les transitions rapides
    'vote': ['results', 'waiting', 'waiting_for_vote'],
    'waiting': ['question', 'answer', 'vote', 'results', 'finished'], // Plus permissif
    'waiting_for_vote': ['vote', 'results', 'waiting'],
    'results': ['question', 'finished', 'waiting'],
    'finished': ['question'] // Permettre de recommencer
  };

  // Garde en mémoire la dernière phase calculée pour corriger les désynchronisations
  private static lastCalculatedPhase: string | null = null;
  
  // Nombre de transitions incohérentes détectées
  private static inconsistentTransitions: number = 0;
  
  // Seuil à partir duquel on force une resynchronisation
  private static readonly RESYNC_THRESHOLD: number = 3;
  
  // Timestamps de la dernière phase pour détecter les blocages
  private static phaseTimestamps: Map<string, number> = new Map();

  /**
   * Vérifie si une phase est valide
   */
  static validatePhase(phase: string): boolean {
    return Object.values(GamePhase).includes(phase as GamePhase);
  }

  /**
   * Vérifie si une transition entre deux phases est valide
   */
  static validatePhaseTransition(from: string, to: string): boolean {
    if (!from || !to) return false;
    
    // Si les phases sont identiques, c'est toujours valide
    if (from === to) return true;
    
    // Vérifier dans la table de transitions
    const isValid = this.VALID_TRANSITIONS[from]?.includes(to) || false;
    
    // Détecter les transitions incohérentes
    if (!isValid) {
      this.inconsistentTransitions++;
      console.warn(`⚠️ Transition invalide détectée: ${from} -> ${to}`);
      
      // Si trop d'incohérences, réinitialiser
      if (this.inconsistentTransitions >= this.RESYNC_THRESHOLD) {
        console.error(`🔄 Trop de transitions incohérentes détectées, demande de resynchronisation`);
        this.resetState();
        // Retourner true pour ne pas bloquer le jeu même si la transition est invalide
        return true;
      }
    } else {
      // Réinitialiser le compteur car la transition est valide
      this.inconsistentTransitions = 0;
    }
    
    return isValid;
  }

  /**
   * Réinitialise l'état interne du gestionnaire de phases
   */
  static resetState(): void {
    this.lastCalculatedPhase = null;
    this.inconsistentTransitions = 0;
    this.phaseTimestamps.clear();
  }

  /**
   * Détermine la phase effective basée sur l'état du jeu et du joueur
   * Cette méthode a été améliorée pour être plus robuste et cohérente
   */
  static determineEffectivePhase(
    serverPhase: string,
    isTarget: boolean,
    hasAnswered: boolean,
    hasVoted: boolean,
    forceReset: boolean = false
  ): string {
    if (forceReset) {
      this.resetState();
    }
    
    // Log pour le débugage
    console.log(`🎮 Détermination phase:
      - Phase serveur: ${serverPhase}
      - isTarget: ${isTarget}
      - hasAnswered: ${hasAnswered}
      - hasVoted: ${hasVoted}
      - Dernière phase calculée: ${this.lastCalculatedPhase}
    `);

    // Cas de récupération si la phase est invalide
    if (!serverPhase || typeof serverPhase !== 'string' || !this.validatePhase(serverPhase)) {
      console.error(`⚠️ Phase serveur invalide: ${serverPhase}, utilisation de WAITING comme fallback`);
      
      // Si nous avons une dernière phase connue, essayer de maintenir l'état
      if (this.lastCalculatedPhase) {
        return this.lastCalculatedPhase;
      }
      
      return GamePhase.WAITING;
    }

    // Nouveau calculateur de phase amélioré et instantané
    let effectivePhase;
    
    switch (serverPhase) {
      case 'question':
        // Si la cible, attendre - sinon phase question
        // MODIFICATION: Si a déjà répondu, passer en attente
        effectivePhase = isTarget || hasAnswered ? GamePhase.WAITING : GamePhase.QUESTION;
        break;
      
      case 'answer':
        // Si la cible OU a déjà répondu, alors attendre - sinon répondre
        effectivePhase = (isTarget || hasAnswered) ? GamePhase.WAITING : GamePhase.ANSWER;
        break;
      
      case 'vote':
        // Logique plus sophistiquée pour la phase de vote
        if (isTarget) {
          // La cible doit voter, sauf si elle a déjà voté
          effectivePhase = hasVoted ? GamePhase.WAITING : GamePhase.VOTE;
        } else {
          // Si non-cible, attente pendant que la cible vote
          effectivePhase = GamePhase.WAITING_FOR_VOTE;
        }
        break;
      
      case 'results':
        // Tout le monde voit les résultats
        effectivePhase = GamePhase.RESULTS;
        break;
      
      case 'finished':
        effectivePhase = GamePhase.FINISHED;
        break;
      
      case 'waiting':
        effectivePhase = GamePhase.WAITING;
        break;
      
      default:
        console.warn(`⚠️ Phase non reconnue: ${serverPhase}, utilisation de WAITING`);
        effectivePhase = GamePhase.WAITING;
    }

    // Si nous avons une phase précédente, vérifier que la transition est valide
    if (this.lastCalculatedPhase && this.lastCalculatedPhase !== effectivePhase) {
      const isValid = this.validatePhaseTransition(this.lastCalculatedPhase, effectivePhase);
      
      if (!isValid) {
        console.warn(`⚠️ Transition incohérente! ${this.lastCalculatedPhase} -> ${effectivePhase}`);
        
        // Si trop d'incohérences, accepter la nouvelle phase quand même
        if (this.inconsistentTransitions >= this.RESYNC_THRESHOLD) {
          console.log(`🔄 Acceptation forcée de la nouvelle phase: ${effectivePhase}`);
          this.resetState();
        } else {
          // Sinon conserver la dernière phase connue pour la cohérence
          console.log(`🛡️ Conservation de la phase précédente: ${this.lastCalculatedPhase}`);
          return this.lastCalculatedPhase;
        }
      }
    }
    
    // Détecter les blocages potentiels de phase
    const now = Date.now();
    const lastTimestamp = this.phaseTimestamps.get(serverPhase);
    
    if (lastTimestamp) {
      const duration = now - lastTimestamp;
      // Si bloqué dans la même phase serveur pendant plus de 30 secondes
      if (duration > 30000) {
        console.warn(`⚠️ Potentiel blocage détecté: phase ${serverPhase} active depuis ${Math.round(duration/1000)}s`);
        
        // Pour les phases question et answer, essayer une approche plus agressive
        if ((serverPhase === 'question' && hasAnswered) || 
            (serverPhase === 'answer' && hasAnswered)) {
          console.log(`🔄 Forçage de transition depuis phase ${serverPhase} due à un blocage`);
          
          // Tentative de déblocage automatique
          import('@/utils/socketTester').then(({ checkAndUnblockGame }) => {
            // Utilisez l'ID du jeu si disponible, sinon tentez de le récupérer d'une autre manière
            const gameId = window.currentGameId; // À définir dans votre application
            if (gameId) {
              checkAndUnblockGame(gameId).catch(console.error);
            }
          }).catch(console.error);
        }
      }
    }
    this.phaseTimestamps.set(serverPhase, now);
    
    // Sauvegarder la nouvelle phase calculée
    this.lastCalculatedPhase = effectivePhase;
    
    return effectivePhase;
  }
  
  /**
   * Détecte si un changement de phase requiert une notification spéciale
   */
  static requiresSpecialNotification(oldPhase: string, newPhase: string): boolean {
    // Transitions qui nécessitent une notification spéciale à l'utilisateur
    const specialTransitions = [
      ['waiting', 'vote'],
      ['waiting', 'question'],
      ['waiting_for_vote', 'results'],
      ['question', 'answer'],
      ['answer', 'vote']
    ];
    
    return specialTransitions.some(([from, to]) => from === oldPhase && to === newPhase);
  }
  
  /**
   * Récupère le message approprié pour une transition de phase
   */
  static getTransitionMessage(oldPhase: string, newPhase: string): string {
    const messages = {
      'question_to_answer': "C'est le moment de répondre à la question!",
      'answer_to_vote': "Toutes les réponses sont prêtes. Place au vote!",
      'vote_to_results': "Les votes sont terminés. Découvrez les résultats!",
      'results_to_question': "Nouveau tour! Une nouvelle question arrive...",
      'waiting_to_vote': "C'est à vous de voter!",
      'waiting_to_question': "C'est à vous de jouer!"
    };
    
    const key = `${oldPhase}_to_${newPhase}`;
    return messages[key] || "Phase de jeu mise à jour";
  }
  
  // Nouvelle méthode pour détecter si une phase est bloquée
  static isPhaseBlocked(
    serverPhase: string, 
    hasAnswered: boolean, 
    hasVoted: boolean,
    isTarget: boolean,
    secondsSinceLastChange: number
  ): boolean {
    // Détection spécifique en fonction de la phase
    switch (serverPhase) {
      case 'question':
        // Bloqé si hasAnswered est true mais encore en phase question
        return hasAnswered && secondsSinceLastChange > 10;
      
      case 'answer':
        // Bloqué si tous ont répondu mais encore en phase réponse
        return hasAnswered && secondsSinceLastChange > 15;
        
      case 'vote':
        // Bloqué si la cible a voté mais encore en phase vote
        return isTarget && hasVoted && secondsSinceLastChange > 10;
        
      default:
        return false;
    }
  }
}
