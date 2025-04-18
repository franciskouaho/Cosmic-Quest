"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { useAuth } from "@/contexts/AuthContext"
import BottomTabBar from "@/components/BottomTabBar"
import TopBar from "@/components/TopBar"
import SocketService from '@/services/socketService';
import NetInfo from '@react-native-community/netinfo';
import { useCreateRoom } from '@/hooks/useCreateRoom';
import LoadingOverlay from '@/components/common/LoadingOverlay';

const gameModes = [
  {
    id: 'on-ecoute-mais-on-ne-juge-pas',
    name: 'On écoute mais on ne juge pas',
    description: 'Un mode gratuit pour rigoler tranquillement entre potes.',
    image: require('@/assets/images/taupeTranspa.png'),
    colors: ["rgba(42, 59, 181, 0.30)", "rgba(67, 89, 224, 0.40)"],
    borderColor: "#5D6DFF",
    shadowColor: "#5D6DFF",
    tag: 'NEW !',
    tagColor: "#4CAF50",
    premium: false
  },
  {
    id: 'soit-tu-sais-soit-tu-bois',
    name: 'Soit tu sais soit tu bois',
    description: 'Un mode ludique avec un niveau de difficulté progressif.',
    image: require('@/assets/images/cochon.png'),
    colors: ["rgba(156, 39, 176, 0.30)", "rgba(186, 104, 200, 0.40)"],
    borderColor: "#BA68C8",
    shadowColor: "#BA68C8",
    tag: 'PREMIUM',
    tagColor: "rgba(255, 193, 7, 0.8)",
    premium: true
  },
  {
    id: 'action-ou-verite',
    name: 'Action ou vérité',
    description: 'Le classique revisité avec des défis exclusifs.',
    image: require('@/assets/images/snake_vs_fox.png'),
    colors: ["rgba(0, 150, 136, 0.30)", "rgba(77, 182, 172, 0.40)"],
    borderColor: "#26A69A",
    shadowColor: "#26A69A", 
    tag: 'NEW !',
    tagColor: "#4CAF50",
    premium: false
  },
  {
    id: 'spicy',
    name: 'Hot',
    description: 'Pour pimenter vos soirées avec des questions osées.',
    image: require('@/assets/images/vache.png'),
    colors: ["rgba(211, 47, 47, 0.30)", "rgba(229, 115, 115, 0.40)"],
    borderColor: "#E57373",
    shadowColor: "#E57373",
    tag: 'PREMIUM',
    tagColor: "rgba(255, 193, 7, 0.8)",
    premium: true
  },
  {
    id: 'connais-tu-vraiment',
    name: 'Connais-tu vraiment ?',
    description: 'Testez votre connaissance de vos amis.',
    image: require('@/assets/images/taupeTranspa.png'),
    colors: ["rgba(63, 81, 181, 0.30)", "rgba(121, 134, 203, 0.40)"],
    borderColor: "#7986CB",
    shadowColor: "#7986CB",
    tag: 'NEW !',
    tagColor: "#4CAF50",
    premium: false
  },
  {
    id: 'blind-test',
    name: 'Blind Test',
    description: 'Devinez des titres à partir d\'extraits musicaux.',
    image: require('@/assets/images/cochon.png'), // À remplacer par une image appropriée
    colors: ["rgba(255, 87, 34, 0.30)", "rgba(255, 138, 101, 0.40)"],
    borderColor: "#FF8A65",
    shadowColor: "#FF8A65",
    tag: 'COMING SOON',
    tagColor: "#9C27B0",
    premium: true
  }
];

// Configuration des packs thématiques
const themePacks = [
  {
    id: 'peches-mignons',
    title: 'PÉCHÉS MIGNONS',
    colors: ["rgba(30, 59, 141, 0.3)", "rgba(59, 95, 217, 0.3)"],
    borderColor: "#3B5FD9",
    shadowColor: "#3B5FD9",
    illustrations: 3,
  },
  {
    id: 'souvenirs-enfance',
    title: 'SOUVENIRS D\'ENFANCE',
    colors: ["rgba(106, 27, 154, 0.3)", "rgba(156, 39, 176, 0.3)"],
    borderColor: "#9C27B0",
    shadowColor: "#9C27B0",
    singleIllustration: true,
  },
  {
    id: 'saint-valentin',
    title: 'SAINT-VALENTIN',
    colors: ["rgba(196, 26, 95, 0.3)", "rgba(255, 82, 82, 0.3)"],
    borderColor: "#FF5252",
    shadowColor: "#FF5252",
    illustrations: 1,
  },
  {
    id: 'soiree-hot',
    title: 'SOIRÉE HOT',
    colors: ["rgba(21, 101, 192, 0.3)", "rgba(66, 165, 245, 0.3)"],
    borderColor: "#42A5F5",
    shadowColor: "#42A5F5",
    illustrations: 1,
  },
];

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
      
      // Initialiser le socket explicitement ici au moment du clic
      console.log('🔌 Initialisation socket demandée lors de la création de salle');
      
      // On active l'initialisation automatique seulement à partir de ce moment
      SocketService.setAutoInit(true);
      
      // On n'a pas besoin d'attendre le socket pour créer la salle via HTTP
      // Le traitement de createRoom s'occupera de rejoindre le socket si nécessaire
      
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
  
  // Rendu des cartes thématiques
  const renderThemeCard = (theme: any) => (
    <TouchableOpacity key={theme.id} style={styles.categoryCard}>
      <LinearGradient
        colors={theme.colors}
        style={[
          styles.cardGradient, 
          { 
            borderColor: theme.borderColor,
            shadowColor: theme.shadowColor,
          },
          styles.glowingCategoryBorder
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardContent}>
          <View style={styles.illustrationsContainer}>
            {theme.singleIllustration ? (
              <Image source={{ uri: "/placeholder.svg?height=120&width=120" }} style={styles.memoriesImage} />
            ) : (
              Array.from({ length: theme.illustrations || 1 }).map((_, index) => (
                <View key={index} style={styles.illustration}>
                  <Image
                    source={{ uri: "/placeholder.svg?height=60&width=60" }}
                    style={styles.illustrationImage}
                  />
                </View>
              ))
            )}
          </View>
          <Text style={styles.cardTitle}>{theme.title}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
  
  // Rendu des cartes de mode de jeu
  const renderGameModeCard = (game: any) => (
    <TouchableOpacity 
      key={game.id}
      style={styles.modeCard} 
      onPress={() => createGameRoom(game.id)}
    >
      <LinearGradient
        colors={game.colors}
        style={[
          styles.modeGradient, 
          { 
            borderColor: game.borderColor,
            shadowColor: game.shadowColor
          },
          styles.glowingBorder
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        borderRadius={8}
      >
        <View style={styles.modeContent}>
          <View style={styles.characterContainer}>
            <Image 
              source={game.image}
              style={styles.characterImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.modeTextContainer}>
            <Text style={styles.modeName}>{game.name}</Text>
            <Text style={styles.modeDescription}>{game.description}</Text>
          </View>
          <View style={[styles.freeTagContainer, { backgroundColor: game.tagColor }]}>
            <Text style={styles.freeTag}>{game.tag}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
  
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
              {themePacks.map(renderThemeCard)}
            </ScrollView>

            {/* Game Modes */}
            <Text style={styles.sectionTitle}>MODES DE JEU</Text>
            
            {/* Game Mode Cards */}
            {gameModes.map(renderGameModeCard)}
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
  scrollViewContent: {
    paddingBottom: 20,
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
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  glowingCategoryBorder: {
    // Propriétés spécifiques déplacées à l'inline style dans renderThemeCard
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
    flexWrap: "wrap",
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
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 8,
  },
  glowingBorder: {
    // Propriétés spécifiques déplacées à l'inline style dans renderGameModeCard
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  freeTag: {
    color: "white",
    fontWeight: "bold",
    fontSize: 10,
    textAlign: 'center',
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
