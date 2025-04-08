"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, useColorScheme } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import Colors from "@/constants/Colors"
import { LinearGradient } from "expo-linear-gradient"

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]

  const handleJoinGame = () => {
    router.push("/game/join")
  }

  const handleCreateGame = () => {
    router.push("/game/create")
  }

  return (
    <LinearGradient 
      colors={['#1A0938', '#2D1155']} 
      style={styles.backgroundContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header with title */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.tertiary }]}>COSMIC QUEST</Text>
            <Text style={[styles.subtitle, { color: colors.tertiary }]}>Jouez ensemble</Text>
          </View>
          <TouchableOpacity style={[styles.profileButton, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
            <Feather name="user" size={24} color={colors.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Game actions container */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.mainButton, { backgroundColor: 'rgba(255, 255, 255, 0.12)' }]} 
            onPress={handleCreateGame}
          >
            <Feather name="plus-circle" size={24} color={colors.tertiary} style={styles.buttonIcon} />
            <Text style={[styles.mainButtonText, { color: colors.tertiary }]}>Créer une partie</Text>
          </TouchableOpacity>
          
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
            <Text style={[styles.dividerText, { color: colors.tertiary, opacity: 0.7 }]}>ou</Text>
            <View style={[styles.dividerLine, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
          </View>

          <View style={styles.codeInputContainer}>
            <TextInput 
              style={[styles.codeInput, { 
                backgroundColor: 'rgba(10, 2, 31, 0.8)', 
                color: colors.tertiary,
                borderColor: 'rgba(120, 86, 255, 0.3)'
              }]} 
              placeholder="Entre le code de la partie" 
              placeholderTextColor="rgba(255, 255, 255, 0.5)" 
            />
            <TouchableOpacity 
              style={[styles.joinButton, { backgroundColor: '#6C41EC' }]} 
              onPress={handleJoinGame}
            >
              <Feather name="arrow-right" size={24} color={colors.tertiary} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Game types container */}
        <View style={styles.typeContainer}>
          <TouchableOpacity style={[styles.typeCard, { backgroundColor: '#162B56' }]}>
            <Text style={[styles.typeTitle, { color: colors.tertiary }]}>Culture Générale</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.typeCard, { backgroundColor: '#5E1A30' }]}>
            <Text style={[styles.typeTitle, { color: colors.tertiary }]}>Questions Hot</Text>
            <View style={[styles.lockedTag, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
              <Feather name="lock" size={16} color={colors.tertiary} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  backgroundContainer: {
    flex: 1,
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
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    letterSpacing: 0.5,
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  actionsContainer: {
    marginBottom: 40,
  },
  mainButton: {
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
  },
  dividerText: {
    marginHorizontal: 15,
  },
  codeInputContainer: {
    flexDirection: "row",
    marginBottom: 30,
  },
  codeInput: {
    flex: 1,
    borderRadius: 30,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  joinButton: {
    width: 60,
    height: 60,
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
  typeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  lockedTag: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  }
})

