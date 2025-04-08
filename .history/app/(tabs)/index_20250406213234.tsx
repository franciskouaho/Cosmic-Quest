import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native"
import { StatusBar } from "expo-status-bar"
import { LinearGradient } from "expo-linear-gradient"

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#1A0938", "#2D1155"]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>INSIGHT MODES</Text>
            <Text style={styles.headerSubtitle}>Plusieurs téléphones</Text>

            <View style={styles.rulesContainer}>
              <Text style={styles.rulesText}>règles</Text>
              <View style={styles.questionMarkContainer}>
                <Text style={styles.questionMark}>?</Text>
              </View>
            </View>
          </View>

          {/* Game Categories */}
          <View style={styles.categoriesContainer}>
            {/* First Row - Two Cards */}
            <View style={styles.categoryRow}>
              <TouchableOpacity style={[styles.categoryCard, styles.halfCard, { marginRight: 10 }]}>
                <LinearGradient
                  colors={["#1E3B8D", "#3B5FD9"]}
                  style={styles.cardGradient}
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

              <TouchableOpacity style={[styles.categoryCard, styles.halfCard]}>
                <LinearGradient
                  colors={["#6A1B9A", "#9C27B0"]}
                  style={styles.cardGradient}
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
            </View>

            {/* Game Modes */}
            <TouchableOpacity style={styles.modeCard}>
              <LinearGradient
                colors={["#0D2F6B", "#1E5AAD"]}
                style={styles.modeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={20}
              >
                <View style={styles.modeContent}>
                  <View style={styles.characterContainer}>
                    <Image source={{ uri: "/placeholder.svg?height=120&width=120" }} style={styles.characterImage} />
                  </View>
                  <View style={styles.modeTextContainer}>
                    <Text style={styles.modeName}>INSIGHT</Text>
                    <Text style={styles.modeDescription}>Un mode gratuit pour rigoler tranquillement entre potes.</Text>
                  </View>
                  <View style={styles.freeTagContainer}>
                    <Text style={styles.freeTag}>GRATUIT</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeCard}>
              <LinearGradient
                colors={["#8E0D3C", "#C41A5F"]}
                style={styles.modeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={20}
              >
                <View style={styles.modeContent}>
                  <View style={styles.characterContainer}>
                    <Image source={{ uri: "/placeholder.svg?height=120&width=120" }} style={styles.characterImage} />
                  </View>
                  <View style={styles.modeTextContainer}>
                    <Text style={styles.modeName}>SPICY</Text>
                    <Text style={styles.modeDescription}>Questions coquines et déplacées... Prêts à assumer ?</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modeCard}>
              <LinearGradient
                colors={["#1A1A1A", "#333333"]}
                style={styles.modeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                borderRadius={20}
              >
                <View style={styles.modeContent}>
                  <View style={styles.characterContainer}>
                    <Image source={{ uri: "/placeholder.svg?height=120&width=120" }} style={styles.characterImage} />
                  </View>
                  <View style={styles.modeTextContainer}>
                    <Text style={styles.modeName}>HARDCORE</Text>
                    <Text style={styles.modeDescription}>Plus de pitié. Il est temps de dire les termes.</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: "relative",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 5,
  },
  rulesContainer: {
    position: "absolute",
    right: 20,
    top: 60,
    flexDirection: "row",
    alignItems: "center",
  },
  rulesText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    marginRight: 10,
  },
  questionMarkContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  questionMark: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 18,
    fontWeight: "bold",
  },
  categoriesContainer: {
    padding: 20,
  },
  categoryRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  categoryCard: {
    borderRadius: 20,
    overflow: "hidden",
    height: 180,
  },
  halfCard: {
    flex: 1,
  },
  cardGradient: {
    flex: 1,
    padding: 15,
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
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
  },
  modeCard: {
    height: 120,
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
  },
  modeGradient: {
    flex: 1,
  },
  modeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
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
    marginLeft: 15,
  },
  modeName: {
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 5,
  },
  modeDescription: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
  },
  freeTagContainer: {
    backgroundColor: "#8E44AD",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    position: "absolute",
    right: 15,
    top: 15,
  },
  freeTag: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
})

