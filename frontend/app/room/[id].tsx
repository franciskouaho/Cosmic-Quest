import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Alert, Clipboard, Share } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import InviteModal from '../../components/room/InviteModal';
import RulesDrawer from '../../components/room/RulesDrawer';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import SocketService from '@/services/socketService';
import { useRoom, useToggleReadyStatus, useLeaveRoom, useStartGame } from '@/hooks/useRooms';
import { useUser } from '@/hooks/useAuth';

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
  const { data: user } = useUser();

  // Utiliser le hook pour récupérer les détails de la salle
  const { data: roomData, isLoading: isLoadingRoom, error: roomError } = useRoom(id as string);

  // Utiliser les hooks de mutation
  const { mutate: toggleReady, isPending: isTogglingReady } = useToggleReadyStatus();
  const { mutate: leaveRoom, isPending: isLeavingRoom } = useLeaveRoom();
  const { mutate: startGame, isPending: isStartingGame } = useStartGame();

  const [roomName, setRoomName] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Chargement de la salle...');

  // Mettre à jour les états en fonction des données récupérées
  useEffect(() => {
    if (roomData) {
      setRoomName(roomData.name);
      setMaxPlayers(roomData.maxPlayers);
      
      // S'assurer que players existe avant de faire le mapping
      if (roomData.players && Array.isArray(roomData.players)) {
        // Convertir les joueurs au format requis
        const formattedPlayers = roomData.players.map(player => ({
          id: player.id.toString(),
          name: player.displayName || player.username,
          isHost: player.isHost,
          isReady: player.isReady,
          avatar: player.avatar || 'https://randomuser.me/api/portraits/men/32.jpg',
          level: player.level || 1
        }));
        
        setPlayers(formattedPlayers);
      } else {
        // Initialiser avec un tableau vide si players n'existe pas
        console.log('⚠️ Aucun joueur trouvé dans roomData');
        setPlayers([]);
      }
      
      // Vérifier si l'utilisateur actuel est l'hôte
      if (user) {
        setIsHost(roomData.host.id === user.id);
        
        // Trouver le statut "prêt" de l'utilisateur actuel si players existe
        if (roomData.players && Array.isArray(roomData.players)) {
          const currentPlayer = roomData.players.find(player => player.id === user.id);
          if (currentPlayer) {
            setIsReady(currentPlayer.isReady);
          }
        }
      }
    }
  }, [roomData, user]);

  useEffect(() => {
    if (id) {
      // Connexion WebSocket et rejoindre la salle
      const socket = SocketService.getInstance();
      SocketService.joinRoom(id as string);

      // Écouter les événements de la salle
      socket.on('room:update', (data) => {
        switch (data.type) {
          case 'player_joined':
            // Mettre à jour la liste des joueurs
            setPlayers(prev => [...prev, {
              id: data.player.id,
              name: data.player.displayName || data.player.username,
              isHost: false,
              isReady: false,
              avatar: data.player.avatar || 'https://randomuser.me/api/portraits/men/32.jpg',
              level: data.player.level || 1
            }]);
            break;
          
          case 'player_left':
            // Retirer le joueur de la liste
            setPlayers(prev => prev.filter(p => p.id !== data.playerId));
            break;
          
          case 'player_ready_status':
            // Mettre à jour le statut d'un joueur
            setPlayers(prev => prev.map(p => 
              p.id === data.playerId 
                ? { ...p, isReady: data.isReady }
                : p
            ));
            
            // Mettre à jour l'état local si c'est l'utilisateur actuel
            if (user && data.playerId === user.id) {
              setIsReady(data.isReady);
            }
            break;
            
          case 'game_started':
            // Rediriger vers la page de jeu
            router.push(`/game/${data.gameId}`);
            break;
        }
      });

      // Nettoyage lors du démontage
      return () => {
        SocketService.leaveRoom(id as string);
      };
    }
  }, [id, user]);

  const handleToggleReady = () => {
    if (id) {
      toggleReady({ roomCode: id as string, isReady: !isReady });
    }
  };

  const handleStartGame = () => {
    if (id) {
      startGame(id as string);
    }
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
            if (id) {
              leaveRoom(id as string);
            }
          },
        },
      ]
    );
  };

  const handleInviteFriend = () => {
    setInviteModalVisible(true);
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

  // Afficher le loading pendant chargement ou opérations
  const isLoading = isLoadingRoom || isTogglingReady || isLeavingRoom || isStartingGame;

  // Si erreur lors de la récupération des données
  if (roomError) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="light" />
        <LinearGradient colors={['#1a0933', '#321a5e']} style={styles.background} />
        <Text style={styles.errorText}>Salle non trouvée ou inaccessible</Text>
        <TouchableOpacity style={styles.backToHomeButton} onPress={() => router.replace('/(tabs)/')}>
          <Text style={styles.backToHomeText}>Retourner à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      
      {/* Notre composant de loading pour les opérations */}
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      
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
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="rocket-launch" size={24} color="white" />
              <Text style={styles.actionButtonText}>Lancer la partie</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButton, isReady ? styles.notReadyButton : styles.readyButton]}
              onPress={handleToggleReady}
              disabled={isLoading}
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  backToHomeButton: {
    backgroundColor: 'rgba(93, 109, 255, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backToHomeText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
