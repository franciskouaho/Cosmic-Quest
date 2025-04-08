"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme, Image, FlatList } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import Colors from "@/constants/Colors"
import { LinearGradient } from "expo-linear-gradient"

// Données fictives pour les catégories
const horizontalCategories = [
  { id: '1', title: 'Cinéma', color: '#4B0082', icon: 'film' },
  { id: '2', title: 'Sport', color: '#006400', icon: 'activity' },
  { id: '3', title: 'Musique', color: '#8B0000', icon: 'music' },
  { id: '4', title: 'Sciences', color: '#00008B', icon: 'compass' },
];

const columnCategories = [
  { id: '1', title: 'Histoire', color: '#4A148C', icon: 'book' },
  { id: '2', title: 'Géographie', color: '#004D40', icon: 'map' },
];

const gridCategories = [
  { id: '1', title: 'Animaux', color: '#880E4F', icon: 'github' },
  { id: '2', title: 'Technologie', color: '#1A237E', icon: 'cpu' },
  { id: '3', title: 'Art', color: '#BF360C', icon: 'feather' },
  { id: '4', title: 'Gastronomie', color: '#33691E', icon: 'coffee' },
];

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]

  // Rendu d'une carte de catégorie rectangulaire
  const renderCategoryCard = (item, width = null, height = 100) => (
    <TouchableOpacity 
      key={item.id}
      style={[
        styles.categoryCard, 
        { backgroundColor: item.color, width: width, height: height }
      ]}
    >
      <Feather name={item.icon} size={24} color="#FFFFFF" style={styles.categoryIcon} />
      <Text style={styles.categoryTitle}>{item.title}</Text>
    </TouchableOpacity>
  );

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
        {/* Section principale - deux types côte à côte */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Types principaux</Text>
        </View>
        
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

        {/* Section slider horizontal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Catégories populaires</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {horizontalCategories.map(item => (
              renderCategoryCard(item, 180, 90)
            ))}
          </ScrollView>
        </View>

        {/* Section colonne (1 par ligne) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Catégories en colonne</Text>
          </View>
          
          {columnCategories.map(item => (
            <View key={item.id} style={styles.columnItem}>
              {renderCategoryCard(item, '100%', 80)}
            </View>
          ))}
        </View>

        {/* Section grille (2 par ligne) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Explorer plus</Text>
          </View>
          
          <View style={styles.gridContainer}>
            {gridCategories.map(item => (
              <View key={item.id} style={styles.gridItem}>
                {renderCategoryCard(item, '100%', 100)}
              </View>
            ))}
          </View>
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
    paddingTop: 30,
    paddingBottom: 50,
  },
  typeContainer: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 40,
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
  },
  section: {
    marginBottom: 35,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  seeAllText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  horizontalList: {
    paddingRight: 20,
  },
  categoryCard: {
    borderRadius: 15,
    padding: 16,
    marginRight: 12,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  categoryIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0.8,
  },
  categoryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  columnItem: {
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridItem: {
    width: '50%',
    padding: 6,
  }
})

