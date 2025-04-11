import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// ...existing imports...
import GameTimer from './GameTimer';

interface QuestionCardProps {
  question: string;
  targetPlayerName: string;
  phase: string;
  timer?: {
    duration: number;
    startTime: number;
  };
  // ...autres props existantes...
}

const QuestionCard: React.FC<QuestionCardProps> = ({ 
  question, 
  targetPlayerName, 
  phase,
  timer,
  // ...autres props existantes...
}) => {
  return (
    <View style={styles.container}>
      {/* Timer au début de la carte */}
      {timer && (
        <View style={styles.timerContainer}>
          <GameTimer 
            duration={timer.duration}
            startTime={timer.startTime}
          />
        </View>
      )}
      
      {/* ...existing UI components... */}
      <Text style={styles.questionText}>{question}</Text>
      {/* ...existing UI components... */}
    </View>
  );
};

const styles = StyleSheet.create({
  // ...existing styles...
  timerContainer: {
    marginBottom: 10,
    width: '100%',
  },
  // ...existing styles...
});

export default QuestionCard;
