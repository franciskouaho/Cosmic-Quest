import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { roomService, Room } from '@/services/queries/room';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useCreateRoom } from './useCreateRoom'; // Importer depuis le nouveau fichier
import SocketService from '@/services/socketService'; // Correction du chemin d'importation

// Hook pour lister toutes les salles
export function useRooms() {
  console.log('🎮 useRooms: Initialisation du hook');
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      console.log('🎮 useRooms: Exécution de la requête');
      
      // Vérification de la connexion internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.error('❌ Pas de connexion internet disponible');
        throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
      }
      
      const rooms = await roomService.getRooms();
      console.log(`🎮 useRooms: ${rooms.length} salles récupérées`);
      return rooms;
    },
    staleTime: 1000 * 30, // Rafraîchir après 30 secondes
    retry: (failureCount, error: any) => {
      console.log(`🎮 useRooms: Tentative ${failureCount + 1} après échec:`, error.message);
      return failureCount < 2;
    },
    onError: (error) => {
      console.error('🎮 useRooms: Erreur lors de la récupération des salles', error);
    },
  });
}

// Hook pour obtenir les détails d'une salle spécifique
export function useRoom(roomCode: string | undefined) {
  console.log(`🎮 useRoom: Initialisation du hook pour la salle ${roomCode}`);
  return useQuery({
    queryKey: ['rooms', roomCode],
    queryFn: async () => {
      if (!roomCode) {
        console.error('🎮 useRoom: Code de salle manquant');
        throw new Error('Code de salle manquant');
      }
      console.log(`🎮 useRoom: Récupération des détails de la salle ${roomCode}`);
      
      // Vérification de la connexion internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.error('❌ Pas de connexion internet disponible');
        throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
      }
      
      try {
        const room = await roomService.getRoomByCode(roomCode);
        
        // S'assurer que les propriétés importantes existent
        if (!room.players) {
          console.warn(`🎮 useRoom: La propriété 'players' est manquante dans la réponse de la salle ${roomCode}`);
          room.players = [];
        }
        
        console.log(`🎮 useRoom: Salle ${roomCode} récupérée avec ${room.players.length} joueurs`);
        return room;
      } catch (error) {
        console.error(`🎮 useRoom: Erreur lors de la récupération de la salle ${roomCode}`, error);
        throw error;
      }
    },
    staleTime: 1000 * 30, // Rafraîchir après 30 secondes
    enabled: !!roomCode, // Ne pas exécuter si roomCode est undefined
    retry: (failureCount, error: any) => {
      // Ne pas réessayer si la salle n'existe pas (404)
      if (error?.response?.status === 404) {
        console.log('🎮 useRoom: Salle non trouvée (404), arrêt des tentatives');
        return false;
      }
      console.log(`🎮 useRoom: Tentative ${failureCount + 1} après échec:`, error.message);
      return failureCount < 2;
    },
    onError: (error: any) => {
      console.error(`🎮 useRoom: Erreur lors de la récupération de la salle ${roomCode}`, error);
      
      if (error.message.includes('Network Error')) {
        // Vérifier l'état de la connexion
        NetInfo.fetch().then(state => {
          console.error(`🌐 État connexion lors de l'erreur: ${state.isConnected ? 'Connecté' : 'Non connecté'} (${state.type})`);
        });
      }
    },
  });
}

// Exportation du hook de création de salle depuis le nouveau fichier
export { useCreateRoom };

// Hook pour rejoindre une salle
export const useJoinRoom = () => {
  const router = useRouter();
  
  return useMutation({
    mutationFn: async (code: string) => {
      try {
        console.log(`🎮 Tentative de rejoindre la salle ${code}`);
        
        // S'assurer que le socket est initialisé avant de tenter de rejoindre une salle
        try {
          await SocketService.initialize();
        } catch (socketError) {
          console.warn('⚠️ Erreur lors de l\'initialisation du socket, tentative de continuer:', socketError);
        }

        // Attendre que le socket soit configuré avant de rejoindre la salle
        console.log(`🚪 Tentative de rejoindre la salle ${code}`);
        await SocketService.joinRoom(code);
        console.log(`✅ Demande WebSocket pour rejoindre la salle ${code} envoyée`);
        
        // Appeler l'API pour rejoindre la salle
        console.log(`🎮 useJoinRoom: Envoi de la requête pour rejoindre ${code}`);
        const response = await api.post(`/rooms/${code}/join`);
        console.log(`🎮 useJoinRoom: Salle ${code} rejointe avec succès`);
        
        return {
          code,
          message: response.data?.message || 'Salle rejointe avec succès'
        };
      } catch (error: any) {
        console.error(`❌ Erreur lors de la tentative de rejoindre la salle ${code}:`, error);
        
        // Amélioration de la gestion des erreurs
        if (error.response) {
          // L'API a répondu avec une erreur
          const message = error.response.data?.error || 'Erreur lors de la tentative de rejoindre la salle';
          throw new Error(message);
        } else if (error.request) {
          // Pas de réponse reçue du serveur
          throw new Error('Le serveur ne répond pas. Veuillez vérifier votre connexion internet.');
        } else {
          // Erreur lors de la configuration de la requête
          throw new Error(`Erreur: ${error.message}`);
        }
      }
    },
    onSuccess: (data) => {
      console.log(`🎮 useJoinRoom: Salle ${data.code} rejointe avec succès`);
      console.log(`🎮 useJoinRoom: Redirection vers /room/${data.code}`);
      router.push(`/room/${data.code}`);
    },
    onError: (error: Error) => {
      console.error('🎮 useJoinRoom: Erreur:', error.message);
      Alert.alert("Erreur", error.message);
    }
  });
};

// Hook pour quitter une salle
export function useLeaveRoom() {
  console.log('🎮 useLeaveRoom: Initialisation du hook');
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (roomCode: string) => {
      console.log(`🎮 useLeaveRoom: Tentative de quitter la salle ${roomCode}`);
      return roomService.leaveRoom(roomCode);
    },
    onSuccess: (_, roomCode) => {
      console.log(`🎮 useLeaveRoom: Salle ${roomCode} quittée avec succès`);
      
      // Invalider toutes les données relatives aux salles
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      
      // Rediriger vers la page principale
      console.log('🎮 useLeaveRoom: Redirection vers la page d\'accueil');
      router.replace('/(tabs)/');
    },
    onError: (error, roomCode) => {
      console.error(`🎮 useLeaveRoom: Erreur lors de la tentative de quitter la salle ${roomCode}`, error);
      Alert.alert(
        'Erreur',
        'Impossible de quitter la salle. Veuillez réessayer.'
      );
    }
  });
}

// Hook pour changer le statut "prêt" d'un joueur
export function useToggleReadyStatus() {
  console.log('🎮 useToggleReadyStatus: Initialisation du hook');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomCode, isReady }: { roomCode: string; isReady: boolean }) => {
      console.log(`🎮 useToggleReadyStatus: Mise à jour du statut dans la salle ${roomCode}: ${isReady ? 'prêt' : 'pas prêt'}`);
      return roomService.toggleReadyStatus(roomCode, isReady);
    },
    onSuccess: (data, variables) => {
      console.log(`🎮 useToggleReadyStatus: Statut mis à jour avec succès dans la salle ${variables.roomCode}`);
      
      // Mettre à jour le cache avec le nouveau statut
      queryClient.setQueryData(['user', 'ready', variables.roomCode], variables.isReady);
      
      // Invalider la requête de salle spécifique pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['rooms', variables.roomCode] });
    },
    onError: (error, variables) => {
      console.error(`🎮 useToggleReadyStatus: Erreur lors de la mise à jour du statut dans la salle ${variables.roomCode}`, error);
      Alert.alert(
        'Erreur',
        'Impossible de mettre à jour votre statut. Veuillez réessayer.'
      );
    }
  });
}

// Hook pour démarrer une partie
export function useStartGame() {
  console.log('🎮 useStartGame: Initialisation du hook');
  const router = useRouter();

  return useMutation({
    mutationFn: async (roomCode: string) => {
      console.log(`🎮 useStartGame: Tentative de démarrer la partie dans la salle ${roomCode}`);
      return roomService.startGame(roomCode);
    },
    onSuccess: (data) => {
      console.log(`🎮 useStartGame: Partie démarrée avec succès, ID du jeu: ${data.data.gameId}`);
      
      // Rediriger vers la page du jeu
      console.log(`🎮 useStartGame: Redirection vers /game/${data.data.gameId}`);
      router.replace(`/game/${data.data.gameId}`);
    },
    onError: (error: any, roomCode) => {
      console.error(`🎮 useStartGame: Erreur lors du démarrage de la partie dans la salle ${roomCode}`, error);
      const errorMessage = error?.response?.data?.error || 'Impossible de démarrer la partie. Veuillez réessayer.';
      Alert.alert('Erreur', errorMessage);
    }
  });
}
