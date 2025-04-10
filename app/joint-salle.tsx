import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import BottomTabBar from '../components/BottomTabBar';
import { useRouter } from 'expo-router';

export default function JointSalle() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [recentRooms, setRecentRooms] = useState([
    { id: '1', name: 'Salle de Francis', players: 3, maxPlayers: 5, isPrivate: false },
    { id: '2', name: 'Tournoi Stellaire', players: 4, maxPlayers: 4, isPrivate: true },
    { id: '3', name: 'Débutants Bienvenus', players: 2, maxPlayers: 6, isPrivate: false },
  ]);

  const handleJoinRoom = (code = roomCode) => {
    // Logique pour rejoindre une salle avec le code fourni
    console.log(`Rejoindre la salle avec le code: ${code}`);
    
    // Vérifie si le code est valide
    if (code) {
      // Afficher une alerte pour indiquer que la connexion est en cours
      Alert.alert("Connexion en cours", `Tentative de connexion à la salle ${code}...`);
      
      // Navigation vers la page de la salle avec l'ID
      setTimeout(() => {
        router.push(`/room/${code}`);
      }, 500);
    }
  };

  const handleScanQR = () => {
    // Logique pour ouvrir le scanner QR code
    console.log('Ouverture du scanner QR code');
    Alert.alert("Scanner QR", "Ouverture du scanner de code QR...");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Fond dégradé */}
      <LinearGradient
        colors={['#1a0933', '#321a5e']}
        style={styles.background}
      />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rejoindre une partie</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Code de la salle</Text>
          <View style={styles.codeInputArea}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={roomCode}
                onChangeText={setRoomCode}
                placeholder="Entrez le code à 6 chiffres"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="number-pad"
                maxLength={6}
                autoCapitalize="characters"
              />
            </View>
            
            <View style={styles.buttonsContainer}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.qrButton]}
                onPress={handleScanQR}
                activeOpacity={0.7}
              >
                <Ionicons name="qr-code" size={22} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.joinButton, !roomCode ? styles.joinButtonDisabled : null]}
                onPress={() => handleJoinRoom()}
                disabled={!roomCode}
                activeOpacity={0.8}
              >
                <Text style={styles.joinButtonText}>Rejoindre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.orDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.orText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Parties récentes</Text>
          {recentRooms.map(room => (
            <TouchableOpacity 
              key={room.id}
              style={styles.roomCard}
              onPress={() => handleJoinRoom(room.id)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(93, 109, 255, 0.2)', 'rgba(93, 109, 255, 0.05)']}
                style={styles.roomCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <View style={styles.roomDetails}>
                    <View style={styles.playerCount}>
                      <FontAwesome5 name="user-astronaut" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.playerCountText}>{room.players}/{room.maxPlayers}</Text>
                    </View>
                    {room.isPrivate && (
                      <View style={styles.privateTag}>
                        <MaterialCommunityIcons name="lock" size={14} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.privateTagText}>Privée</Text>
                      </View>
                    )}
                  </View>
                </View>
                <MaterialCommunityIcons 
                  name="arrow-right-circle" 
                  size={28} 
                  color="#5D6DFF" 
                  style={styles.joinIcon} 
                />
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomTabBarPlaceholder} />
      </ScrollView>
      
      <BottomTabBar />
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  inputSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  codeInputArea: {
    marginBottom: 10,
  },
  inputContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 10,
  },
  input: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: 'white',
    letterSpacing: 4,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  qrButton: {
    backgroundColor: 'rgba(93, 109, 255, 0.7)',
    paddingVertical: 15,
    paddingHorizontal: 15,
    width: '15%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButton: {
    backgroundColor: '#5D6DFF',
    paddingVertical: 15,
    paddingHorizontal: 25,
    width: '80%',
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: 'rgba(93, 109, 255, 0.5)',
  },
  joinButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  orText: {
    color: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 15,
    fontSize: 16,
  },
  recentSection: {
    marginBottom: 30,
  },
  roomCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(93, 109, 255, 0.3)',
  },
  roomCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  roomDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  playerCountText: {
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 5,
    fontSize: 12,
  },
  privateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(156, 39, 176, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  privateTagText: {
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 5,
    fontSize: 12,
  },
  joinIcon: {
    marginLeft: 10,
  },
  createRoomSection: {
    marginBottom: 50,
  },
  createRoomButton: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(93, 109, 255, 0.5)',
  },
  createRoomGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  createRoomText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  bottomTabBarPlaceholder: {
    height: 70, // hauteur approximative de la BottomTabBar
  },
});
