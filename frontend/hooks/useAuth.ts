import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, User, checkTokenValidity } from '@/services/queries/auth';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import axios from '@/config/axios'; // Utiliser axios au lieu de api

// Hook pour rafraîchir le token en cas de problème
export function useTokenRefresh() {
  console.log('🔄 useTokenRefresh: Initialisation du hook');
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      console.log('🔄 useTokenRefresh: Tentative de rafraîchissement du token');
      
      // Récupérer les informations utilisateur locales
      const userData = await AsyncStorage.getItem('@user_data');
      if (!userData) {
        throw new Error('Aucune donnée utilisateur disponible');
      }
      
      const user = JSON.parse(userData);
      
      // Tenter de se reconnecter avec le nom d'utilisateur existant
      return authService.registerOrLogin(user.username);
    },
    onSuccess: (data) => {
      console.log('✅ useTokenRefresh: Token rafraîchi avec succès');
      // Mettre à jour le cache avec les nouvelles données utilisateur
      queryClient.setQueryData(['user'], data);
    },
    onError: (error) => {
      console.error('❌ useTokenRefresh: Échec du rafraîchissement du token', error);
    }
  });
}

// Hook pour récupérer l'utilisateur connecté actuel
export function useUser() {
  console.log('👤 useUser: Initialisation du hook');
  const refreshToken = useTokenRefresh();
  
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      console.log('👤 useUser: Récupération des données utilisateur');
      try {
        // Vérifier si le token est valide
        const isValid = await checkTokenValidity();
        if (!isValid) {
          console.log('⚠️ useUser: Token invalide ou expiré, tentative de rafraîchissement');
          await refreshToken.mutateAsync();
        }
        
        const user = await authService.getCurrentUser();
        console.log('👤 useUser:', user ? `Utilisateur ${user.username} trouvé` : 'Aucun utilisateur trouvé');
        return user;
      } catch (error) {
        console.error('👤 useUser: Erreur lors de la récupération de l\'utilisateur', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - rafraîchir plus souvent pour éviter les problèmes de token
    onError: (error) => {
      console.error('👤 useUser: Erreur lors de la récupération de l\'utilisateur', error);
    }
  });
}

// Hook pour se connecter ou s'inscrire
export function useLogin() {
  console.log('👤 useLogin: Initialisation du hook');
  const router = useRouter();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (username: string) => {
      console.log('👤 useLogin: Tentative de connexion/inscription pour', username);
      try {
        const userData = await authService.registerOrLogin(username);
        console.log('👤 useLogin: Réponse reçue:', userData);
        
        // Les données utilisateur sont déjà formatées par authService.registerOrLogin
        if (userData && userData.token) {
          console.log('👤 useLogin: Stockage des données utilisateur');
          
          // Mettre à jour le cache avec les données utilisateur
          queryClient.setQueryData(['user'], userData);
          console.log('👤 useLogin: Cache mis à jour avec les données utilisateur');
          
          return userData;
        }
        console.error('👤 useLogin: Données utilisateur invalides', userData);
        throw new Error('Données utilisateur invalides');
      } catch (error) {
        console.error('👤 useLogin: Erreur', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('👤 useLogin: Connexion réussie, redirection vers l\'accueil');
      router.replace('/(tabs)/');
    },
    onError: (error) => {
      console.error('👤 useLogin: Erreur lors de la connexion', error);
      Alert.alert(
        'Erreur de connexion',
        'Impossible de se connecter. Veuillez vérifier votre nom d\'utilisateur et réessayer.'
      );
    }
  });
}

// Hook pour la déconnexion
export function useLogout() {
  console.log('👤 useLogout: Initialisation du hook');
  const router = useRouter();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      console.log('👤 useLogout: Tentative de déconnexion');
      return authService.logout();
    },
    onSuccess: () => {
      console.log('👤 useLogout: Déconnexion réussie');
      
      // Réinitialiser le cache
      queryClient.clear();
      
      // Rediriger vers la page de connexion
      console.log('👤 useLogout: Redirection vers la page de connexion');
      router.replace('/auth/login');
    },
    onError: (error) => {
      console.error('👤 useLogout: Erreur lors de la déconnexion', error);
      Alert.alert(
        'Erreur',
        'Impossible de se déconnecter. Veuillez réessayer.'
      );
    }
  });
}

// Hook pour vérifier l'état d'authentification
export function useAuth() {
  console.log('👤 useAuth: Initialisation du hook');
  const { data: user, isLoading, error } = useUser();
  
  const checkAuth = async () => {
    console.log('👤 useAuth: Vérification de l\'authentification');
    return authService.isAuthenticated();
  };
  
  return {
    user,
    isLoading,
    error,
    checkAuth,
    isAuthenticated: !!user,
  };
}
