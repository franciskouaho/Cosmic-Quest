import React, { useRef, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

type RulesDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

const RulesDrawer = ({ visible, onClose }: RulesDrawerProps) => {
  const slideAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnimation]);

  const translateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
    extrapolate: 'clamp',
  });

  if (!visible) return null;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <Animated.View 
          style={[
            styles.container, 
            { transform: [{ translateY }] }
          ]}
        >
          <LinearGradient
            colors={['#321a5e', '#1a0933']}
            style={styles.gradient}
          >
            <View style={styles.header}>
              <View style={styles.headerHandle} />
              <Text style={styles.title}>RÈGLES DU JEU</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color="white" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              <Text style={styles.subtitle}>PLUSIEURS TÉLÉPHONES</Text>
              
              <View style={styles.ruleCard}>
                <View style={styles.iconContainer}>
                  <Text style={styles.emoji}>🎲</Text>
                </View>
                <Text style={styles.ruleText}>
                  Un joueur est désigné aléatoirement.
                </Text>
              </View>
              
              <View style={styles.ruleCard}>
                <View style={styles.iconContainer}>
                  <Text style={styles.emoji}>🤔</Text>
                </View>
                <Text style={styles.ruleText}>
                  Tous les joueurs reçoivent la même question concernant le joueur visé.
                </Text>
              </View>
              
              <View style={styles.ruleCard}>
                <View style={styles.iconContainer}>
                  <Text style={styles.emoji}>👀</Text>
                </View>
                <Text style={styles.ruleText}>
                  Chaque joueur y répond de manière anonyme.
                </Text>
              </View>
              
              <View style={styles.ruleCard}>
                <View style={styles.iconContainer}>
                  <Text style={styles.emoji}>📦</Text>
                </View>
                <Text style={styles.ruleText}>
                  Le joueur désigné lit toutes les réponses et vote pour sa préférée.
                </Text>
              </View>

              <View style={styles.scoreContainer}>
                <View>
                  <Text style={styles.scoreText}>
                    Le joueur dont la réponse est choisie :
                  </Text>
                </View>
                <View>
                  <Text style={styles.pointsText}>+1 pt.</Text>
                </View>
              </View>
              
              <View style={styles.footer} />
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(93, 109, 255, 0.5)',
    maxHeight: '80%',
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  headerHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    position: 'absolute',
    top: -20,
    left: '50%',
    marginLeft: -20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    flex: 1,
  },
  content: {
    paddingHorizontal: 8,
    maxHeight: '100%',
  },
  subtitle: {
    fontSize: 16,
    color: '#b3b3b3',
    textAlign: 'center',
    marginBottom: 20,
  },
  ruleCard: {
    backgroundColor: '#19102e',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 28,
  },
  ruleText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 10,
  },
  scoreText: {
    color: 'white',
    fontSize: 14,
  },
  pointsText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  },
  footer: {
    height: 30,
  },
});

export default RulesDrawer;