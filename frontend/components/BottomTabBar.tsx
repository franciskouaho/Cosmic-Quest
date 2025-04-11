import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';

type TabItemProps = {
  iconComponent: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
};

const TabItem = ({ iconComponent, isActive, onPress }: TabItemProps) => (
  <TouchableOpacity
    style={styles.tabItem}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }}
  >
    {iconComponent}
  </TouchableOpacity>
);

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <View style={styles.tabBarContainer}>
        <TabItem
          iconComponent={
            <Feather 
              name="home" 
              size={22} 
              color={pathname === '/' ? "#FFFFFF" : "rgba(255,255,255,0.7)"} 
            />
          }
          isActive={pathname === '/'}
          onPress={() => router.push('/')}
        />
        <TabItem
          iconComponent={
            <FontAwesome5 
              name="user-friends" 
              size={20} 
              color={pathname === '/joint-salle' ? "#FFFFFF" : "rgba(255,255,255,0.7)"} 
            />
          }
          isActive={pathname === '/joint-salle'}
          onPress={() => router.push('/joint-salle')}
        />
        <TabItem
          iconComponent={
            <Ionicons 
              name="trophy-outline" 
              size={22} 
              color={pathname === '/leaderboard' ? "#FFFFFF" : "rgba(255,255,255,0.7)"} 
            />
          }
          isActive={pathname === '/leaderboard'}
          onPress={() => router.push('/leaderboard')}
        />
        <TabItem
          iconComponent={
            <Feather 
              name="user" 
              size={22} 
              color={pathname === '/(tabs)/profil' ? "#FFFFFF" : "rgba(255,255,255,0.7)"} 
            />
          }
          isActive={pathname === '/(tabs)/profil'}
          onPress={() => router.push('/(tabs)/profil')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, // Changé de 40 à 0
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20, // Ajout d'un padding bottom
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  tabBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 17, 85, 0.9)',
    borderRadius: 40,
    paddingVertical: 14,
    paddingHorizontal: 50,
    width: '100%',
    elevation: 8,
    shadowColor: '#5D6DFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    borderWidth: 1.5,
    borderColor: '#5D6DFF',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  }
});