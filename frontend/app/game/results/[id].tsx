import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import Confetti from 'react-native-confetti';
import { Player } from '@/types/gameTypes';

type PlayerScore = Player & { score: number };

export default function GameResultsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [players, setPlayers] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [confettiRef, setConfettiRef] = useState<any>(null);
  
  useEffect(() => {
    const mockPlayers: PlayerScore[] = [
      { id: '1', name: 'Francis', avatar: 'avatar1', isReady: true, score: 3 },
      { id: '2', name: 'Sophie', avatar: 'avatar2', isReady: true, score: 5 },
      { id: '3', name: 'Thomas', avatar: 'avatar3', isReady: true, score: 2 },
      { id: '4', name: 'Emma', avatar: 'avatar4', isReady: true, score: 4 },
    ];
    
    // Trier les joueurs par score (décroissant)
    mockPlayers.sort((a, b) => b.score - a.score);
    
    setPlayers(mockPlayers);
    setLoading(false);
    
    // Version simplifiée avec les confettis pour le gagnant
    if (confettiRef) {
      confettiRef.startConfetti();
    }
    
    // Arrêter les confettis lors du nettoyage
    return () => {
      if (confettiRef) {
        confettiRef.stopConfetti();
      }
    };
  }, [confettiRef]);
  
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
    <View style={[
      styles.playerCard, 
      index === 0 ? styles.winnerCard : null
    ]}>
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
    </View>
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
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1a0933', '#321a5e']}
        style={styles.background}
      />
      
      <Confetti ref={ref => setConfettiRef(ref)} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Résultats finaux</Text>
        <Text style={styles.subtitle}>Félicitations à tous !</Text>
      </View>
      
      <View style={styles.resultsContainer}>
        <FlatList
          data={players}
          renderItem={renderPlayerItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      </View>
      
      <View style={styles.buttonsContainer}>
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
      </View>
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
    backgroundColor: '#694ED6',
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
    fontWeight: '600',
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
    fontSize: 14,
    color: '#b3a5d9',
  },
  buttonsContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#694ED6',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
});
