import React, { useState, useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

interface GameTimerProps {
  duration: number; // Durée totale en secondes
  startTime: number; // Timestamp du début du compteur
  onComplete?: () => void; // Callback quand le timer est terminé
  alertThreshold?: number; // Seuil en secondes pour l'alerte (défaut 5s)
}

const GameTimer: React.FC<GameTimerProps> = memo(({ 
  duration, 
  startTime, 
  onComplete,
  alertThreshold = 5
}) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [isFinished, setIsFinished] = useState(false);
  const timerId = useRef<NodeJS.Timeout | null>(null);
  const lastStartTime = useRef(startTime);
  
  function calculateTimeLeft() {
    const elapsed = (Date.now() - startTime) / 1000;
    return Math.max(0, Math.floor(duration - elapsed));
  }

  // Nettoyer le timer lors du démontage ou du changement de startTime/duration
  const cleanupTimer = () => {
    if (timerId.current) {
      clearTimeout(timerId.current);
      timerId.current = null;
    }
  };

  // Réinitialiser le timer si startTime change
  useEffect(() => {
    if (lastStartTime.current !== startTime) {
      lastStartTime.current = startTime;
      setTimeLeft(calculateTimeLeft());
      setIsFinished(false);
    }
  }, [startTime]);

  // Gérer le compte à rebours
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsFinished(true);
      if (onComplete && !isFinished) {
        onComplete();
      }
      return;
    }

    timerId.current = setTimeout(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => {
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [timeLeft, onComplete, alertThreshold, isFinished]);

  // Calculer la progression pour la barre de progression
  const progress = Math.min(100, Math.max(0, (timeLeft / duration) * 100));
  
  // Déterminer la couleur en fonction du temps restant
  let progressColor = ['#4CAF50', '#8BC34A'];
  if (timeLeft < duration * 0.3) {
    progressColor = ['#F44336', '#FF5722']; // Rouge quand < 30% du temps reste
  } else if (timeLeft < duration * 0.6) {
    progressColor = ['#FFC107', '#FFEB3B']; // Jaune quand < 60% du temps reste
  }

  return (
    <View style={styles.timerContainer}>
      {timeLeft > 0 && (
        <>
          <LinearGradient
            colors={progressColor}
            style={[
              styles.progressBar,
              { width: `${progress}%` }
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={styles.timeDisplay}>
            <Text style={[
              styles.timeText,
              timeLeft <= alertThreshold && styles.alertText
            ]}>
              {timeLeft}s
            </Text>
          </View>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  timerContainer: {
    height: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    overflow: 'hidden',
    marginVertical: 10,
    position: 'relative',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 15,
  },
  timeDisplay: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockIcon: {
    marginRight: 5,
  },
  timeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  alertText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default GameTimer;
