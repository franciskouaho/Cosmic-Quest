import { useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService, CreateRoomPayload } from '@/services/queries/room';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Hook pour créer une nouvelle salle de jeu
 * Ce hook est extrait de useRooms pour une utilisation plus ciblée
 */
export function useCreateRoom() {
  console.log('🎮 useCreateRoom: Initialisation du hook');
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (payload: CreateRoomPayload) => {
      console.log('🎮 useCreateRoom: Création d\'une nouvelle salle', payload);
      
      // Vérification de la connexion internet
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.error('❌ Pas de connexion internet disponible');
        throw new Error('Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.');
      }
      
      return roomService.createRoom(payload);
    },
    onSuccess: (data) => {
      console.log(`🎮 useCreateRoom: Salle créée avec succès, code: ${data.code}`);
      
      // Invalider la requête de liste des salles pour la forcer à se rafraîchir
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      
      // Ajouter la nouvelle salle au cache
      queryClient.setQueryData(['rooms', data.code], data);
      
      // Rediriger vers la page de la salle nouvellement créée
      console.log(`🎮 useCreateRoom: Redirection vers /room/${data.code}`);
      router.push(`/room/${data.code}`);
    },
    onError: (error: any) => {
      console.error('🎮 useCreateRoom: Erreur lors de la création de la salle:', error);
      
      let message = 'Impossible de créer la salle. Veuillez réessayer.';
      
      if (error.message.includes('Network Error')) {
        message = 'Problème de connexion au serveur. Veuillez vérifier votre connexion internet et réessayer.';
        
        // Vérifier l'état de la connexion
        NetInfo.fetch().then(state => {
          console.error(`🌐 État connexion lors de l'erreur: ${state.isConnected ? 'Connecté' : 'Non connecté'} (${state.type})`);
        });
      } else if (error.response?.data?.error) {
        message = error.response.data.error;
      }
      
      Alert.alert('Erreur', message);
    }
  });
}
