import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GameTimer from './GameTimer';

type WaitingPhaseProps = {
  message?: string;
  timer?: {
    duration: number;
    startTime: number;
  } | null;
};

const WaitingPhase: React.FC<WaitingPhaseProps> = ({ 
  message = "En attente des autres joueurs...",
  timer 
}) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(105, 78, 214, 0.3)', 'rgba(105, 78, 214, 0.1)']}
        style={styles.content}
      >
        <ActivityIndicator size="large" color="#694ED6" style={styles.spinner} />
        <Text style={styles.message}>{message}</Text>
        {timer && (
          <View style={styles.timerContainer}>
            <GameTimer 
              duration={timer.duration}
              startTime={timer.startTime}
            />
          </View>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 15,
  },
  message: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  timerContainer: {
    width: '100%',
  },
});

export default WaitingPhase;
