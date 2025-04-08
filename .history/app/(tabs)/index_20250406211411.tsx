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
        {/* Header with title */}Row}>
        <View style={styles.topBar}>xt}>COSMIC QUEST</Text>
          <View style={styles.titleRow}>Button}>
            <Text style={styles.logoText}>COSMIC QUEST</Text>
            <TouchableOpacity style={styles.iconButton}>
              <Feather name="user" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>es.container} contentContainerStyle={styles.content}>
e actions container */}
        {/* Game actions container */}        <View style={styles.actionsContainer}>
        <View style={styles.actionsContainer}>
          <TouchableOpacity roundColor: 'rgba(255, 255, 255, 0.12)' }]} 
            style={[styles.mainButton, { backgroundColor: 'rgba(255, 255, 255, 0.12)' }]} reateGame}
            onPress={handleCreateGame}
          >" size={24} color={colors.tertiary} style={styles.buttonIcon} />
            <Feather name="plus-circle" size={24} color={colors.tertiary} style={styles.buttonIcon} /> <Text style={[styles.mainButtonText, { color: colors.tertiary }]}>Créer une partie</Text>
            <Text style={[styles.mainButtonText, { color: colors.tertiary }]}>Créer une partie</Text>
          </TouchableOpacity>
          .divider}>
          <View style={styles.divider}>  <View style={[styles.dividerLine, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
            <View style={[styles.dividerLine, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />rText, { color: colors.tertiary, opacity: 0.7 }]}>ou</Text>
            <Text style={[styles.dividerText, { color: colors.tertiary, opacity: 0.7 }]}>ou</Text>
            <View style={[styles.dividerLine, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]} />
          </View>
tyle={styles.codeInputContainer}>
          <View style={styles.codeInputContainer}>            <TextInput 
            <TextInput 
              style={[styles.codeInput, { undColor: 'rgba(10, 2, 31, 0.8)', 
                backgroundColor: 'rgba(10, 2, 31, 0.8)', 
                color: colors.tertiary,
                borderColor: 'rgba(120, 86, 255, 0.3)'
              }]}  
              placeholder="Entre le code de la partie" eholderTextColor="rgba(255, 255, 255, 0.5)" 
              placeholderTextColor="rgba(255, 255, 255, 0.5)" 
            />
            <TouchableOpacity style={[styles.joinButton, { backgroundColor: '#6C41EC' }]} 
              style={[styles.joinButton, { backgroundColor: '#6C41EC' }]} oinGame}
              onPress={handleJoinGame}
            >ht" size={24} color={colors.tertiary} />
              <Feather name="arrow-right" size={24} color={colors.tertiary} />/TouchableOpacity>
            </TouchableOpacity>
          </View>
        </View>
        e types container */}
        {/* Game types container */}<View style={styles.typeContainer}>
        <View style={styles.typeContainer}>styles.typeCard, { backgroundColor: '#162B56' }]}>
          <TouchableOpacity style={[styles.typeCard, { backgroundColor: '#162B56' }]}> { color: colors.tertiary }]}>Culture Générale</Text>
            <Text style={[styles.typeTitle, { color: colors.tertiary }]}>Culture Générale</Text>
          </TouchableOpacity>
          tyle={[styles.typeCard, { backgroundColor: '#5E1A30' }]}>
          <TouchableOpacity style={[styles.typeCard, { backgroundColor: '#5E1A30' }]}>  <Text style={[styles.typeTitle, { color: colors.tertiary }]}>Questions Hot</Text>
            <Text style={[styles.typeTitle, { color: colors.tertiary }]}>Questions Hot</Text>
            <View style={[styles.lockedTag, { backgroundColor: "rgba(0,0,0,0.6)" }]}>
              <Feather name="lock" size={16} color={colors.tertiary} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>dient>
    </LinearGradient>
  )
}
onst styles = StyleSheet.create({
const styles = StyleSheet.create({  backgroundContainer: {
  backgroundContainer: {
    flex: 1,
  }, {
  topBar: {flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 10,padding: 24,
    borderBottomWidth: 1,op: 60,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleRow: {padding: 10,
    flexDirection: "row",undColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: "space-between",
    alignItems: "center",5, 255, 0.2)',
  },
  logoText: {
    fontSize: 18,flexDirection: 'row',
    fontWeight: "bold", 'space-between',
    letterSpacing: 1,
    color: "#FFFFFF",
  },: {
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', {
    justifyContent: "center",
    alignItems: "center",
  },
  container: {flexDirection: "row",
    flex: 1,: "space-between",
  },: "center",
  content: {m: 40,
    padding: 24,
    paddingTop: 20,
  },n",
  // Supprimer ou commenter les styles header, titleContainer, title et subtitle qui ne sont plus utilisés
  // header: {
  //   flexDirection: "row",
  //   justifyContent: "space-between",fontWeight: "bold",
  //   alignItems: "center",ng: 1,
  //   marginBottom: 40,
  // },
  // titleContainer: {
  //   flexDirection: "column",
  // },
  // title: {
  //   fontSize: 32,ofileButton: {
  //   fontWeight: "bold",
  //   letterSpacing: 1,
  // },borderRadius: 25,
  // subtitle: { "center",
  //   fontSize: 16,center",
  //   opacity: 0.8,
  //   letterSpacing: 0.5,tionsContainer: {
  // },ttom: 40,
  // profileButton: {
  //   width: 50,
  //   height: 50,
  //   borderRadius: 25,height: 60,
  //   justifyContent: "center",n: "row",
  //   alignItems: "center",ms: "center",
  // },tent: "center",
  actionsContainer: {marginBottom: 20,
    marginBottom: 40,
  },
  mainButton: {marginRight: 10,
    borderRadius: 30,
    height: 60,
    flexDirection: "row",
    alignItems: "center",fontWeight: "bold",
    justifyContent: "center",
    marginBottom: 20,
  },ow",
  buttonIcon: {"center",
    marginRight: 10, 20,
  },
  mainButtonText: {viderLine: {
    fontSize: 18,
    fontWeight: "bold",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,r: {
  },flexDirection: "row",
  dividerLine: {30,
    flex: 1,
    height: 1, {
  },flex: 1,
  dividerText: {ius: 30,
    marginHorizontal: 15, 15,
  },,
  codeInputContainer: {
    flexDirection: "row",
    marginBottom: 30,
  },
  codeInput: {height: 60,
    flex: 1,us: 20,
    borderRadius: 30,t: "center",
    padding: 15,",
    fontSize: 16,
    borderWidth: 1,
  },r: {
  joinButton: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  typeContainer: { justifyContent: "center",
    flexDirection: "row",  position: "relative",
    gap: 15,  },
  },  typeTitle: {


























})  }    alignItems: "center",    justifyContent: "center",    borderRadius: 15,    height: 30,    width: 30,    right: 10,    top: 10,    position: "absolute",  lockedTag: {  },    textAlign: "center",    fontWeight: "bold",    fontSize: 18,  typeTitle: {  },    position: "relative",    justifyContent: "center",    padding: 20,    borderRadius: 20,    height: 120,    flex: 1,  typeCard: {    fontSize: 18,
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

