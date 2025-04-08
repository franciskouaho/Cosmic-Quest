"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import { useAuth } from "@/contexts/AuthContext"

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuth()

  const handleJoinGame = () => {
    router.push("/game/join")
  }

  const handleCreateGame = () => {
    router.push("/game/create")
  }

  return (
    <View style={styles.backgroundContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header with title */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>INSIGHT</Text>
            <Text style={styles.subtitle}>play with friends</Text>
          </View>
          <TouchableOpacity>
            <Feather name="grid" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Game code input */}
        <View style={styles.codeInputContainer}>
          <TextInput 
            style={styles.codeInput} 
            placeholder="Entre le code de la partie" 
            placeholderTextColor="#8A8A8A" 
          />
          <TouchableOpacity 
            style={styles.joinButton} 
            onPress={handleJoinGame}
          >
            <Feather name="arrow-right" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Game modes section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>MODES DE JEU</Text>
              <Text style={styles.sectionSubtitle}>Plusieurs téléphones</Text>
            </View>
          </View>

          {/* Game mode cards */}
          <View style={styles.modesContainer}>
            <TouchableOpacity 
              style={[styles.modeCard, styles.insightCard]}
              onPress={handleCreateGame}
            >
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>INSIGHT</Text>
                <Text style={styles.modeDescription}>Un mode gratuit pour rigoler tranquillement entre potes.</Text>
              </View>
              <View style={styles.freeTag}>
                <Text style={styles.freeTagText}>GRATUIT</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modeCard, styles.spicyCard]}>
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>SPiCY</Text>
                <Text style={styles.modeDescription}>
                  Questions coquines et déplacées...{"\n"}
                  Prêts à assumer ?
                </Text>
              </View>
              <View style={styles.lockedTag}>
                <Feather name="lock" size={16} color="white" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    backgroundColor: "#1A0A2E", // Fond uni au lieu d'une image
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
  joinButton: {
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 15,
  },
  modesContainer: {
    gap: 15,
  },
  modeCard: {
    borderRadius: 20,
    padding: 25,
    minHeight: 150,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  insightCard: {
    backgroundColor: "#1E3A6E",
  },
  spicyCard: {
    backgroundColor: "#8E1F3E",
  },
  modeInfo: {
    flex: 1,
  },
  modeName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 10,
  },
  modeDescription: {
    fontSize: 14,
    color: "white",
    opacity: 0.8,
    lineHeight: 20,
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
  lockedTag: {
    position: "absolute",
    bottom: 15,
    right: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  }
})

