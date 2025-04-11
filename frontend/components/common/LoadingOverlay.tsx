import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

interface LoadingOverlayProps {
  message: string;
  showSpinner?: boolean;
  retryFunction?: () => void;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message, 
  showSpinner = true,
  retryFunction
}) => {
  const [waitingTime, setWaitingTime] = useState(0);
  
  // Compteur de temps d'attente pour aider à déboguer
  useEffect(() => {
    const timer = setInterval(() => {
      setWaitingTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <View style={styles.container}>
      {showSpinner && <ActivityIndicator size="large" color="#8658fe" style={styles.spinner} />}
      <Text style={styles.message}>{message}</Text>
      
      {waitingTime > 20 && retryFunction && (
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={retryFunction}
        >
          <Text style={styles.retryText}>Actualiser</Text>
        </TouchableOpacity>
      )}
      
      {waitingTime > 10 && (
        <Text style={styles.waitingTime}>
          En attente depuis {waitingTime} secondes...
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
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 15,
  },
  waitingTime: {
    fontSize: 12,
    color: '#c4a8ff',
    marginTop: 10,
    opacity: 0.7,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: 'rgba(134, 88, 254, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default LoadingOverlay;
