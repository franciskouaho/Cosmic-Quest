import { useEffect, useState } from 'react';
import SocketService from '@/services/socketService';

/**
 * Hook pour gérer l'état de connexion WebSocket
 * @param autoConnect Si true, le socket est initialisé automatiquement
 * @returns État de la connexion et fonctions
 */
export default function useSocketConnection(autoConnect: boolean = false) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialiser le socket à la demande
  const connect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Forcer l'initialisation du socket
      await SocketService.getInstanceAsync(true);
      
      setIsConnected(true);
      setIsConnecting(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsConnecting(false);
      return false;
    }
  };

  // Déconnecter le socket
  const disconnect = async () => {
    try {
      await SocketService.cleanup();
      setIsConnected(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  };

  // Si autoConnect est activé, se connecter automatiquement
  useEffect(() => {
    if (autoConnect) {
      // Activer l'initialisation automatique des sockets
      SocketService.setAutoInit(true);
      connect();
    }

    return () => {
      // Désactiver l'initialisation automatique lors du démontage
      SocketService.setAutoInit(false);
    };
  }, [autoConnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect
  };
}
