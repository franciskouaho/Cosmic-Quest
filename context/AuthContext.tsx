import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (username: string) => Promise<void>;
  signOut: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
}

// Création du contexte avec des valeurs par défaut
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  signIn: async () => {},
  signOut: () => {},
  updateUser: async () => {},
});

// Hook personnalisé pour utiliser le contexte d'authentification
export const useAuth = () => useContext(AuthContext);

// Fournisseur du contexte d'authentification
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Suppression complète de la gestion d'état de chargement pendant l'initialisation
    const checkUserSession = async () => {
      try {
        // On élimine l'état de chargement qui cause des problèmes
        const storedUsername = await AsyncStorage.getItem('username');
        if (storedUsername) {
          setUser({
            id: Math.random().toString(36).substring(2, 9),
            name: storedUsername,
            avatar: `avatar${Math.floor(Math.random() * 5) + 1}`,
          });
        }
      } catch (err) {
        console.error("Erreur lors de la vérification de la session:", err);
      } finally {
        // On désactive immédiatement le chargement
        setIsLoading(false);
      }
    };

    // On désactive immédiatement le chargement dans tous les cas
    // Cela garantit que l'application ne se bloque jamais sur l'écran de chargement
    setTimeout(() => setIsLoading(false), 100);
    
    // On lance la vérification de session mais sans bloquer l'interface
    checkUserSession();
  }, []);

  // Fonction de connexion simplifiée avec seulement un pseudo
  const signIn = async (username: string) => {
    if (!username.trim()) {
      throw new Error("Le nom d'utilisateur ne peut pas être vide");
    }

    try {
      // Créer un utilisateur avec le pseudo fourni
      const newUser = {
        id: Math.random().toString(36).substring(2, 9),
        name: username,
        avatar: `avatar${Math.floor(Math.random() * 5) + 1}`,
      };

      // Mettre à jour l'état utilisateur immédiatement pour éviter tout délai
      setUser(newUser);

      // Tenter d'enregistrer en arrière-plan sans bloquer
      AsyncStorage.setItem('username', username.trim())
        .catch(e => console.error("Erreur lors de l'enregistrement du nom d'utilisateur:", e));
    } catch (error) {
      console.error('Erreur de connexion:', error);
      throw error;
    }
  };

  // Fonction de déconnexion
  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('username');
      setUser(null);
    } catch (e) {
      console.error('Erreur lors de la déconnexion:', e);
    }
  };

  // Fonction de mise à jour du profil utilisateur
  const updateUser = async (userData: Partial<User>) => {
    setIsLoading(true);
    try {
      // Mettre à jour l'utilisateur en mémoire
      const updatedUser = { ...user, ...userData } as User;

      // Mettre à jour l'état utilisateur
      setUser(updatedUser);

      // Si le nom est modifié, mettre à jour également le stockage local
      if (userData.name) {
        try {
          await AsyncStorage.setItem('username', userData.name);
        } catch (e) {
          console.warn('Impossible de mettre à jour le nom d\'utilisateur dans le stockage local:', e);
        }
      }
    } catch (error) {
      console.error('Erreur de mise à jour du profil:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
