import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '../config/queryClient';
import api from '../config/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoginCredentials, RegisterCredentials, User } from '../types/authTypes';
import UserIdManager from '../utils/userIdManager';

// Récupérer l'utilisateur actuel depuis l'API - corriger l'endpoint qui retourne 404
const fetchCurrentUser = async (): Promise<User> => {
  try {
    // Modification du chemin /me qui semble ne pas exister
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
  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await api.post('/auth/login', credentials);
      return response.data.data;
    },
    onSuccess: async (data) => {
      await AsyncStorage.setItem('@auth_token', data.token);
      
      if (data.user && data.user.id) {
        await UserIdManager.setUserId(data.user.id);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data.user));
      }
      
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });
};

// Hook personnalisé pour l'inscription
export const useRegister = () => {
  return useMutation({
    mutationFn: async (credentials: RegisterCredentials) => {
      const response = await api.post('/auth/register', credentials);
      return response.data.data;
    },
    onSuccess: async (data) => {
      await AsyncStorage.setItem('@auth_token', data.token);
      
      if (data.user && data.user.id) {
        await UserIdManager.setUserId(data.user.id);
        await AsyncStorage.setItem('@user_data', JSON.stringify(data.user));
      }
      
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });
};

// Hook personnalisé pour la déconnexion
export const useLogout = () => {
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
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });
};
