import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Player } from '@/types/gameTypes';
import { getGameResults } from '@/services/gameService';

const { width } = Dimensions.get('window');

type PlayerScore = Player & { score: number };

export default function GameResultsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [players, setPlayers] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const fadeAnim = new Animated.Value(0);
  
  useEffect(() => {
    const fetchResults = async () => {
      try {
        if (!id || typeof id !== 'string') {
          throw new Error('ID de partie invalide');
        }
        
        const results = await getGameResults(id);
        setPlayers(results);
        
        // Démarrer l'animation de fondu
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }).start();

        // Démarrer les confettis après un court délai
        setTimeout(() => {
          setShowConfetti(true);
        }, 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [id]);
  
  const handlePlayAgain = () => {
    router.push(`/room/${id}`);
  };
  
  const handleReturnHome = () => {
    router.push('/');
  };
  
  const renderRankBadge = (rank: number) => {
    if (rank === 0) {
      return (
        <View style={[styles.rankBadge, styles.firstPlace]}>
          <FontAwesome5 name="crown" size={18} color="#FFD700" />
        </View>
      );
    } else if (rank === 1) {
      return (
        <View style={[styles.rankBadge, styles.secondPlace]}>
          <Text style={styles.rankText}>2</Text>
        </View>
      );
    } else if (rank === 2) {
      return (
        <View style={[styles.rankBadge, styles.thirdPlace]}>
          <Text style={styles.rankText}>3</Text>
        </View>
      );
    } else {
      return (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank + 1}</Text>
        </View>
      );
    }
  };
  
  const renderPlayerItem = ({ item, index }: { item: PlayerScore; index: number }) => (
    <Animated.View 
      style={[
        styles.playerCard, 
        index === 0 ? styles.winnerCard : null,
        { opacity: fadeAnim }
      ]}
    >
      {renderRankBadge(index)}
      
      <View style={styles.playerInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <Text style={styles.playerName}>{item.name}</Text>
      </View>
      
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>{item.score}</Text>
        <Text style={styles.scoreLabel}>points</Text>
      </View>
    </Animated.View>
  );
  
  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#1a0933', '#321a5e']}
          style={styles.background}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Calcul des résultats...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#1a0933', '#321a5e']}
          style={styles.background}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleReturnHome}
          >
            <Ionicons name="home" size={18} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1a0933', '#321a5e']}
        style={styles.background}
      />
      
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: width / 2, y: -10 }}
          autoStart={true}
          fadeOut={true}
          explosionSpeed={350}
          fallSpeed={3000}
        />
      )}
      
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Résultats finaux</Text>
        <Text style={styles.subtitle}>Félicitations à tous !</Text>
      </Animated.View>
      
      <View style={styles.resultsContainer}>
        <FlatList
          data={players}
          renderItem={renderPlayerItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      </View>
      
      <Animated.View style={[styles.buttonsContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handlePlayAgain}
        >
          <Text style={styles.buttonText}>Rejouer</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleReturnHome}
        >
          <Ionicons name="home" size={18} color="#ffffff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Accueil</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#b3a5d9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 20,
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  playerCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  winnerCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  firstPlace: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  secondPlace: {
    backgroundColor: 'rgba(192, 192, 192, 0.3)',
  },
  thirdPlace: {
    backgroundColor: 'rgba(205, 127, 50, 0.3)',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  playerName: {
    fontSize: 18,
    color: '#ffffff',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#b3a5d9',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 120,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#6c5ce7',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
});
