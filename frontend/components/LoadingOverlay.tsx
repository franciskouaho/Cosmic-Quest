import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface LoadingOverlayProps {
  message?: string;
  showSpinner?: boolean;
  retryFunction?: () => void;
  errorMessage?: string;
  isRetrying?: boolean;
  showRetryButton?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Chargement...',
  showSpinner = true,
  retryFunction,
  errorMessage,
  isRetrying = false,
  showRetryButton = true,
}) => {
  const [showRetry, setShowRetry] = useState(false);
  const [dots, setDots] = useState('');

  // Animation des points pour montrer l'activité
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    // Après 10 secondes, afficher le bouton de réessai si une fonction de réessai est fournie
    const retryTimer = setTimeout(() => {
      if (retryFunction && showRetryButton) {
        setShowRetry(true);
      }
    }, 10000);

    return () => {
      clearInterval(timer);
      clearTimeout(retryTimer);
    };
  }, [retryFunction, showRetryButton]);

  return (
    <View style={styles.container}>
      {showSpinner && (
        <ActivityIndicator size="large" color="#5D6DFF" style={styles.spinner} />
      )}
      
      <Text style={styles.message}>{message}{dots}</Text>
      
      {errorMessage && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#ff6b6b" />
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        </View>
      )}
      
      {showRetry && retryFunction && (
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={retryFunction}
          disabled={isRetrying}
        >
          <MaterialCommunityIcons name="refresh" size={20} color="white" />
          <Text style={styles.retryText}>
            {isRetrying ? 'Nouvelle tentative...' : 'Réessayer'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 9, 51, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  spinner: {
    marginBottom: 20,
  },
  message: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 30,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 15,
    marginHorizontal: 30,
  },
  errorMessage: {
    color: '#ff6b6b',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(93, 109, 255, 0.5)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  retryText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
  },
});

export default LoadingOverlay;
