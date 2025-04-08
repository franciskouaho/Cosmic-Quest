"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import Colors from "@/constants/Colors"
import { LinearGradient } from "expo-linear-gradient"

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]

  return (
    <LinearGradient 
      colors={['#1A0938', '#2D1155']} 
      style={styles.backgroundContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <Text style={styles.logoText}>COSMIC QUEST</Text>
          <TouchableOpacity style={styles.iconButton}>
            <Feather name="user" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoText: {
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#FFFFFF",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 30, // Ajusté pour compenser la suppression de la section
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

