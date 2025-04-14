import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../config/queryClient';
import api from '../config/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginCredentials, RegisterCredentials, User } from '../types/authTypes';
import UserIdManager from '../utils/userIdManager';
import { useRouter } from 'expo-router';

// Récupérer l'utilisateur actuel depuis l'API
const fetchCurrentUser = async (): Promise<User> => {
  try {
    // Utiliser l'endpoint correct
    const response = await api.get('/users/profile');
    return response.data.data;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des données utilisateur:', error);
    throw error;
  }
};

// Hook personnalisé pour récupérer et stocker l'utilisateur actuel
export const useUser = () => {
  return useQuery({
    queryKey: ['user'],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (anciennement cacheTime)
    retry: 1,
    onSuccess: async (data) => {
      if (data && data.id) {
        // Synchroniser l'ID utilisateur dans toute l'application
        await UserIdManager.setUserId(data.id);
        // Stocker les données utilisateur complètes
        await AsyncStorage.setItem('@user_data', JSON.stringify(data));
      }
    },
    onError: (err) => {
      console.error('❌ Erreur lors de la récupération des données utilisateur:', err);
    }
  });
};

// Hook personnalisé pour le rafraîchissement du token
export const useTokenRefresh = () => {
  return useMutation({
    mutationFn: async () => {
      // Note: Vérifiez si cet endpoint existe réellement sur votre API
      const response = await api.post('/auth/refresh-token');
      return response.data;
    },
    onSuccess: async (data) => {
      await AsyncStorage.setItem('@auth_token', data.token);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });
};

// Hook personnalisé pour la connexion
export const useLogin = () => {
  const router = useRouter();
  
  return useMutation({
    mutationFn: async (credentials: LoginCredentials | string) => {
      // Si credentials est une chaîne, l'adapter au format attendu
      const payload = typeof credentials === 'string' 
        ? { username: credentials } 
        : credentials;
      
      console.log('🔐 Tentative de connexion avec:', payload);
      
      // Utiliser l'endpoint correct
      const response = await api.post('/auth/register-or-login', payload);
      return response.data.data;
    },
    onSuccess: async (data) => {
      console.log('✅ Authentification réussie, sauvegarde des données');
      await AsyncStorage.setItem('@auth_token', data.token);
      
      if (data.user && data.user.id) {
        await UserIdManager.setUserId(data.user.id);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data.user));
        console.log(`🔑 Données utilisateur ${data.user.id} sauvegardées`);
      } else if (data.id) {
        await UserIdManager.setUserId(data.id);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data));
        console.log(`🔑 Données utilisateur ${data.id} sauvegardées`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['user'] });
      
      // Redirection vers la page d'accueil après connexion réussie
      console.log('🚀 Redirection vers la page d\'accueil');
      
      // Petit délai pour s'assurer que les données sont bien sauvegardées
      setTimeout(() => {
        router.replace('/(tabs)/');
      }, 100);
    },
    onError: (error) => {
      console.error('❌ Erreur lors de l\'authentification:', error);
    }
  });
};

// Hook personnalisé pour l'inscription - utiliser aussi register-or-login
export const useRegister = () => {
  const router = useRouter();
  
  return useMutation({
    mutationFn: async (credentials: RegisterCredentials) => {
      const response = await api.post('/auth/register-or-login', credentials);
      return response.data.data;
    },
    onSuccess: async (data) => {
      await AsyncStorage.setItem('@auth_token', data.token);
      
      if (data.user && data.user.id) {
        await UserIdManager.setUserId(data.user.id);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data.user));
      } else if (data.id) {
        await UserIdManager.setUserId(data.id);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data));
      }
      
      queryClient.invalidateQueries({ queryKey: ['user'] });
      
      // Redirection vers la page d'accueil après inscription réussie
      setTimeout(() => {
        router.replace('/(tabs)/');
      }, 100);
    }
  });
};

// Hook personnalisé pour la déconnexion
export const useLogout = () => {
  const router = useRouter();
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/auth/logout');
      return response.data;
    },
    onMutate: async () => {
      // Optimistic update
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@user_data');
      await AsyncStorage.removeItem('@current_user_id');
      
      // Supprimer l'ID utilisateur des headers API
      if (api.defaults.headers) {
        delete api.defaults.headers.userId;
      }
      
      queryClient.setQueryData(['user'], null);
      
      // Rediriger vers la page de login
      router.replace('/login');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });
};
