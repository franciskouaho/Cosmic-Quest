import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Alert, Clipboard, Share } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import InviteModal from '@/components/room/InviteModal';
import RulesDrawer from '@/components/room/RulesDrawer';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import { useRoom, useToggleReadyStatus, useLeaveRoom, useStartGame } from '@/hooks/useRooms';
import { useUser } from '@/hooks/useAuth';
import api from '@/config/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocketService from '@/services/socketService';

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
  const [redirectingToGame, setRedirectingToGame] = useState<string | null>(null);

  // Mettre à jour les états en fonction des données récupérées
  useEffect(() => {
    if (roomData) {
      setRoomName(roomData.name);
      setMaxPlayers(roomData.maxPlayers);
      
      // S'assurer que players existe avant de faire le mapping
      if (roomData.players && Array.isArray(roomData.players)) {
        // Convertir les joueurs au format requis
        const formattedPlayers = roomData.players.map(player => ({
          id: String(player.id), // S'assurer que l'ID est une chaîne
          name: player.displayName || player.username,
          isHost: player.id === roomData.host.id, // Correction ici pour identifier l'hôte correctement
          isReady: player.isHost || player.isReady, // L'hôte est toujours prêt
          avatar: player.avatar || 'https://randomuser.me/api/portraits/men/32.jpg',
          level: player.level || 1
        }));
        
        setPlayers(formattedPlayers);
      } else {
        console.log('⚠️ Aucun joueur trouvé dans roomData');
        setPlayers([]);
      }
      
      // Vérifier si l'utilisateur actuel est l'hôte
      if (user) {
        // Utiliser l'ID de l'hôte depuis roomData.host
        setIsHost(roomData.host.id === user.id);
        
        // Trouver le statut "prêt" de l'utilisateur actuel si players existe
        if (roomData.players && Array.isArray(roomData.players)) {
          const currentPlayer = roomData.players.find(player => player.id === user.id);
          if (currentPlayer) {
            // Si l'utilisateur est l'hôte, il est toujours prêt
            setIsReady(currentPlayer.isHost || currentPlayer.isReady);
          }
        }
      }
    }
  }, [roomData, user]);

  useEffect(() => {
    if (user && user.id) {
      // Définir l'ID utilisateur dans les headers API
      api.defaults.headers.userId = user.id;
      console.log(`👤 ID utilisateur ${user.id} défini dans les headers API`);
      
      // Sauvegarder l'ID utilisateur dans AsyncStorage pour y accéder ailleurs
      AsyncStorage.setItem('@current_user_id', String(user.id))
        .then(() => console.log('✅ ID utilisateur sauvegardé dans AsyncStorage'))
        .catch(err => console.error('❌ Erreur lors de la sauvegarde de l\'ID utilisateur:', err));
    }
  }, [user]);

  useEffect(() => {
    if (id) {
      // Initialiser une fonction asynchrone pour gérer la connexion WebSocket
      const setupWebSocket = async () => {
        try {
          console.log(`🔌 Configuration de la connexion WebSocket pour la salle ${id}`);
          
          // Activer l'initialisation automatique des sockets pour la durée de la salle
          SocketService.setAutoInit(true);
          
          // Forcer l'initialisation du socket pour la salle
          const socket = await SocketService.getInstanceAsync(true);
          
          console.log(`✅ Socket initialisé avec succès pour la salle ${id}`);
          
          // Essayer de rejoindre la salle avec des nouvelles tentatives automatiques
          try {
            console.log(`🔌 Tentative de rejoindre la salle ${id} via WebSocket`);
            
            // Forcer l'initialisation du socket et activer l'autoInit 
            // pour permettre la reconnexion automatique en cas de déconnexion
            SocketService.setAutoInit(true);
            
            // Utiliser joinRoom avec une tentative d'initialisation forcée
            const joinSuccess = await SocketService.joinRoom(id as string);
            
            if (joinSuccess) {
              console.log(`✅ Salle ${id} rejointe avec succès via WebSocket`);
            } else {
              console.warn(`⚠️ Impossible de rejoindre la salle ${id} via WebSocket, mais continuons`);
              // Un nouvel essai sera fait automatiquement grâce à setAutoInit(true)
            }
          } catch (joinError) {
            console.warn(`⚠️ Erreur lors de la tentative de rejoindre la salle ${id}:`, joinError);
            // Continuer quand même pour permettre le fonctionnement via API REST
          }
          
          // Écouter les événements de la salle
          socket.on('room:update', async (data) => {
            console.log(`🔌 Événement room:update reçu:`, data.type);
            
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
                // Éviter les redirections multiples
                if (redirectingToGame !== data.gameId) {
                  setRedirectingToGame(data.gameId);
                  
                  console.log(`🎮 Jeu démarré! Redirection vers /game/${data.gameId}`);
                  
                  // S'assurer que les headers d'API sont corrects avant la redirection
                  if (user && user.id) {
                    api.defaults.headers.userId = user.id;
                    await AsyncStorage.setItem('@current_user_id', String(user.id));
                    console.log(`👤 ID utilisateur ${user.id} défini avant redirection`);
                  }
                  
                  // Attendre un peu avant de rediriger pour laisser le temps aux autres opérations
                  setTimeout(() => {
                    router.push(`/game/${data.gameId}`);
                  }, 500);
                }
                break;
            }
          });
        } catch (error) {
          console.error(`❌ Erreur lors de la configuration WebSocket pour la salle ${id}:`, error);
          // Éventuellement afficher un message d'erreur à l'utilisateur
        }
      };
      
      // Exécuter la fonction
      setupWebSocket();

      // Nettoyage lors du démontage
      return () => {
        console.log(`🔌 Nettoyage de la connexion WebSocket pour la salle ${id}`);
        
        // Utiliser une IIFE pour permettre l'utilisation d'async/await dans la fonction de nettoyage
        (async () => {
          try {
            // Tenter de quitter la salle
            await SocketService.leaveRoom(id as string);
            console.log(`✅ Déconnexion propre de la salle ${id}`);
            
            // Désactiver l'initialisation automatique des sockets après avoir quitté la salle
            SocketService.setAutoInit(false);
            
            // Nettoyer complètement le socket quand on quitte la salle
            await SocketService.cleanup();
          } catch (err) {
            console.error(`❌ Erreur lors de la déconnexion de la salle ${id}:`, err);
            // Nous pouvons ignorer cette erreur car nous nettoyons de toute façon
            // Désactiver l'initialisation automatique des sockets même en cas d'erreur
            SocketService.setAutoInit(false);
          }
        })();
      };
    }
  }, [id, user, router, redirectingToGame]);

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
