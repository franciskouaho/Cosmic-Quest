"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"

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
            <Text style={styles.title}>SOIRÉE QUIZ</Text>
            <Text style={styles.subtitle}>Jouez ensemble</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Feather name="user" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Game actions container */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.mainButton} 
            onPress={handleCreateGame}
          >
            <Feather name="plus-circle" size={24} color="white" style={styles.buttonIcon} />
            <Text style={styles.mainButtonText}>Créer une partie</Text>
          </TouchableOpacity>
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

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
        </View>
        
        {/* Game types container */}
        <View style={styles.typeContainer}>
          <TouchableOpacity style={[styles.typeCard, styles.insightCard]}>
            <Text style={styles.typeTitle}>Culture Générale</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.typeCard, styles.spicyCard]}>
            <Text style={styles.typeTitle}>Questions Hot</Text>
            <View style={styles.lockedTag}>
              <Feather name="lock" size={16} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
    backgroundColor: "#1A0A2E",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
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
    opacity: 0.8,
    letterSpacing: 0.5,
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionsContainer: {
    marginBottom: 40,
  },
  mainButton: {
    backgroundColor: "#8A2BE2",
    borderRadius: 30,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  buttonIcon: {
    marginRight: 10,
  },
  mainButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dividerText: {
    color: "white",
    opacity: 0.6,
    marginHorizontal: 15,
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
  typeContainer: {
    flexDirection: "row",
    gap: 15,
  },
  typeCard: {
    flex: 1,
    height: 120,
    borderRadius: 20,
    padding: 20,
    justifyContent: "center",
    position: "relative",
  },
  insightCard: {
    backgroundColor: "#1E3A6E",
  },
  spicyCard: {
    backgroundColor: "#8E1F3E",
  },
  typeTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  lockedTag: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  }
})

