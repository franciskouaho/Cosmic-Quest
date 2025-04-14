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
  const [waitTime, setWaitTime] = useState(0);

  // Animation des points pour montrer l'activité
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    // Compter le temps d'attente pour montrer automatiquement le bouton après un certain délai
    const waitTimer = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);

    // Après un délai plus court (5 secondes), afficher le bouton de rafraîchissement
    const retryTimer = setTimeout(() => {
      if (retryFunction && showRetryButton) {
        setShowRetry(true);
      }
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(waitTimer);
      clearTimeout(retryTimer);
    };
  }, [retryFunction, showRetryButton]);

  return (
    <View style={styles.container}>
      {showSpinner && (
        <ActivityIndicator size="large" color="#5D6DFF" style={styles.spinner} />
      )}
      
      <Text style={styles.message}>{message}{dots}</Text>
      
      {waitTime > 10 && (
        <Text style={styles.waitTimeText}>En attente depuis {waitTime} secondes...</Text>
      )}
      
      {errorMessage && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#ff6b6b" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
      
      {(showRetry || waitTime > 15) && retryFunction && (
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={retryFunction}
          disabled={isRetrying}
        >
          <Text style={styles.retryButtonText}>
            {isRetrying ? 'Tentative en cours...' : 'Rafraîchir'}
          </Text>
        </TouchableOpacity>
      )}

      {waitTime > 30 && (
        <Text style={styles.tipText}>
          Astuce: Si l'attente persiste, essayez de quitter et rejoindre la partie.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  spinner: {
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  waitTimeText: {
    fontSize: 14,
    color: '#b3a5d9',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    color: '#ff6b6b',
    marginLeft: 10,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#5D6DFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  tipText: {
    fontSize: 14,
    color: '#b3a5d9',
    marginTop: 20,
    textAlign: 'center',
  },
});

export default LoadingOverlay;
