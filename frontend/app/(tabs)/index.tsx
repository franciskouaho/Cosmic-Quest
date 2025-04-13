"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from "react-native"
import { StatusBar } from "expo-status-bar"
import { LinearGradient } from "expo-linear-gradient"
import { useAuth } from "@/contexts/AuthContext"
import { Feather } from "@expo/vector-icons"
import { router } from "expo-router"
import BottomTabBar from "@/components/BottomTabBar"
import TopBar from "@/components/TopBar"
import SocketService from '@/services/socketService';
import RoomService from '@/services/roomService';
import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useCreateRoom } from '@/hooks/useCreateRoom';
import LoadingOverlay from '@/components/common/LoadingOverlay';
import {Socket} from "socket.io-client";

export default function HomeScreen() {
  const { user } = useAuth()

  // Gérer la création d'une salle de jeu
  const { mutate: createRoom, isPending: isCreatingRoom } = useCreateRoom();
  
  const createGameRoom = async (modeId: string) => {
    // Vérifier la connexion internet
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      Alert.alert(
        'Erreur de connexion',
        'Pas de connexion internet. Veuillez vérifier votre connexion et réessayer.'
      );
      return;
    }
    
    try {
      console.log('🎮 Tentative de création de salle avec mode:', modeId);
      
      // S'assurer que toutes les propriétés sont correctement définies et nommées
      createRoom({
        name: `Salle de ${user?.username || 'Joueur'}`,
        game_mode: modeId,
        max_players: 6,
        total_rounds: 5,
        // Ne pas envoyer is_private si undefined
      });
    } catch (error: any) {
      console.error('❌ Erreur lors de la création de la salle:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de créer la salle'
      );
    }
  };

  // Gérer les connexions WebSocket
  useEffect(() => {
    let socket: Socket | null = null;
    let socketInitialized = false;
    
    const initSocket = async () => {
      try {
        console.log('🔌 Initialisation du socket sur la page d\'accueil');
        socket = await SocketService.getInstanceAsync();
        socketInitialized = true;

        // Écouter les événements spécifiques à la salle
        socket.on('room:update', (data) => {
          console.log('🎮 Mise à jour de la salle reçue:', data);
        });
        
        // Vérifier l'état de la connexion
        const netInfo = await NetInfo.fetch();
        console.log(`🌐 État connexion: ${netInfo.isConnected ? 'Connecté' : 'Non connecté'} (${netInfo.type})`);
        
        // Vérifier l'état du socket de manière synchrone
        const socketConnected = SocketService.isConnected();
        console.log(`🔌 Socket connecté: ${socketConnected}`);
      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation du socket:', error);
      }
    };

    // Initialisation asynchrone
    initSocket();

    return () => {
      console.log('🔌 Nettoyage du socket sur la page d\'accueil');
      // Pas besoin de déconnecter complètement le socket à chaque fois 
      // pour éviter de multiples reconnexions, seulement se désabonner des événements
      if (socket && socketInitialized) {
        socket.off('room:update');
      }
    };
  }, []);
  
  // Rendu conditionnel pour le chargement
  if (isCreatingRoom) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient
          colors={["#1A0938", "#2D1155"]}
          style={styles.background}
        />
        <LoadingOverlay message="Création de la salle en cours..." />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1A0938", "#2D1155"]}
        style={styles.background}
       
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* Header avec position ajustée */}
          <TopBar />

          {/* Game Categories */}
          <View style={styles.categoriesContainer}>
            {/* Category Slider */}
            <Text style={styles.sectionTitle}>LES PACKS DU MOIS</Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categorySlider}
            >
              <TouchableOpacity style={styles.categoryCard}>
                <LinearGradient
                  colors={["rgba(30, 59, 141, 0.3)", "rgba(59, 95, 217, 0.3)"]}
                  style={[styles.cardGradient, styles.glowingCategoryBorder]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.illustrationsContainer}>
                      <View style={styles.illustration}>
                        <Image
                          source={{ uri: "/placeholder.svg?height=60&width=60" }}
                          style={styles.illustrationImage}
                        />
                      </View>
                      <View style={styles.illustration}>
                        <Image
                          source={{ uri: "/placeholder.svg?height=60&width=60" }}
                          style={styles.illustrationImage}
                        />
                      </View>
                      <View style={styles.illustration}>
                        <Image
                          source={{ uri: "/placeholder.svg?height=60&width=60" }}
                          style={styles.illustrationImage}
                        />
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>PÉCHÉS MIGNONS</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard}>
                <LinearGradient
                  colors={["rgba(106, 27, 154, 0.3)", "rgba(156, 39, 176, 0.3)"]}
                  style={[styles.cardGradient, styles.glowingCategoryBorder]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.illustrationsContainer}>
                      <Image source={{ uri: "/placeholder.svg?height=120&width=120" }} style={styles.memoriesImage} />
                    </View>
                    <Text style={styles.cardTitle}>SOUVENIRS D'ENFANCE</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.categoryCard}>
                <LinearGradient
                  colors={["rgba(196, 26, 95, 0.3)", "rgba(255, 82, 82, 0.3)"]}
                  style={[styles.cardGradient, styles.glowingCategoryBorder]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.illustrationsContainer}>
                      <View style={styles.illustration}>
                        <Image
                          source={{ uri: "/placeholder.svg?height=60&width=60" }}
                          style={styles.illustrationImage}
                        />
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>SAINT-VALENTIN</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.categoryCard}>
                <LinearGradient
                  colors={["rgba(21, 101, 192, 0.3)", "rgba(66, 165, 245, 0.3)"]}
                  style={[styles.cardGradient, styles.glowingCategoryBorder]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.illustrationsContainer}>
                      <View style={styles.illustration}>
                        <Image
                          source={{ uri: "/placeholder.svg?height=60&width=60" }}
                          style={styles.illustrationImage}
                        />
                      </View>
                    </View>
                    <Text style={styles.cardTitle}>SOIRÉE HOT</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>

            {/* Game Modes */}
            <Text style={styles.sectionTitle}>MODES DE JEU</Text>
            
            {/* Game Mode Card with Single Color and Glowing Border */}
            <TouchableOpacity 
              style={styles.modeCard} 
              onPress={() => createGameRoom('on-ecoute-mais-on-ne-juge-pas')}
            >
              <LinearGradient
                colors={["rgba(42, 59, 181, 0.30)", "rgba(42, 59, 181, 0.30)"]} 
                style={[styles.modeGradient, styles.glowingBorder]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={8}
              >
                <View style={styles.modeContent}>
                  <View style={styles.characterContainer}>
                    <Image 
                      source={require('@/assets/images/taupeTranspa.png')} 
                      style={styles.characterImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.modeTextContainer}>
                    <Text style={styles.modeName}>On ecoute mais on ne juge pas</Text>
                    <Text style={styles.modeDescription}>Un mode gratuit pour rigoler tranquillement entre potes.</Text>
                  </View>
                  <View style={styles.freeTagContainer}>
                    <Text style={styles.freeTag}>GRATUIT</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Vous pouvez ajouter d'autres modes de jeu ici */}
            <TouchableOpacity 
              style={styles.modeCard} 
              onPress={() => createGameRoom('spicy')}
            >
              <LinearGradient
                colors={["rgba(156, 39, 176, 0.30)", "rgba(156, 39, 176, 0.30)"]} 
                style={[styles.modeGradient, styles.glowingBorder]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={8}
              >
                <View style={styles.modeContent}>
                  <View style={styles.characterContainer}>
                    <Image 
                      source={require('@/assets/images/cochon.png')}
                      style={styles.characterImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.modeTextContainer}>
                    <Text style={styles.modeName}>Hot</Text>
                    <Text style={styles.modeDescription}>Un mode avancé avec encore plus de questions et de fun.</Text>
                  </View>
                  <View style={[styles.freeTagContainer, { backgroundColor: "rgba(255, 193, 7, 0.8)" }]}>
                    <Text style={styles.freeTag}>PREMIUM</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
        
        {/* Bottom Tab Bar */}
        <BottomTabBar />
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
 
  categoriesContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
    marginBottom: 15,
    letterSpacing: 0.5,
  },
  categorySlider: {
    paddingRight: 20,
    paddingBottom: 10,
    marginBottom: 25,
  },
  categoryCard: {
    borderRadius: 12,
    overflow: "visible", 
    height: 150, 
    width: 150, 
    marginRight: 15,
  },
  cardGradient: {
    flex: 1,
    padding: 15,
    borderRadius: 12, 
  },
  glowingCategoryBorder: {
    borderWidth: 1.5,
    borderColor: "#3B5FD9",
    shadowColor: "#3B5FD9",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  cardContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  illustrationsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  illustration: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    margin: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  illustrationImage: {
    width: 40,
    height: 40,
  },
  memoriesImage: {
    width: 120,
    height: 120,
  },
  cardTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
  },
  modeCard: {
    height: 120,
    borderRadius: 12,
    marginBottom: 20,
    overflow: "visible", 
  },
  modeGradient: {
    flex: 1,
    borderRadius: 12,
  },
  glowingBorder: {
    borderWidth: 1.5,
    borderColor: "#5D6DFF",
    shadowColor: "#5D6DFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 8,
  },
  modeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    position: "relative",
  },
  characterContainer: {
    width: 90,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  characterImage: {
    width: 110,
    height: 110,
  },
  modeTextContainer: {
    flex: 1,
    paddingHorizontal: 15,
    maxWidth: "60%",
    paddingRight: 40,
  },
  modeName: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  modeDescription: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 9,
  },
  freeTagContainer: {
    backgroundColor: "rgba(156, 39, 176, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    position: "absolute",
    right: 15,
    top: 15,
    zIndex: 10,
    elevation: 5,
  },
  freeTag: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
})
