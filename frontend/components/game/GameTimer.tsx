import React, { memo } from 'react';
import { View } from 'react-native';

interface GameTimerProps {
  duration: number; 
  startTime: number; 
  onComplete?: () => void;
  alertThreshold?: number;
}

// Remplacer le timer par un composant vide
const GameTimer: React.FC<GameTimerProps> = memo(() => {
  // Composant vide - aucun timer ne sera affiché
  return <View />;
});

export default GameTimer;
