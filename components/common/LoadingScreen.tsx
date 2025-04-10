import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "Chargement..." }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#694ED6" />
      <Text style={styles.message}>{message}</Text>
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
  message: {
    marginTop: 20,
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
  },
});

export default LoadingScreen;
