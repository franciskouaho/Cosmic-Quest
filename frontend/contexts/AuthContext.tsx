"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { useLogin as useLoginHook, useLogout as useLogoutHook, useUser as useUserHook } from "@/hooks/useAuth";
import { User } from "@/services/queries/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storeUserIdInApiHeaders } from '@/config/axios';

// Interface du contexte d'authentification
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSigningIn: boolean;
  signIn: (username: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuthState: () => Promise<boolean>;
  initialized: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading: isUserLoading, refetch } = useUserHook();
  const loginMutation = useLoginHook();
  const logoutMutation = useLogoutHook();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Vérifier l'état d'authentification au démarrage
  useEffect(() => {
    checkAuthState();
  }, []);

  // Marquer comme initialisé lorsque le chargement initial est terminé
  useEffect(() => {
    if (!isUserLoading) {
      setInitialized(true);
    }
  }, [isUserLoading]);

  // Fonction pour vérifier l'état d'authentification
  const checkAuthState = async () => {
    console.log("🔍 Vérification de l'état d'authentification");
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const hasAuth = !!token;
      
      if (hasAuth && !user) {
        console.log('🔄 Token présent, actualisation des données utilisateur');
        await refetch();
      }
      
      console.log(`🔒 État d'authentification: ${hasAuth ? 'Authentifié' : 'Non authentifié'}`);
      return hasAuth;
    } catch (error) {
      console.error("❌ Erreur lors de la vérification de l'authentification", error);
      return false;
    }
  };

  // Fonction de connexion
  const signIn = async (username: string) => {
    console.log('🔐 Tentative de connexion avec', username);
    setIsSigningIn(true);
    try {
      const userData = await loginMutation.mutateAsync(username);
      
      // Stockage du token après connexion réussie
      if (userData && userData.token) {
        await AsyncStorage.setItem('@auth_token', userData.token);
        console.log('🔑 Token stocké après connexion');
      }

      // Stocker l'ID utilisateur dans les en-têtes API
      await storeUserIdInApiHeaders();
      
      await refetch(); // Actualiser les données utilisateur après connexion
      console.log('✅ Connexion réussie');
      return;
    } catch (error) {
      console.error('❌ Erreur lors de la connexion', error);
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  // Fonction de déconnexion
  const signOut = async () => {
    console.log('🔐 Tentative de déconnexion');
    setIsSigningIn(true);
    try {
      // Déconnexion via le service d'authentification
      await logoutMutation.mutateAsync();
      
      // Supprimer le token de stockage local
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@user_data');
      
      console.log("✅ Déconnexion réussie");
    } catch (error) {
      console.error("❌ Erreur lors de la déconnexion:", error);
      
      // Même en cas d'erreur, on supprime le token local pour assurer la déconnexion
      await AsyncStorage.removeItem('@auth_token');
      await AsyncStorage.removeItem('@user_data');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isUserLoading,
        isAuthenticated: !!user,
        isSigningIn,
        signIn,
        signOut,
        checkAuthState,
        initialized
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
