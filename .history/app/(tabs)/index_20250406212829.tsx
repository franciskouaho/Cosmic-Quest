"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme, Image, ImageBackground } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import Colors from "@/constants/Colors"
import { LinearGradient } from "expo-linear-gradient"

// Données des catégories de jeux pour soirées entre amis
const horizontalCategories = [
  { id: '1', title: 'Action ou Vérité', icon: 'help-circle', color: '#FF5252', borderColor: '#FF7B7B' },
  { id: '2', title: 'Je n\'ai jamais', icon: 'x-circle', color: '#4CAF50', borderColor: '#6FE575' },
  { id: '3', title: 'Blind Test', icon: 'music', color: '#7C4DFF', borderColor: '#9E7BFF' },
  { id: '4', title: 'Quiz Alcool', icon: 'wine', color: '#FF9800', borderColor: '#FFBD5C' },
];

const columnCategories = [
  { id: '1', title: 'Jeux à boire', icon: 'coffee', color: '#673AB7', borderColor: '#8A64D2' },
  { id: '2', title: 'Défis coquins', icon: 'zap', color: '#E91E63', borderColor: '#F75F96' },
];

const gridCategories = [
  { id: '1', title: 'Hot Couple', icon: 'heart', color: '#D81B60', borderColor: '#F05C8E' },
  { id: '2', title: 'Saint-Valentin', icon: 'gift', color: '#3F51B5', borderColor: '#5C6BC0' },
  { id: '3', title: 'Spring Break', icon: 'sun', color: '#FF9800', borderColor: '#FFBC5C' },
  { id: '4', title: 'Hardcore', icon: 'alert-triangle', color: '#8B0000', borderColor: '#B22222' },
];

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]

  // Rendu d'une carte de catégorie avec un design moderne
  const renderCategoryCard = (item, width = null, height = 100, containerStyle = {}) => (
    <TouchableOpacity 
      key={item.id}
      style={[
        styles.categoryCard, 
        { 
          width: width, 
          height: height, 
          backgroundColor: item.color,
          borderColor: item.borderColor,
        },
        containerStyle
      ]}
    >
      <View style={styles.cardContent}>
        <View style={styles.iconCircle}>
          <Feather name={item.icon} size={28} color="#FFFFFF" />
        </View>
        <Text style={styles.categoryTitle}>{item.title}</Text>
      </View>
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
          <Text style={styles.sectionTitle}>Top Catégories</Text>
        </View>
        
        <View style={styles.typeContainer}>
          <TouchableOpacity 
            style={[
              styles.mainCard, 
              { 
                backgroundColor: '#1E2A78', 
                borderColor: '#3A4DB2',
                borderWidth: 2,
              }
            ]}
          >
            <View style={styles.mainCardContent}>
              <View style={[styles.mainIconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Feather name="users" size={36} color="#FFFFFF" />
              </View>
              <Text style={styles.mainCardTitle}>Ambiance Festive</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.mainCard, 
              { 
                backgroundColor: '#8E1A40', 
                borderColor: '#D13163',
                borderWidth: 2,
              }
            ]}
          >
            <View style={styles.mainCardContent}>
              <View style={[styles.mainIconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Feather name="heart" size={36} color="#FFFFFF" />
              </View>
              <Text style={styles.mainCardTitle}>Hot & Sexy</Text>
              <View style={styles.lockedTag}>
                <Feather name="lock" size={16} color="#FFFFFF" />
              </View>
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
              renderCategoryCard(item, 180, 100, styles.horizontalCard)
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
              {renderCategoryCard(item, '100%', 90)}
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
                {renderCategoryCard(item, '100%', 110)}
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
  mainCard: {
    flex: 1,
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 2,
  },
  mainCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mainCardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.5,
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
    overflow: 'hidden',
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
  },
  horizontalCard: {
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    marginBottom: 8,
  },
  categoryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.5,
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
  },
  lockedTag: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  }
})


