import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Alert, Clipboard, Share } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import InviteModal from '../../components/room/InviteModal';
import RulesDrawer from '../../components/room/RulesDrawer';
import LoadingOverlay from '../../components/common/LoadingOverlay';

// Type pour les joueurs
type Player = {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  avatar: string;
  level: number;
};

export default function Room() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [roomName, setRoomName] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([
    { 
      id: '1', 
      name: 'Francis', 
      isHost: true, 
      isReady: true, 
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      level: 42
    },
    { 
      id: '2', 
      name: 'Sophia', 
      isHost: false, 
      isReady: true, 
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      level: 38
    },
    { 
      id: '3', 
      name: 'Alex', 
      isHost: false, 
      isReady: true, 
      avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
      level: 15
    },
    { 
      id: '4', 
      name: 'Luna', 
      isHost: false, 
      isReady: true, 
      avatar: 'https://randomuser.me/api/portraits/women/33.jpg',
      level: 27
    },
  ]);
  const [isReady, setIsReady] = useState(false);
  const [isHost] = useState(true); // Normalement, cette valeur proviendrait du backend
  const maxPlayers = 6;
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Chargement de la salle...');
  const [buttonLoading, setButtonLoading] = useState(false); // État pour les boutons

  // Simuler le chargement des données de la salle à partir de l'ID
  useEffect(() => {
    if (id) {
      setIsLoading(true);
      setLoadingMessage('Chargement des détails de la salle...');
      
      // Ici, vous feriez normalement un appel API pour obtenir les détails de la salle
      console.log(`Chargement des détails de la salle ${id}`);
      
      // Simulons des données différentes selon l'ID
      if (id === '1') {
        setRoomName('Salle de Francis');
      } else if (id === '2') {
        setRoomName('Tournoi Stellaire');
      } else if (id === '3') {
        setRoomName('Débutants Bienvenus');
      } else {
        setRoomName(`Salle #${id}`);
      }
      
      // Simuler un délai de chargement pour montrer notre beau composant
      setTimeout(() => {
        setIsLoading(false);
      }, 1500);
    }
  }, [id]);

  const handleToggleReady = () => {
    setButtonLoading(true);
    setLoadingMessage('Mise à jour du statut...');
    
    // Simulons une requête réseau
    setTimeout(() => {
      setIsReady(!isReady);
      setButtonLoading(false);
    }, 800);
  };

  const handleStartGame = () => {
    setIsLoading(true);
    setLoadingMessage('Préparation de la partie...');
    
    // Simuler un temps de chargement avant la redirection
    setTimeout(() => {
      router.push(`/game/${id}`);
    }, 1500);
  };

  const handleLeaveRoom = () => {
    Alert.alert(
      'Quitter la salle',
      'Êtes-vous sûr de vouloir quitter cette salle ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: () => {
            setIsLoading(true);
            setLoadingMessage('Retour au menu principal...');
            setTimeout(() => {
              router.back();
            }, 800);
          },
        },
      ]
    );
  };

  const handleInviteFriend = () => {
    setButtonLoading(true);
    setLoadingMessage('Génération du QR code...');
    
    // Simulons une requête réseau pour générer le code
    setTimeout(() => {
      setButtonLoading(false);
      setInviteModalVisible(true);
    }, 600);
  };

  const handleCopyCode = () => {
    Clipboard.setString(id as string);
    Alert.alert('Code copié', 'Le code de la salle a été copié dans le presse-papiers');
  };

  const handleShareCode = async () => {
    try {
      const result = await Share.share({
        message: `Rejoins-moi dans Cosmic Quest ! Utilise ce code pour me rejoindre: ${id}`,
        url: `cosmic-quest://room/${id}`,
        title: 'Invitation Cosmic Quest',
      });
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with activity type of', result.activityType);
        } else {
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
      setInviteModalVisible(false);
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur s\'est produite lors du partage');
    }
  };

  const showRules = () => {
    setRulesVisible(true);
  };

  const hideRules = () => {
    setRulesVisible(false);
  };

  const renderPlayerItem = ({ item }: { item: Player }) => (
    <View style={styles.playerCard}>
      <LinearGradient
        colors={item.isReady ? ['rgba(76, 175, 80, 0.2)', 'rgba(76, 175, 80, 0.05)'] : ['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.05)']}
        style={styles.playerCardGradient}
      >
        <Image 
          source={{ uri: item.avatar }} 
          style={styles.playerAvatar} 
        />
        
        <View style={styles.playerInfo}>
          <Text style={styles.playerName}>
            {item.name} 
            {item.isHost && <Text style={styles.hostTag}> (Hôte)</Text>}
          </Text>
          <Text style={styles.playerLevel}>Niveau {item.level}</Text>
        </View>
        
        <View style={[styles.statusIndicator, item.isReady ? styles.readyStatus : styles.notReadyStatus]}>
          <Text style={styles.statusText}>{item.isReady ? 'Prêt' : 'En attente'}</Text>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1a0933', '#321a5e']}
        style={styles.background}
      />
      
      {/* Notre composant de loading pour les opérations globales */}
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      
      {/* Notre composant de loading pour les actions sur les boutons */}
      {buttonLoading && <LoadingOverlay message={loadingMessage} />}
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleLeaveRoom}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>{roomName}</Text>
          <View style={styles.roomInfoDetails}>
            <View style={styles.playersCount}>
              <FontAwesome5 name="user-astronaut" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.playersCountText}>{players.length}/{maxPlayers}</Text>
            </View>
            
            <TouchableOpacity style={styles.roomCodeBadge} onPress={handleCopyCode}>
              <Text style={styles.roomCodeText}>Code: {id}</Text>
              <MaterialCommunityIcons name="content-copy" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.inviteButton} onPress={handleInviteFriend}>
            <Ionicons name="qr-code" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Room content */}
      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Joueurs</Text>
          <TouchableOpacity style={styles.helpButton} onPress={showRules}>
            <Ionicons name="help-circle" size={22} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={players}
          renderItem={renderPlayerItem}
          keyExtractor={item => item.id}
          style={styles.playersList}
          contentContainerStyle={styles.playersListContent}
        />
        
        {/* Room actions */}
        <View style={styles.actionsContainer}>
          {isHost ? (
            <TouchableOpacity 
              style={[styles.actionButton, styles.startGameButton]}
              onPress={handleStartGame}
              disabled={isLoading || buttonLoading}
            >
              <MaterialCommunityIcons name="rocket-launch" size={24} color="white" />
              <Text style={styles.actionButtonText}>Lancer la partie</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButton, isReady ? styles.notReadyButton : styles.readyButton]}
              onPress={handleToggleReady}
              disabled={isLoading || buttonLoading}
            >
              {isReady ? (
                <>
                  <MaterialCommunityIcons name="close-circle" size={24} color="white" />
                  <Text style={styles.actionButtonText}>Annuler</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle" size={24} color="white" />
                  <Text style={styles.actionButtonText}>Je suis prêt</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Modal d'invitation */}
      <InviteModal 
        visible={inviteModalVisible}
        roomId={id as string}
        onClose={() => setInviteModalVisible(false)}
        onCopyCode={handleCopyCode}
        onShareCode={handleShareCode}
      />
      
      {/* Drawer des règles */}
      <RulesDrawer 
        visible={rulesVisible}
        onClose={hideRules}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomInfo: {
    flex: 1,
    alignItems: 'center',
  },
  roomName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  roomInfoDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  playersCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  playersCountText: {
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 5,
    fontSize: 12,
  },
  roomCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(93, 109, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
    marginLeft: 8,
  },
  roomCodeText: {
    color: 'rgba(255,255,255,0.8)',
    marginRight: 5,
    fontSize: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(93, 109, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 0.5,
  },
  helpButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playersList: {
    flex: 1,
  },
  playersListContent: {
    paddingBottom: 20,
  },
  playerCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(93, 109, 255, 0.3)',
  },
  playerCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  playerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  hostTag: {
    color: '#FFC107',
    fontWeight: 'normal',
  },
  playerLevel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 10,
  },
  readyStatus: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  notReadyStatus: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  actionsContainer: {
    paddingVertical: 20,
    marginBottom: 70, // Espace pour la BottomTabBar
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
  },
  readyButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  notReadyButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
  },
  startGameButton: {
    backgroundColor: 'rgba(93, 109, 255, 0.8)',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
});
