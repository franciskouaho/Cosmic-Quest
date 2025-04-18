import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface LoadingOverlayProps {
  message?: string;
  showSpinner?: boolean;
  errorMessage?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'Chargement...',
  showSpinner = true,
  errorMessage,
}) => {
  const [dots, setDots] = useState('');

  // Animation des points pour montrer l'activité
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <View style={styles.container}>
      {showSpinner && (
        <ActivityIndicator size="large" color="#5D6DFF" style={styles.spinner} />
      )}
      
      <Text style={styles.message}>{message}{dots}</Text>
      
      {errorMessage && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#ff6b6b" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
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
  }
});

export default LoadingOverlay;
