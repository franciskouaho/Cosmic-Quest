import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import GameTimer from './GameTimer';
import socket from '../../services/socket';

const GameScreen = () => {
  const [timerProps, setTimerProps] = useState<{ duration: number; startTime: number } | null>(null);

  useEffect(() => {
    socket.on('game:update', (data) => {
      // Capturer les informations de timer si elles sont présentes
      if (data.timer) {
        setTimerProps({
          duration: data.timer.duration,
          startTime: data.timer.startTime,
        });
      }
    });

    return () => {
      socket.off('game:update');
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Timer */}
      {timerProps && (
        <GameTimer
          duration={timerProps.duration}
          startTime={timerProps.startTime}
          onComplete={() => console.log('Timer completed!')}
        />
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
});

export default GameScreen;