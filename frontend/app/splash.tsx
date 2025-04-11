import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SplashScreen, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, initialized, checkAuthState } = useAuth();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  
  // Récupérer le numéro de version depuis app.json
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ]).start();

    // Masquer le splash screen natif d'Expo une fois que notre composant est prêt
    SplashScreen.hideAsync();
  }, []);

  // Gérer la redirection après initialisation de l'authentification
  useEffect(() => {
    const redirectUser = async () => {
      if (initialized) {
        console.log('🚀 État d\'authentification initialisé');
        
        // On attend au moins 2 secondes pour le splash screen "manuel"
        const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
        
        // On vérifie l'état d'authentification encore une fois pour être sûr
        const authCheck = await checkAuthState();
        
        // Attendre que les deux promesses soient résolues
        await minDelay;
        
        if (authCheck) {
          console.log('👤 Utilisateur authentifié, redirection vers (tabs)');
          router.replace('/(tabs)');
        } else {
          console.log('👤 Utilisateur non authentifié, redirection vers login');
          router.replace('/auth/login');
        }
      }
    };
    
    redirectUser();
  }, [initialized, isAuthenticated]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1a0933', '#321a5e', '#4b277d']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <Animated.View 
        style={[
          styles.contentContainer,
          { 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {/* Logo et étoiles */}
        <View style={styles.starsContainer}>
          <Ionicons name="star" size={20} color="#FFD700" style={styles.star1} />
          <Ionicons name="star" size={12} color="#FFD700" style={styles.star2} />
          <Ionicons name="star" size={16} color="#FFD700" style={styles.star3} />
        </View>

        {/* Texte principal */}
        <Text style={styles.title}>Cosmic Quest</Text>
        <Text style={styles.subtitle}>play with friends</Text>

        {/* Planète stylisée */}
        <View style={styles.planetContainer}>
          <View style={styles.planet}>
            <View style={styles.planetRing} />
          </View>
        </View>
      </Animated.View>
      
      {/* Affichage du numéro de version en bas de l'écran */}
      <Text style={styles.versionText}>V{appVersion}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#d0a6ff',
    marginBottom: 40,
    textAlign: 'center',
  },
  starsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  star1: {
    position: 'absolute',
    top: -50,
    right: 30,
  },
  star2: {
    position: 'absolute',
    top: -20,
    left: 40,
  },
  star3: {
    position: 'absolute',
    bottom: 60,
    right: 50,
  },
  planetContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  planet: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#9c60ff',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  planetRing: {
    position: 'absolute',
    width: 120,
    height: 30,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    top: 25,
    left: -20,
    transform: [{ rotateX: '60deg' }],
  },
  versionText: {
    position: 'absolute',
    bottom: 20,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '300',
  }
});
