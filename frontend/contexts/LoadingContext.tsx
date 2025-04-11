import React, { createContext, useState, useContext, ReactNode } from 'react';
import LoadingOverlay from '../components/common/LoadingOverlay';

interface LoadingContextType {
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  updateLoadingMessage: (message: string) => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Chargement...');

  const showLoading = (message = 'Chargement...') => {
    setLoadingMessage(message);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  const updateLoadingMessage = (message: string) => {
    setLoadingMessage(message);
  };

  return (
    <LoadingContext.Provider
      value={{
        showLoading,
        hideLoading,
        updateLoadingMessage,
        isLoading,
      }}
    >
      {children}
      {isLoading && <LoadingOverlay message={loadingMessage} />}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    // Correction de l'apostrophe qui causait l'erreur de syntaxe
    throw new Error("useLoading doit être utilisé à l'intérieur d'un LoadingProvider");
  }
  return context;
};
