import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface LoadingOverlayProps {
  message: string;
  showSpinner?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message, 
  showSpinner = true
}) => {
  const [waitingTime, setWaitingTime] = useState(0);
  
  // Optimisation du compteur de temps d'attente
  useEffect(() => {
    let waitTimer: NodeJS.Timeout;
    
    // Ne démarrer le compteur qu'après 3 secondes
    const initialDelay = setTimeout(() => {
      waitTimer = setInterval(() => {
        setWaitingTime(prev => prev + 1);
      }, 1000);
    }, 3000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(waitTimer);
    };
  }, []);
  
  return (
    <View style={styles.container}>
      {showSpinner && <ActivityIndicator size="large" color="#8658fe" style={styles.spinner} />}
      <Text style={styles.message}>{message}</Text>
      
      {waitingTime > 5 && (
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
});

export default LoadingOverlay;
