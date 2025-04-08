"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, ImageBackground } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useAuth } from "@/contexts/AuthContext"

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuth()

  const handleJoinGame = (code) => {
    router.push(`/game/join?code=${code}`)
  }

  const handleCreateGame = () => {
    router.push("/game/create")
  }

  const handleScanQR = () => {
    router.push("/game/scan")
  }

  return (
    <ImageBackground source={require("@/assets/images/bg-pattern.png")} style={styles.backgroundImage}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header with logo and menu */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image source={require("@/assets/images/disco-ball.png")} style={styles.logo} />
            <View style={styles.titleContainer}>
              <Text style={styles.title}>INSIGHT</Text>
              <Text style={styles.subtitle}>play with friends</Text>
            </View>
          </View>
          <TouchableOpacity>
            <Feather name="grid" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Game code input */}
        <View style={styles.codeInputContainer}>
          <TextInput style={styles.codeInput} placeholder="Entre le code de la partie" placeholderTextColor="#8A8A8A" />
          <TouchableOpacity style={styles.qrButton} onPress={handleScanQR}>
            <Feather name="maximize" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Monthly packs section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LES PACKS DU MOIS</Text>
          <Text style={styles.sectionSubtitle}>1 nouveau pack par semaine</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packsContainer}>
            <TouchableOpacity style={styles.packCard}>
              <Image source={require("@/assets/images/pack-peches.png")} style={styles.packImage} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.packCard}>
              <Image source={require("@/assets/images/pack-souvenirs.png")} style={styles.packImage} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Game modes section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>INSIGHT MODES</Text>
              <Text style={styles.sectionSubtitle}>Plusieurs téléphones</Text>
            </View>
            <View style={styles.rulesContainer}>
              <Text style={styles.rulesText}>règles</Text>
              <TouchableOpacity style={styles.helpButton}>
                <Text style={styles.helpButtonText}>?</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Game mode cards */}
          <View style={styles.modesContainer}>
            <TouchableOpacity style={[styles.modeCard, styles.insightCard]}>
              <Image source={require("@/assets/images/character-insight.png")} style={styles.characterImage} />
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>INSIGHT</Text>
                <Text style={styles.modeDescription}>Un mode gratuit pour rigoler tranquillement entre potes.</Text>
              </View>
              <View style={styles.freeTag}>
                <Text style={styles.freeTagText}>GRATUIT</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modeCard, styles.spicyCard]}>
              <Image source={require("@/assets/images/character-spicy.png")} style={styles.characterImage} />
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>SPiCY</Text>
                <Text style={styles.modeDescription}>
                  Questions coquines et déplacées...{"\n"}
                  Prêts à assumer ?
                </Text>
              </View>
              <Image source={require("@/assets/images/locked-icon.png")} style={styles.lockedIcon} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    backgroundColor: "#1A0A2E", // Fallback color
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  titleContainer: {
    flexDirection: "column",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: "white",
    letterSpacing: 0.5,
  },
  codeInputContainer: {
    flexDirection: "row",
    marginBottom: 30,
  },
  codeInput: {
    flex: 1,
    backgroundColor: "rgba(30, 15, 50, 0.8)",
    borderRadius: 30,
    padding: 15,
    color: "white",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#3D2A5E",
  },
  qrButton: {
    width: 60,
    height: 60,
    backgroundColor: "#8A2BE2",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#B8B8B8",
    marginBottom: 15,
  },
  packsContainer: {
    flexDirection: "row",
  },
  packCard: {
    width: 220,
    height: 220,
    marginRight: 15,
    borderRadius: 20,
    overflow: "hidden",
  },
  packImage: {
    width: "100%",
    height: "100%",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 15,
  },
  rulesContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rulesText: {
    color: "#B8B8B8",
    marginRight: 10,
  },
  helpButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#B8B8B8",
    justifyContent: "center",
    alignItems: "center",
  },
  helpButtonText: {
    color: "#B8B8B8",
    fontSize: 18,
    fontWeight: "bold",
  },
  modesContainer: {
    gap: 15,
  },
  modeCard: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 15,
    alignItems: "center",
    overflow: "hidden",
  },
  insightCard: {
    backgroundColor: "#1E3A6E",
  },
  spicyCard: {
    backgroundColor: "#8E1F3E",
  },
  characterImage: {
    width: 80,
    height: 120,
    marginRight: 10,
  },
  modeInfo: {
    flex: 1,
  },
  modeName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 5,
  },
  modeDescription: {
    fontSize: 14,
    color: "white",
    opacity: 0.8,
  },
  freeTag: {
    backgroundColor: "#8A2BE2",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    position: "absolute",
    top: 15,
    right: 15,
  },
  freeTagText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  lockedIcon: {
    width: 40,
    height: 40,
    position: "absolute",
    bottom: 15,
    right: 15,
  },
})

