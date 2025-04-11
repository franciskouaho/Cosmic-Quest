import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

interface GameTimerProps {
  duration: number; // Durée totale en secondes
  startTime: number; // Timestamp du début du compteur
  onComplete?: () => void; // Callback quand le timer est terminé
  alertThreshold?: number; // Seuil en secondes pour l'alerte (défaut 5s)
}

const GameTimer: React.FC<GameTimerProps> = ({ 
  duration, 
  startTime, 
  onComplete,
  alertThreshold = 5
}) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [isFinished, setIsFinished] = useState(false);
  const [isAlertMode, setIsAlertMode] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerId = useRef<NodeJS.Timeout | null>(null);
  
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

  // Réinitialiser le timer quand startTime ou duration changent
  useEffect(() => {
    cleanupTimer();
    setTimeLeft(calculateTimeLeft());
    setIsFinished(false);
    setIsAlertMode(false);

    return cleanupTimer;
  }, [startTime, duration]);

  // Gérer le compte à rebours
  useEffect(() => {
    if (timeLeft <= 0) {
      setIsFinished(true);
      if (onComplete && !isFinished) {
        onComplete();
      }
      return;
    }
    
    // Activer le mode alerte lorsque le temps restant est inférieur au seuil
    if (timeLeft <= alertThreshold && !isAlertMode) {
      setIsAlertMode(true);
    }

    timerId.current = setTimeout(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
    }, 1000);

    return () => {
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [timeLeft, onComplete, alertThreshold, isAlertMode, isFinished]);

  // Animation de pulsation pour le mode alerte
  useEffect(() => {
    if (isAlertMode && !isFinished) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 300,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
          })
        ]),
        { iterations: -1 }
      ).start();
    } else {
      pulseAnim.setValue(1);
      pulseAnim.stopAnimation();
    }

    return () => {
      pulseAnim.stopAnimation();
    };
  }, [isAlertMode, isFinished, pulseAnim]);

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
      <LinearGradient
        colors={progressColor}
        style={[
          styles.progressBar,
          { width: `${progress}%` }
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />
      <Animated.View 
        style={[
          styles.timeDisplay,
          { transform: [{ scale: isAlertMode ? pulseAnim : 1 }] }
        ]}
      >
        <Feather name="clock" size={16} color="white" style={styles.clockIcon} />
        <Text style={[
          styles.timeText,
          isAlertMode && styles.alertText
        ]}>
          {timeLeft}s
        </Text>
      </Animated.View>
    </View>
  );
};

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
