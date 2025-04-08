"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useColorScheme, Image, ImageBackground } from "react-native"
import { useRouter } from "expo-router"
import { Feather } from "@expo/vector-icons"
import Colors from "@/constants/Colors"
import { LinearGradient } from "expo-linear-gradient"

// Données fictives pour les catégories avec des images
const horizontalCategories = [
  { id: '1', title: 'Cinéma', image: require('@/assets/images/categories/cinema.jpg') },
  { id: '2', title: 'Sport', image: require('@/assets/images/categories/sport.jpg') },
  { id: '3', title: 'Musique', image: require('@/assets/images/categories/music.jpg') },
  { id: '4', title: 'Sciences', image: require('@/assets/images/categories/science.jpg') },
];

const columnCategories = [
  { id: '1', title: 'Histoire', image: require('@/assets/images/categories/history.jpg') },
  { id: '2', title: 'Géographie', image: require('@/assets/images/categories/geography.jpg') },
];

const gridCategories = [
  { id: '1', title: 'Animaux', image: require('@/assets/images/categories/animals.jpg') },
  { id: '2', title: 'Technologie', image: require('@/assets/images/categories/technology.jpg') },
  { id: '3', title: 'Art', image: require('@/assets/images/categories/art.jpg') },
  { id: '4', title: 'Gastronomie', image: require('@/assets/images/categories/food.jpg') },
];

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme() ?? "dark"
  const colors = Colors[colorScheme]

  // Rendu d'une carte de catégorie avec image d'arrière-plan
  const renderCategoryCard = (item, width = null, height = 100, containerStyle = {}) => (
    <TouchableOpacity 
      key={item.id}
      style={[
        styles.categoryCard, 
        { width: width, height: height },
        containerStyle
      ]}
    >
      <ImageBackground 
        source={item.image}
        style={styles.cardBackground}
        imageStyle={styles.cardBackgroundImage}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
          style={styles.cardGradient}
        >
          <Text style={styles.categoryTitle}>{item.title}</Text>
        </LinearGradient>
      </ImageBackground>
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
          <TouchableOpacity style={[styles.mainCard]}>
            <ImageBackground 
              source={require('@/assets/images/categories/general.jpg')}
              style={styles.mainCardBackground}
              imageStyle={styles.mainCardImage}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
                style={styles.mainCardGradient}
              >
                <Text style={styles.mainCardTitle}>Culture Générale</Text>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.mainCard]}>
            <ImageBackground 
              source={require('@/assets/images/categories/hot.jpg')}
              style={styles.mainCardBackground}
              imageStyle={styles.mainCardImage}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
                style={styles.mainCardGradient}
              >
                <Text style={styles.mainCardTitle}>Questions Hot</Text>
                <View style={styles.lockedTag}>
                  <Feather name="lock" size={16} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </ImageBackground>
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
    height: 130,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mainCardBackground: {
    width: '100%',
    height: '100%',
  },
  mainCardImage: {
    borderRadius: 20,
  },
  mainCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: 15,
  },
  mainCardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  },
  horizontalCard: {
    marginRight: 12,
  },
  cardBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  cardBackgroundImage: {
    borderRadius: 15,
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    justifyContent: 'flex-end',
    padding: 12,
  },
  categoryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  }
})

