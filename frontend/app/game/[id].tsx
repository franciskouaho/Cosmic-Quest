import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import QuestionPhase from '../../components/game/QuestionPhase';
import AnswerPhase from '../../components/game/AnswerPhase';
import VotePhase from '../../components/game/VotePhase';
import ResultsPhase from '../../components/game/ResultsPhase';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import { useAuth } from '../../contexts/AuthContext';
import { Player, GamePhase, GameState, Answer, Question } from '../../types/gameTypes';
import { gameService } from '../../services/queries/game';
import { SocketService } from '../../services/socketService';
import axios from 'axios';

export default function GameScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [gameState, setGameState] = useState<GameState>({
    phase: GamePhase.LOADING,
    currentRound: 1,
    totalRounds: 5,
    targetPlayer: null,
    currentQuestion: null,
    answers: [],
    players: [],
    scores: {},
    theme: 'standard',
  });
  
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  
  // Charger les données du jeu depuis le backend
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        console.log(`🎮 Récupération des données du jeu ${id}...`);
        
        const gameData = await gameService.getGameState(id as string);
        console.log('✅ Données du jeu récupérées:', gameData);
        
        // Rejoindre le canal de jeu via WebSocket
        SocketService.joinGameChannel(id as string);
        
        // Transformer les données reçues en format compatible avec notre état
        const currentUser = user?.id;
        
        // Extraire les données du joueur cible et de la question actuelle
        const targetPlayer = gameData.currentQuestion?.targetPlayer 
          ? {
              id: gameData.currentQuestion.targetPlayer.id.toString(),
              name: gameData.currentQuestion.targetPlayer.displayName || gameData.currentQuestion.targetPlayer.username,
              avatar: gameData.currentQuestion.targetPlayer.avatar,
            }
          : null;
        
        // Formater la question actuelle
        const currentQuestion = gameData.currentQuestion 
          ? {
              id: gameData.currentQuestion.id,
              text: gameData.currentQuestion.text,
              theme: gameData.game.gameMode,
              roundNumber: gameData.currentQuestion.roundNumber,
            }
          : null;
        
        // Formater les réponses
        const answers = gameData.answers 
          ? gameData.answers.map(answer => ({
              playerId: answer.playerId.toString(),
              content: answer.content,
              votes: answer.votesCount || 0,
            }))
          : [];
        
        // Formater les joueurs
        const players = gameData.players
          ? gameData.players.map(player => ({
              id: player.id.toString(),
              name: player.displayName || player.username,
              avatar: player.avatar || '',
              isHost: player.isHost,
              score: gameData.game.scores[player.id] || 0,
            }))
          : [];
        
        // Déterminer si l'utilisateur est l'hôte
        setIsHost(gameData.room.hostId === currentUser);
        
        // Déterminer la phase de jeu à partir des données du backend
        let phase;
        switch(gameData.game.currentPhase) {
          case 'question':
            phase = GamePhase.QUESTION;
            break;
          case 'answer':
            phase = GamePhase.ANSWER;
            break;
          case 'vote':
            phase = GamePhase.VOTE;
            break;
          case 'results':
            phase = GamePhase.RESULTS;
            break;
          case 'waiting':
            phase = GamePhase.WAITING;
            break;
          default:
            phase = GamePhase.QUESTION;
        }
        
        // Déterminer si l'utilisateur est le joueur cible
        const isTargetPlayer = gameData.currentUserState?.isTargetPlayer;
        
        // Définir l'état du jeu avec les données du backend
        setGameState({
          phase: isTargetPlayer && phase === GamePhase.ANSWER ? GamePhase.WAITING : phase,
          currentRound: gameData.game.currentRound,
          totalRounds: gameData.game.totalRounds,
          targetPlayer: targetPlayer,
          currentQuestion: currentQuestion,
          answers: answers,
          players: players,
          scores: gameData.game.scores,
          theme: gameData.game.gameMode,
        });
        
        setIsReady(true);
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des données du jeu:', error);
        
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setLoadingError('Partie introuvable. Elle est peut-être terminée ou n\'existe pas.');
        } else if (axios.isAxiosError(error) && error.response?.status === 401) {
          setLoadingError('Session expirée. Veuillez vous reconnecter.');
          // Redirection vers la page de connexion après un délai
          setTimeout(() => {
            router.replace('/auth/login');
          }, 2000);
        } else {
          setLoadingError('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
        }
      }
    };
    
    fetchGameData();
    
    // Mettre en place un intervalle pour rafraîchir régulièrement les données
    const refreshInterval = setInterval(fetchGameData, 5000); // Toutes les 5 secondes
    
    // Nettoyage à la fermeture du composant
    return () => {
      clearInterval(refreshInterval);
      // Quitter le canal de jeu WebSocket
      if (id) {
        SocketService.leaveGameChannel(id as string);
      }
    };
  }, [id, user, router]);
  
  // Gérer la soumission d'une réponse
  const handleSubmitAnswer = async (answer: string) => {
    if (!user || !gameState.currentQuestion) return;
    
    try {
      console.log("🎮 Tentative de soumission de réponse...");
      
      // Envoyer la réponse au serveur
      await gameService.submitAnswer(id as string, answer);
      
      // Afficher un message de confirmation
      Alert.alert("Réponse envoyée", "En attente des autres joueurs...");
      
      // Passer en phase d'attente
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.WAITING,
      }));
    } catch (error) {
      console.error("❌ Erreur lors de la soumission de la réponse:", error);
      Alert.alert("Erreur", "Impossible d'envoyer votre réponse. Veuillez réessayer.");
    }
  };
  
  // Gérer le vote pour une réponse préférée
  const handleVote = async (answerId: string) => {
    if (!gameState.targetPlayer || !gameState.currentQuestion) return;
    
    try {
      console.log("🎮 Tentative de vote...");
      
      // Envoyer le vote au serveur
      if (gameState.currentQuestion.id) {
        await gameService.submitVote(id as string, answerId, gameState.currentQuestion.id);
      }
      
      // Afficher un message de confirmation
      Alert.alert("Vote enregistré", "En attente des résultats...");
      
      // Passer en phase d'attente des résultats
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.WAITING,
      }));
    } catch (error) {
      console.error("❌ Erreur lors du vote:", error);
      Alert.alert("Erreur", "Impossible d'enregistrer votre vote. Veuillez réessayer.");
    }
  };
  
  // Passer au tour suivant
  const handleNextRound = async () => {
    if (gameState.currentRound >= gameState.totalRounds) {
      // Fin de la partie
      router.push(`/game/results/${id}`);
      return;
    }
    
    try {
      console.log("🎮 Tentative de passage au tour suivant...");
      
      // Envoyer la demande de tour suivant au serveur
      await gameService.nextRound(id as string);
      
      // Afficher un message de chargement
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.LOADING,
      }));
    } catch (error) {
      console.error("❌ Erreur lors du passage au tour suivant:", error);
      Alert.alert("Erreur", "Impossible de passer au tour suivant. Veuillez réessayer.");
    }
  };
  
  // Quitter la partie
  const handleQuitGame = () => {
    Alert.alert(
      'Quitter la partie',
      'Êtes-vous sûr de vouloir quitter cette partie ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: () => router.push('/'),
        },
      ]
    );
  };
  
  // Rendu conditionnel en fonction de la phase de jeu
  const renderGamePhase = () => {
    switch (gameState.phase) {
      case GamePhase.LOADING:
        return <LoadingOverlay message="Préparation de la partie" />;
        
      case GamePhase.QUESTION:
        return (
          <QuestionPhase 
            question={gameState.currentQuestion!}
            targetPlayer={gameState.targetPlayer!}
            onSubmit={handleSubmitAnswer}
            round={gameState.currentRound}
            totalRounds={gameState.totalRounds}
          />
        );
        
      case GamePhase.WAITING:
        return (
          <LoadingOverlay 
            message={`Attente des autres joueurs...`}
          />
        );
        
      case GamePhase.VOTE:
        return (
          <VotePhase 
            answers={gameState.answers}
            question={gameState.currentQuestion!}
            onVote={handleVote}
          />
        );
        
      case GamePhase.RESULTS:
        return (
          <ResultsPhase 
            answers={gameState.answers}
            scores={gameState.scores}
            players={gameState.players}
            question={gameState.currentQuestion!}
            targetPlayer={gameState.targetPlayer!}
            onNextRound={handleNextRound}
            isLastRound={gameState.currentRound >= gameState.totalRounds}
          />
        );
        
      default:
        return <Text>Erreur: Phase de jeu inconnue</Text>;
    }
  };
  
  if (!isReady) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a0933', '#321a5e']}
          style={styles.background}
        />
        <LoadingOverlay message={loadingError || "Chargement de la partie..."} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['#1a0933', '#321a5e']}
        style={styles.background}
      />
      
      <View style={styles.content}>
        {renderGamePhase()}
      </View>
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
    justifyContent: 'center',
    padding: 20,
    paddingTop: 40,
  },
});
