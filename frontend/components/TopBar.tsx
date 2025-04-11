import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';

type TopBarProps = {
  showNotificationButton?: boolean;
  rightButtons?: React.ReactNode;
};

export default function TopBar({ 
  showNotificationButton = true,
  rightButtons
}: TopBarProps) {
  const router = useRouter();
  const { user } = useAuth();

  const handleNotificationPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/notifications');
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>Bonjour </Text>
          <Text style={styles.userName}>{user?.displayName || user?.username}</Text>
        </View>
      </View>
      
      <View style={styles.rightContainer}>
       <TouchableOpacity style={styles.iconButton} onPress={handleNotificationPress}>
            <Feather name="bell" size={22} color="#FFFFFF" />
          </TouchableOpacity>
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