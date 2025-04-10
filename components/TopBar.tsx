import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

type TopBarProps = {
  title?: string;
  userName?: string;
  showBackButton?: boolean;
  showProfileButton?: boolean;
  showNotificationButton?: boolean;
  onBackPress?: () => void;
};

export default function TopBar({ 
  title, 
  userName,
  showBackButton = false,
  showProfileButton = true,
  showNotificationButton = true,
  onBackPress 
}: TopBarProps) {
  const router = useRouter();

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };


  const handleNotificationPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/notifications');
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
              
        <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>Bonjour </Text>
            <Text style={styles.userName}>{userName || "Francis"}</Text>
        </View>
      </View>
      
      <View style={styles.rightContainer}>
        {showNotificationButton && (
          <TouchableOpacity style={styles.iconButton} onPress={handleNotificationPress}>
            <Feather name="bell" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 6,
    marginTop: 50,
    height: 48,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(93, 109, 255, 0.3)',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  greetingContainer: {
    flexDirection: 'row',
    marginLeft: 10,
    alignItems: 'center',
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  }
});