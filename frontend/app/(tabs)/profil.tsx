import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { userService } from '@/services/queries/user';
import BottomTabBar from '@/components/BottomTabBar';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  
  // Récupérer les statistiques de l'utilisateur
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user', 'stats'],
    queryFn: () => userService.getUserStats(),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => {
            signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1a0933', '#321a5e']}
        style={styles.background}
      />
      
      <ScrollView style={styles.content}>
        {/* Header with profile information */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarText}>{user?.displayName?.charAt(0) || user?.username?.charAt(0) || '?'}</Text>
            )}
          </View>
          
          <Text style={styles.username}>{user?.displayName || user?.username}</Text>
          
          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Niveau {user?.level || 1}</Text>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.games_played || 0}</Text>
              <Text style={styles.statLabel}>Parties jouées</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.games_won || 0}</Text>
              <Text style={styles.statLabel}>Victoires</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats?.win_rate ? `${Math.round(stats.win_rate)}%` : '0%'}</Text>
              <Text style={styles.statLabel}>Taux de victoire</Text>
            </View>
          </View>
        </View>
        
        {/* Premium Pass Section */}
        <View style={styles.premiumSection}>
          <LinearGradient
            colors={['rgba(105, 78, 214, 0.3)', 'rgba(105, 78, 214, 0.1)']}
            style={styles.premiumGradient}
          >
            <View style={styles.premiumHeader}>
              <Text style={styles.premiumTitle}>PASSE PREMIUM</Text>
              <MaterialCommunityIcons name="crown" size={50} color="#FFD700" />
            </View>
            
            <View style={styles.premiumFeatures}>
              <View style={styles.premiumFeatureItem}>
                <MaterialCommunityIcons name="lock-open" size={24} color="#8c42f5" style={styles.featureIcon} />
                <Text style={styles.featureText}>Débloque tous les modes</Text>
              </View>
              
              <View style={styles.premiumFeatureItem}>
                <MaterialCommunityIcons name="package-variant" size={24} color="#f5a742" style={styles.featureIcon} />
                <Text style={styles.featureText}>Un nouveau pack chaque semaine</Text>
              </View>
              
              <View style={styles.premiumFeatureItem}>
                <MaterialCommunityIcons name="account-group" size={24} color="#42f5b3" style={styles.featureIcon} />
                <Text style={styles.featureText}>Accès gratuit pour tes amis</Text>
              </View>
              
              <View style={styles.premiumFeatureItem}>
                <MaterialCommunityIcons name="credit-card-refresh" size={24} color="#4287f5" style={styles.featureIcon} />
                <Text style={styles.featureText}>Résiliable à tout moment</Text>
              </View>
            </View>
            
            <View style={styles.premiumPriceRow}>
              <TouchableOpacity style={styles.premiumButton}>
                <Text style={styles.premiumButtonText}>Essayer le premium</Text>
              </TouchableOpacity>
              
              <Text style={styles.premiumPrice}>5,99€ par semaine</Text>
            </View>
          </LinearGradient>
        </View>
        
        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>PARAMÈTRES</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/settings/language')}>
            <MaterialCommunityIcons name="translate" size={24} color="rgba(255,255,255,0.9)" />
            <Text style={styles.settingText}>Langue</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/settings/notifications')}>
            <MaterialCommunityIcons name="bell" size={24} color="rgba(255,255,255,0.9)" />
            <Text style={styles.settingText}>Notifications</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert('Contact', 'Envoyez-nous un email à support@cosmicquest.com')}>
            <MaterialCommunityIcons name="email" size={24} color="rgba(255,255,255,0.9)" />
            <Text style={styles.settingText}>Nous contacter</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => router.push('/settings/privacy')}>
            <MaterialCommunityIcons name="shield-account" size={24} color="rgba(255,255,255,0.9)" />
            <Text style={styles.settingText}>Politique de confidentialité</Text>
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={24} color="#ff6b6b" />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.bottomSpace} />
      </ScrollView>
      
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    paddingTop: 60,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#694ED6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  levelContainer: {
    backgroundColor: 'rgba(105, 78, 214, 0.3)',
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginBottom: 20,
  },
  levelText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  premiumSection: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumGradient: {
    borderRadius: 16,
    padding: 20,
  },
  premiumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 1,
  },
  premiumImage: {
    width: 60,
    height: 60,
  },
  premiumFeatures: {
    marginBottom: 20,
  },
  premiumFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  featureIcon: {
    marginRight: 15,
    width: 24,
  },
  featureText: {
    fontSize: 16,
    color: 'white',
  },
  premiumPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  premiumButton: {
    backgroundColor: '#8c42f5',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  premiumButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  premiumPrice: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginBottom: 10,
  },
  settingText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: 'white',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    marginTop: 20,
  },
  logoutText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#ff6b6b',
    fontWeight: '600',
  },
  bottomSpace: {
    height: 200, // Augmenté de 70 à 120 pour s'assurer que le bouton est visible
  },
});
