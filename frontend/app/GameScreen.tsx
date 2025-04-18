import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GameTimer from '../components/game/GameTimer';

const GameScreen = ({ navigation, route }) => {
  const [timerProps, setTimerProps] = useState<{ duration: number; startTime: number } | null>(null);

  useEffect(() => {
    const socket = route.params.socket;

    socket.on('game:update', (data) => {
      console.log('🎮 Mise à jour du jeu reçue:', data);

      if (data.timer) {
        setTimerProps({
          duration: data.timer.duration,
          startTime: data.timer.startTime,
        });

        console.log(`⏱️ Timer reçu: ${data.timer.duration}s`);
      }
    });

    return () => {
      socket.off('game:update');
    };
  }, [route.params.socket]);

  return (
    <View style={styles.container}>
      {timerProps && (
        <View style={styles.timerWrapper}>
          <GameTimer
            duration={timerProps.duration}
            startTime={timerProps.startTime}
            onComplete={() => console.log('Temps écoulé!')}
          />
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
  },
  timerWrapper: {
    width: '90%',
    alignSelf: 'center',
    marginVertical: 10,
    zIndex: 10,
  },
});

export default GameScreen;