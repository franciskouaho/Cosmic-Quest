import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Chargement en cours...' }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Animation de rotation continue
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Animation de pulsation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(26, 9, 51, 0.9)', 'rgba(50, 26, 94, 0.95)']}
        style={styles.background}
      />
      
      <Animated.View 
        style={[
          styles.iconContainer, 
          { 
            transform: [
              { rotate: rotation },
              { scale: scaleAnim }
            ] 
          }
        ]}
      >
        <LinearGradient
          colors={['#694ED6', '#9270FF']}
          style={styles.iconGradient}
        >
          <MaterialCommunityIcons name="rocket" size={40} color="white" />
        </LinearGradient>
      </Animated.View>
      
      <View style={styles.messageContainer}>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.dotsContainer}>
          <AnimatedDots />
        </View>
      </View>
    </View>
  );
};

// Composant pour les points d'animation
const AnimatedDots = () => {
  const opacityAnim1 = useRef(new Animated.Value(0.3)).current;
  const opacityAnim2 = useRef(new Animated.Value(0.3)).current;
  const opacityAnim3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Animation séquentielle pour les trois points
    const animateDots = () => {
      Animated.sequence([
        // Premier point
        Animated.timing(opacityAnim1, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Deuxième point
        Animated.timing(opacityAnim2, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Troisième point
        Animated.timing(opacityAnim3, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Réinitialisation
        Animated.parallel([
          Animated.timing(opacityAnim1, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim2, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim3, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => animateDots());
    };

    animateDots();
  }, []);

  return (
    <View style={styles.dots}>
      <Animated.Text style={[styles.dot, { opacity: opacityAnim1 }]}>.</Animated.Text>
      <Animated.Text style={[styles.dot, { opacity: opacityAnim2 }]}>.</Animated.Text>
      <Animated.Text style={[styles.dot, { opacity: opacityAnim3 }]}>.</Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  iconContainer: {
    marginBottom: 20,
    borderRadius: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  iconGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  message: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dotsContainer: {
    marginLeft: 2,
    height: 20,
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
  },
  dot: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: -10,
  },
});

export default LoadingOverlay;
