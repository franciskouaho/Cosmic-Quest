import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native"
import { StatusBar } from "expo-status-bar"
import { LinearGradient } from "expo-linear-gradient"
import { useAuth } from "@/contexts/AuthContext"
import { Feather } from "@expo/vector-icons"
import { router } from "expo-router"
import BottomTabBar from "@/components/BottomTabBar"
import TopBar from "@/components/TopBar"

export default function HomeScreen() {
  const { user, signOut } = useAuth()
  
  const goToSettings = () => {
    router.push("/settings")
  }
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#1A0938", "#2D1155"]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* Header avec position ajustée */}
          <TopBar
            rightButtons={
              <TouchableOpacity style={styles.iconButton} onPress={goToSettings}>
                <Feather name="settings" size={22} color="white" />
              </TouchableOpacity>
            }
          />

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
            <TouchableOpacity style={styles.modeCard}>
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
    paddingBottom: 100, // Ajoutez de l'espace en bas pour que le contenu ne soit pas caché par la barre d'onglets
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
    width: 80,
    height: 80,
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
})