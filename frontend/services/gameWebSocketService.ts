import { Socket } from 'socket.io-client';
import SocketService from './socketService';
import UserIdManager from '@/utils/userIdManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebSocketResponse } from '@/types/gameTypes';
import { PhaseManager } from '../utils/phaseManager';

class GameWebSocketService {
  private pendingRequests: Map<string, { promise: Promise<any>, timestamp: number }> = new Map();
  private gameStateCache: Map<string, { state: any, timestamp: number }> = new Map();
  private joinedGames: Set<string> = new Set();
  private pendingJoinRequests: Map<string, Promise<void>> = new Map();
  private readonly CACHE_TTL = 3000; // 3 secondes
  private readonly REQUEST_TIMEOUT = 5000; // 5 secondes
  private readonly RECONNECT_DELAY = 1000; // 1 seconde

  /**
   * S'assure que la connexion Socket est établie et que l'utilisateur a rejoint le canal du jeu
   */
  async ensureSocketConnection(gameId: string): Promise<boolean> {
    try {
      // Vérifier si un socket est déjà disponible et connecté
      const socket = await SocketService.getInstanceAsync();
      
      if (!socket.connected) {
        console.log(`⚠️ [GameWebSocket] Socket non connecté, tentative de reconnexion...`);
        
        // Essayer de reconnecter avec un délai d'expiration
        const reconnectPromise = this.reconnect();
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), 2000);
        });
        
        const reconnected = await Promise.race([reconnectPromise, timeoutPromise]);
        if (!reconnected) {
          console.error(`❌ [GameWebSocket] Échec de reconnexion dans le délai imparti`);
          return false;
        }
      }
      
      // S'assurer que l'utilisateur a rejoint le canal du jeu si ce n'est pas déjà fait
      if (!this.joinedGames.has(gameId)) {
        // Vérifier si une requête de jointure est déjà en cours
        if (this.pendingJoinRequests.has(gameId)) {
          console.log(`🔄 [GameWebSocket] Jointure déjà en cours pour ${gameId}, attente...`);
          try {
            await Promise.race([
              this.pendingJoinRequests.get(gameId),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de jointure')), 3000))
            ]);
          } catch (timeoutError) {
            console.warn(`⚠️ [GameWebSocket] Timeout lors de l'attente d'une jointure en cours`);
            this.pendingJoinRequests.delete(gameId);
            return false;
          }
        } else {
          // Stocker la promesse pour la jointure
          const joinPromise = this.joinGameChannel(gameId);
          this.pendingJoinRequests.set(gameId, joinPromise);
          
          try {
            // Utiliser Promise.race pour limiter le temps d'attente
            await Promise.race([
              joinPromise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de jointure')), 3000))
            ]);
          } catch (error) {
            console.error(`❌ [GameWebSocket] Erreur ou timeout lors de la jointure au canal:`, error);
            return false;
          } finally {
            // Supprimer la requête en attente
            this.pendingJoinRequests.delete(gameId);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la vérification de la connexion:`, error);
      return false;
    }
  }

  /**
   * Reconnecte le socket si nécessaire
   */
  async reconnect(): Promise<boolean> {
    try {
      console.log(`🔄 [GameWebSocket] Tentative de reconnexion...`);
      
      // Forcer une nouvelle connexion
      const socket = await SocketService.getInstanceAsync(true);
      
      // Vérifier si la reconnexion a réussi
      if (socket.connected) {
        console.log(`✅ [GameWebSocket] Reconnexion réussie`);
        
        // Réinitialiser la liste des jeux joints après une reconnexion
        this.joinedGames.clear();
        
        return true;
      } else {
        console.error(`❌ [GameWebSocket] La reconnexion a échoué`);
        return false;
      }
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la reconnexion:`, error);
      return false;
    }
  }

  /**
   * Rejoint le canal WebSocket d'un jeu spécifique pour recevoir les mises à jour en temps réel
   */
  private async joinGameChannel(gameId: string): Promise<void> {
    try {
      console.log(`🎮 [GameWebSocket] Tentative de rejoindre le canal du jeu ${gameId}`);
      
      // Obtenir une instance Socket.IO et s'assurer qu'elle est connectée
      const socket = await SocketService.getInstanceAsync();
      
      // Ne pas rejoindre si déjà dans ce canal
      if (this.joinedGames.has(gameId)) {
        console.log(`ℹ️ [GameWebSocket] Déjà dans le canal du jeu ${gameId}`);
        return;
      }
      
      // Utiliser une promesse pour attendre la jointure au lieu d'await directement
      return new Promise<void>((resolve, reject) => {
        SocketService.joinGameChannel(gameId)
          .then(() => {
            console.log(`✅ [GameWebSocket] Canal du jeu ${gameId} rejoint avec succès`);
            this.joinedGames.add(gameId);
            resolve();
          })
          .catch((joinError) => {
            console.warn(`⚠️ [GameWebSocket] Erreur lors de la jointure du canal ${gameId}:`, joinError);
            reject(joinError);
          });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la jointure au canal du jeu:`, error);
      throw error;
    }
  }

  /**
   * Quitte le canal WebSocket d'un jeu spécifique
   */
  async leaveGameChannel(gameId: string): Promise<void> {
    try {
      // Ne quitter que si on est effectivement dans ce canal
      if (!this.joinedGames.has(gameId)) {
        console.log(`ℹ️ [GameWebSocket] Pas besoin de quitter le canal ${gameId}, non joint`);
        return;
      }
      
      await SocketService.leaveGameChannel(gameId);
      this.joinedGames.delete(gameId);
      console.log(`✅ [GameWebSocket] Canal du jeu ${gameId} quitté`);
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors du départ du canal du jeu:`, error);
      // Ne pas propager l'erreur pour éviter de bloquer la navigation
    }
  }

  /**
   * Récupère l'état complet d'un jeu via WebSocket
   * Avec cache et gestion intelligente des requêtes multiples
   */
  async getGameState(gameId: string): Promise<any> {
    console.log(`🔌 [GameWebSocket] Récupération de l'état du jeu ${gameId} via WebSocket...`);
    
    // Vérifier si on a déjà une requête en cours pour ce jeu
    if (this.pendingRequests.has(gameId)) {
      const pendingRequest = this.pendingRequests.get(gameId);
      const timeSinceRequest = Date.now() - pendingRequest.timestamp;
      
      // Si la requête est récente, utiliser le cache pour éviter la surcharge
      if (timeSinceRequest < this.REQUEST_TIMEOUT / 2) {
        console.log(`🔄 [GameWebSocket] Une requête est déjà en cours pour ${gameId}, utilisation du cache...`);
        
        try {
          return await pendingRequest.promise;
        } catch (error) {
          // Si l'ancienne requête échoue, on continue avec une nouvelle après un court délai
          console.warn(`⚠️ [GameWebSocket] La requête en cache a échoué, attente avant nouvelle tentative...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Vérifier le cache pour éviter les requêtes inutiles
    const cachedData = this.gameStateCache.get(gameId);
    if (cachedData && (Date.now() - cachedData.timestamp < this.CACHE_TTL)) {
      console.log(`🗄️ [GameWebSocket] Utilisation du cache pour ${gameId}`);
      return cachedData.state;
    }
    
    try {
      // S'assurer que la connexion socket est établie et que l'utilisateur a rejoint le canal du jeu
      await this.ensureSocketConnection(gameId);
      
      // Créer une promesse pour la requête avec un délai réduit et une meilleure gestion des erreurs
      const requestPromise = new Promise<any>((resolve, reject) => {
        // Utiliser Promise.race pour gérer le timeout plus proprement
        const socketPromise = (async () => {
          try {
            const socket = await SocketService.getInstanceAsync();
            const userId = await UserIdManager.getUserId();
            
            console.log(`🔍 [GameWebSocket] Envoi de la requête get_state - Game: ${gameId}, User: ${userId}`);
            
            socket.emit('game:get_state', { gameId, userId }, (response: any) => {
              if (response && response.success) {
                // Mettre en cache les données reçues
                this.gameStateCache.set(gameId, {
                  state: response.data,
                  timestamp: Date.now()
                });
                
                console.log(`✅ [GameWebSocket] État du jeu ${gameId} récupéré avec succès`);
                resolve(response.data);
              } else {
                console.error(`❌ [GameWebSocket] Erreur dans la réponse:`, response?.error || 'Erreur inconnue');
                reject(new Error(response?.error || 'Erreur lors de la récupération de l\'état du jeu'));
              }
            });
          } catch (error) {
            reject(error);
          }
        })();
        
        // Promesse de timeout qui se résout après le délai imparti
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Timeout lors de la récupération de l\'état du jeu'));
          }, this.REQUEST_TIMEOUT - 500); // Réduire légèrement pour éviter les conditions limite
        });
        
        // Utiliser Promise.race pour prendre la première promesse qui se résout/rejette
        Promise.race([socketPromise, timeoutPromise]).catch(reject);
      });
      
      // Enregistrer cette promesse comme requête en cours
      this.pendingRequests.set(gameId, { 
        promise: requestPromise,
        timestamp: Date.now()
      });
      
      try {
        // Attendre le résultat avec un timeout supplémentaire de sécurité
        const result = await Promise.race([
          requestPromise,
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout global dépassé')), this.REQUEST_TIMEOUT)
          )
        ]);
        
        return result;
      } catch (error) {
        // En cas d'erreur WebSocket, essayer de récupérer depuis le stockage persistant
        console.error(`❌ [GameWebSocket] Erreur lors de la récupération de l'état du jeu ${gameId}:`, error);
        
        try {
          const persistedState = await this.loadPersistedGameState(gameId);
          if (persistedState) {
            console.log(`💾 [GameWebSocket] État récupéré depuis le stockage persistant pour ${gameId}`);
            return persistedState;
          }
        } catch (storageError) {
          console.warn(`⚠️ [GameWebSocket] Erreur lors de la récupération depuis le stockage:`, storageError);
        }
        
        console.warn(`⚠️ [GameWebSocket] Tentative de fallback API pour ${gameId}`);
        throw error; // Laisser le service de niveau supérieur gérer le fallback
      } finally {
        // Nettoyer la requête en cours après un délai pour éviter les conditions de course
        setTimeout(() => {
          this.pendingRequests.delete(gameId);
        }, 500);
      }
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la récupération via WebSocket:`, error);
      throw error;
    }
  }
  
  /**
   * Persiste l'état du jeu dans AsyncStorage
   */
  private async persistGameState(gameId: string, state: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `game_state_${gameId}`, 
        JSON.stringify({
          state,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.warn('⚠️ [GameWebSocket] Erreur lors de la persistence de l\'état du jeu:', error);
    }
  }

  /**
   * Récupère l'état du jeu depuis AsyncStorage
   */
  private async loadPersistedGameState(gameId: string): Promise<any | null> {
    try {
      const savedState = await AsyncStorage.getItem(`game_state_${gameId}`);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Vérifier si l'état n'est pas trop ancien (moins de 20 secondes)
        if (Date.now() - parsed.timestamp < 20 * 1000) {
          return parsed.state;
        }
      }
      return null;
    } catch (error) {
      console.warn('⚠️ [GameWebSocket] Erreur lors de la récupération de l\'état persitant du jeu:', error);
      return null;
    }
  }

  /**
   * Vérifie si l'utilisateur actuel est l'hôte du jeu
   */
  async isUserHost(gameId: string): Promise<boolean> {
    try {
      console.log(`🔍 [GameWebSocket] Vérification d'hôte pour la partie ${gameId}`);
      
      // Vérifier d'abord le cache local
      const hostInfo = await this.getHostInfoFromCache(gameId);
      if (hostInfo) {
        console.log(`🗄️ [GameWebSocket] Utilisation des informations d'hôte en cache pour ${gameId}: ${hostInfo.isHost}`);
        return hostInfo.isHost;
      }
      
      // Si pas dans le cache, essayer de récupérer depuis le stockage local
      try {
        const userId = await UserIdManager.getUserId();
        const savedHostInfo = await AsyncStorage.getItem(`@game_host_${gameId}`);
        
        if (savedHostInfo) {
          const hostData = JSON.parse(savedHostInfo);
          const isHost = String(hostData.hostId) === String(userId);
          console.log(`💾 [GameWebSocket] Vérification d'hôte depuis le stockage: ${isHost}`);
          
          // Mettre en cache pour les prochaines vérifications
          this.storeHostInfoInCache(gameId, { isHost, hostId: hostData.hostId });
          
          return isHost;
        }
      } catch (storageError) {
        console.warn('⚠️ [GameWebSocket] Erreur lors de la récupération depuis le stockage:', storageError);
      }
      
      // Si pas dans le stockage local, vérifier via WebSocket avec mécanisme de retry
      await this.ensureSocketConnection(gameId);
      
      const userId = await UserIdManager.getUserId();
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise<boolean>(async (resolve) => {
        // Premier timeout plus court (2 secondes)
        const timeoutId = setTimeout(async () => {
          console.warn(`⚠️ [GameWebSocket] Timeout initial lors de la vérification d'hôte, tentative de retry...`);
          
          // Tentative de réinitialisation de la connexion
          try {
            if (!socket.connected) {
              await this.reconnect();
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Nouvelle tentative
            const secondAttemptTimeoutId = setTimeout(() => {
              console.error(`❌ [GameWebSocket] Second timeout détecté, utilisation d'une valeur par défaut`);
              resolve(false);
            }, 2000);
            
            socket.emit('game:check_host', { 
              gameId, 
              userId,
              retry: true, // Marquer comme tentative de retry
              timestamp: Date.now()
            }, (response: WebSocketResponse) => {
              clearTimeout(secondAttemptTimeoutId);
              
              if (response && typeof response.isHost === 'boolean') {
                console.log(`👑 [GameWebSocket] Réponse vérification hôte après retry pour ${gameId}: ${response.isHost}`);
                
                // Mettre en cache pour les prochaines fois
                this.storeHostInfoInCache(gameId, {
                  isHost: response.isHost,
                  hostId: response.hostId
                });
                
                resolve(response.isHost);
              } else {
                console.warn(`⚠️ [GameWebSocket] Pas de réponse valide après retry, valeur par défaut utilisée`);
                resolve(false);
              }
            });
          } catch (retryError) {
            console.error(`❌ [GameWebSocket] Erreur lors du retry:`, retryError);
            resolve(false);
          }
        }, 2000);
        
        // Première tentative
        socket.emit('game:check_host', { gameId, userId }, (response: WebSocketResponse) => {
          clearTimeout(timeoutId);
          
          if (response && typeof response.isHost === 'boolean') {
            console.log(`👑 [GameWebSocket] Réponse vérification hôte pour ${gameId}: ${response.isHost}`);
            
            // Mettre en cache pour les prochaines fois
            this.storeHostInfoInCache(gameId, {
              isHost: response.isHost,
              hostId: response.hostId
            });
            
            resolve(response.isHost);
          } else {
            console.warn(`⚠️ [GameWebSocket] Réponse invalide, tentative de retry automatique`);
            // Ne pas résoudre ici, laisser le timeout déclencher le retry
          }
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la vérification d'hôte:`, error);
      return false; // Par défaut, l'utilisateur n'est pas l'hôte en cas d'erreur
    }
  }

  /**
   * Stocke les informations d'hôte dans le cache
   */
  private async storeHostInfoInCache(gameId: string, info: { isHost: boolean, hostId?: string }) {
    try {
      await AsyncStorage.setItem(
        `@game_host_${gameId}_cache`,
        JSON.stringify({
          ...info,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.warn(`⚠️ [GameWebSocket] Erreur lors du stockage des informations d'hôte en cache:`, error);
    }
  }
  
  /**
   * Récupère les informations d'hôte depuis le cache
   */
  private async getHostInfoFromCache(gameId: string): Promise<{ isHost: boolean, hostId?: string } | null> {
    try {
      const cachedInfo = await AsyncStorage.getItem(`@game_host_${gameId}_cache`);
      if (cachedInfo) {
        const data = JSON.parse(cachedInfo);
        
        // Vérifier si les informations sont encore fraîches (moins de 5 minutes)
        if (Date.now() - data.timestamp < 5 * 60 * 1000) {
          return {
            isHost: data.isHost,
            hostId: data.hostId
          };
        }
      }
      return null;
    } catch (error) {
      console.warn(`⚠️ [GameWebSocket] Erreur lors de la récupération d'informations d'hôte en cache:`, error);
      return null;
    }
  }

  /**
   * Soumet une réponse à une question via WebSocket
   */
  async submitAnswer(gameId: string, questionId: string, content: string): Promise<boolean> {
    try {
      console.log(`📝 [GameWebSocket] Tentative de soumission de réponse pour la question ${questionId}`);
      
      // S'assurer que la connexion est établie
      const connectionReady = await this.ensureSocketConnection(gameId);
      if (!connectionReady) {
        console.warn(`⚠️ [GameWebSocket] Connexion non établie, tentative de reconnexion...`);
        await this.reconnect();
        // Attendre un peu pour que la reconnexion prenne effet
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const socket = await SocketService.getInstanceAsync();
      const userId = await UserIdManager.getUserId();
      
      return new Promise<boolean>(async (resolve) => {
        // Définir un timeout plus court (3 secondes)
        const timeoutId = setTimeout(() => {
          console.warn('⚠️ Premier timeout détecté, tentative de récupération...');
          this.attemptRecovery(gameId);
        }, 3000);
        
        // Première tentative
        socket.emit('game:submit_answer', { 
          gameId, questionId, content, userId,
          timestamp: Date.now()
        }, (response: WebSocketResponse) => {
          clearTimeout(timeoutId);
          if (response && response.success) {
            console.log(`✅ [GameWebSocket] Réponse soumise avec succès pour la question ${questionId}`);
            resolve(true);
          } else {
            console.error(`❌ [GameWebSocket] Erreur lors de la soumission de la réponse:`, response?.error || 'Erreur inconnue');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la soumission de la réponse:`, error);
      return false;
    }
  }

  /**
   * Ajoute une méthode de récupération
   */
  private async attemptRecovery(gameId: string) {
    try {
      await this.reconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.ensureSocketConnection(gameId);
    } catch (error) {
      console.error('❌ Échec de la récupération:', error);
    }
  }

  /**
   * Soumet un vote pour une réponse via WebSocket
   */
  async submitVote(gameId: string, answerId: string, questionId: string): Promise<boolean> {
    try {
      console.log(`🗳️ [GameWebSocket] Tentative de soumission de vote pour la réponse ${answerId}`);
      
      // S'assurer que la connexion est établie
      const connectionReady = await this.ensureSocketConnection(gameId);
      if (!connectionReady) {
        console.warn(`⚠️ [GameWebSocket] Connexion non établie, tentative de reconnexion...`);
        await this.reconnect();
        // Attendre un peu pour que la reconnexion prenne effet
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const socket = await SocketService.getInstanceAsync();
      const userId = await UserIdManager.getUserId();
      
      return new Promise<boolean>(async (resolve) => {
        // Définir un timeout plus court (3 secondes)
        const timeoutId = setTimeout(async () => {
          console.warn(`⚠️ [GameWebSocket] Timeout initial détecté lors de la soumission du vote, tentative de retry...`);
          
          // Essayer une seconde fois directement
          try {
            // S'assurer que le socket est toujours connecté
            if (!socket.connected) {
              console.log(`🔄 [GameWebSocket] Socket déconnecté, tentative de reconnexion...`);
              await this.reconnect();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Nouvelle tentative
            const secondAttemptTimeoutId = setTimeout(() => {
              console.error(`❌ [GameWebSocket] Second timeout détecté, échec de la soumission du vote`);
              resolve(false);
            }, 4000);
            
            socket.emit('game:submit_vote', { 
              gameId, answerId, questionId, voterId: userId,
              retry: true, // Marquer comme tentative de retry
              timestamp: Date.now()
            }, (response: WebSocketResponse) => {
              clearTimeout(secondAttemptTimeoutId);
              if (response && response.success) {
                console.log(`✅ [GameWebSocket] Vote soumis avec succès après retry`);
                resolve(true);
              } else {
                console.error(`❌ [GameWebSocket] Échec après retry:`, response?.error || 'Erreur inconnue');
                resolve(false);
              }
            });
          } catch (retryError) {
            console.error(`❌ [GameWebSocket] Erreur lors du retry:`, retryError);
            resolve(false);
          }
        }, 3000);
        
        // Première tentative
        socket.emit('game:submit_vote', { 
          gameId, answerId, questionId, voterId: userId,
          timestamp: Date.now()
        }, (response: WebSocketResponse) => {
          clearTimeout(timeoutId);
          if (response && response.success) {
            console.log(`✅ [GameWebSocket] Vote soumis avec succès pour la réponse ${answerId}`);
            resolve(true);
          } else {
            console.error(`❌ [GameWebSocket] Erreur lors de la soumission du vote:`, response?.error || 'Erreur inconnue');
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la soumission du vote:`, error);
      return false;
    }
  }

  /**
   * Passe au tour suivant via WebSocket
   */
  async nextRound(gameId: string): Promise<boolean> {
    try {
      console.log(`🎮 [GameWebSocket] Passage au tour suivant pour le jeu ${gameId}...`);
      
      // S'assurer que la connexion est établie
      const connectionReady = await this.ensureSocketConnection(gameId);
      if (!connectionReady) {
        console.warn(`⚠️ [GameWebSocket] Connexion non établie, tentative de reconnexion...`);
        await this.reconnect();
        // Attendre un peu pour que la reconnexion prenne effet
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const socket = await SocketService.getInstanceAsync();
      const userId = await UserIdManager.getUserId();
      
      return new Promise<boolean>(async (resolve, reject) => {
        // Timeout initial plus court (5 secondes)
        const timeoutId = setTimeout(async () => {
          console.warn(`⚠️ [GameWebSocket] Timeout initial détecté lors du passage au tour suivant, tentative de retry...`);
          
          try {
            // S'assurer que le socket est toujours connecté
            if (!socket.connected) {
              await this.reconnect();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Nouvelle tentative avec timeout plus court
            const secondAttemptTimeoutId = setTimeout(() => {
              console.error(`❌ [GameWebSocket] Second timeout détecté, échec du passage au tour suivant`);
              reject(new Error("Timeout lors du passage au tour suivant"));
            }, 5000);
            
            socket.emit('game:next_round', { 
              gameId, 
              userId, 
              retry: true,
              timestamp: Date.now() 
            }, (response: WebSocketResponse) => {
              clearTimeout(secondAttemptTimeoutId);
              
              if (response && response.success) {
                console.log(`✅ [GameWebSocket] Passage au tour suivant réussi après retry`);
                resolve(true);
              } else {
                console.error(`❌ [GameWebSocket] Échec après retry:`, response?.error || 'Erreur inconnue');
                reject(new Error(response?.error || 'Échec du passage au tour suivant'));
              }
            });
          } catch (retryError) {
            console.error(`❌ [GameWebSocket] Erreur lors du retry:`, retryError);
            reject(retryError);
          }
        }, 5000);
        
        // Première tentative
        socket.emit('game:next_round', { 
          gameId, 
          userId,
          timestamp: Date.now() 
        }, (response: WebSocketResponse) => {
          clearTimeout(timeoutId);
          
          if (response && response.success) {
            console.log(`✅ [GameWebSocket] Passage au tour suivant réussi pour le jeu ${gameId}`);
            resolve(true);
          } else if (response) {
            console.error(`❌ [GameWebSocket] Erreur lors du passage au tour suivant:`, response.error || 'Erreur inconnue');
            reject(new Error(response.error || 'Erreur lors du passage au tour suivant'));
          } else {
            // Si pas de réponse, laisser le timeout se déclencher pour le retry
            console.warn(`⚠️ [GameWebSocket] Pas de réponse pour le passage au tour suivant`);
          }
        });
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors du passage au tour suivant:`, error);
      throw error;
    }
  }

  /**
   * Force la vérification de la phase du jeu
   */
  async forceCheckPhase(gameId: string): Promise<boolean> {
    try {
      console.log(`🔍 [GameWebSocket] Force la vérification de phase pour le jeu ${gameId}`);
      
      // S'assurer que la connexion est établie avec retry
      const connectionReady = await this.ensureSocketConnection(gameId);
      if (!connectionReady) {
        console.warn(`⚠️ [GameWebSocket] Connexion non établie, tentative de reconnexion...`);
        await this.reconnect();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      const socket = await SocketService.getInstanceAsync();
      
      return new Promise<boolean>((resolve) => {
        // Timeout plus court (2 secondes)
        const timeoutId = setTimeout(async () => {
          console.warn(`⚠️ [GameWebSocket] Timeout lors de la vérification forcée, tentative de retry...`);
          
          try {
            // Vérifier la connexion à nouveau
            if (!socket.connected) {
              await this.reconnect();
            }
            
            // Seconde tentative
            socket.emit('game:force_check', { 
              gameId,
              retry: true,
              timestamp: Date.now()
            });
            
            console.log(`✅ [GameWebSocket] Demande de vérification forcée envoyée (retry)`);
            resolve(true);
          } catch (error) {
            console.error(`❌ [GameWebSocket] Erreur lors du retry:`, error);
            resolve(false);
          }
        }, 2000);
        
        // Première tentative
        socket.emit('game:force_check', { gameId });
        
        // Nous considérons que l'opération est réussie si l'émission se fait sans erreur
        // Résoudre avec délai pour éviter les problèmes de synchronisation
        setTimeout(() => {
          clearTimeout(timeoutId);
          console.log(`✅ [GameWebSocket] Demande de vérification forcée envoyée`);
          resolve(true);
        }, 300);
      });
    } catch (error) {
      console.error(`❌ [GameWebSocket] Erreur lors de la vérification forcée de phase:`, error);
      return false;
    }
  }

  /**
   * Nettoie les ressources pour ce jeu (cache, etc.)
   */
  clearGameResources(gameId: string): void {
    this.pendingRequests.delete(gameId);
    this.gameStateCache.delete(gameId);
    this.joinedGames.delete(gameId);
    this.pendingJoinRequests.delete(gameId);
    
    console.log(`🧹 [GameWebSocket] Ressources nettoyées pour le jeu ${gameId}`);
  }

  /**
   * Gère les mises à jour du jeu
   */
  async handleGameUpdate(gameId: string, data: any) {
    try {
      if (data.type === 'phase_change') {
        const currentPhase = await this.getCurrentPhase(gameId);
        
        if (!PhaseManager.validatePhaseTransition(currentPhase, data.phase)) {
          console.warn(`⚠️ Transition de phase invalide: ${currentPhase} -> ${data.phase}`);
          // Forcer une récupération complète de l'état
          await this.getGameState(gameId);
          return;
        }
      }
    } catch (error) {
      console.error('❌ Erreur handleGameUpdate:', error);
    }
  }
}

export default new GameWebSocketService();
