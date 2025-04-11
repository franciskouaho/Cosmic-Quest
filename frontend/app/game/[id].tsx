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
import { generateQuestionObject } from '../../utils/questionGenerator';

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
  
  // Simuler l'obtention des données du jeu (remplacé par des appels API dans le futur)
  useEffect(() => {
    // Dans un vrai backend, on récupérerait ces données depuis un serveur
    const fetchGameData = async () => {
      try {
        // Tentative de récupération des données depuis le backend
        try {
          const gameData = await gameService.getGameState(id as string);
          // Initialiser le jeu avec les données du serveur
          // ... code pour initialiser avec gameData ...
          setIsReady(true);
          return;
        } catch (apiError) {
          console.log('Impossible de charger les données depuis le serveur, utilisation du mode hors ligne', apiError);
          // Continuer avec la génération locale de données
        }

        // Simulation d'un chargement de données
        setTimeout(() => {
          // Créer des joueurs fictifs + le joueur actuel
          const mockPlayers: Player[] = [
            { id: '1', name: 'Francis', avatar: 'avatar1', isReady: true },
            { id: '2', name: 'Sophie', avatar: 'avatar2', isReady: true },
            { id: '3', name: 'Thomas', avatar: 'avatar3', isReady: true },
            { id: '4', name: 'Emma', avatar: 'avatar4', isReady: true },
          ];
          
          // Identifier le joueur courant dans la liste et définir s'il est l'hôte
          const currentPlayer = mockPlayers.find(p => p.id === '1') || mockPlayers[0];
          setIsHost(currentPlayer.id === '1');
          
          // Initialiser les scores à 0 pour tous les joueurs
          const initialScores: Record<string, number> = {};
          mockPlayers.forEach(player => {
            initialScores[player.id] = 0;
          });
          
          // Choisir un joueur cible au hasard (différent du joueur courant si possible)
          const eligiblePlayers = mockPlayers.filter(p => p.id !== currentPlayer.id);
          const targetPlayer = eligiblePlayers.length > 0 
            ? eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)] 
            : mockPlayers[Math.floor(Math.random() * mockPlayers.length)];
          
          // Générer une question aléatoire avec notre nouvelle fonction
          const questionObj = gameService.generateOfflineQuestion('standard', targetPlayer);
          
          setGameState({
            ...gameState,
            phase: GamePhase.QUESTION,
            players: mockPlayers,
            targetPlayer: targetPlayer,
            currentQuestion: questionObj,
            scores: initialScores,
            theme: 'standard',
          });
          
          setIsReady(true);
        }, 1500);
      } catch (error) {
        console.error('Erreur lors du chargement des données du jeu', error);
        Alert.alert('Erreur', 'Impossible de charger les données du jeu');
      }
    };
    
    fetchGameData();
  }, [id]);
  
  // Gérer la soumission d'une réponse
  const handleSubmitAnswer = async (answer: string) => {
    if (!user || !gameState.currentQuestion) return;
    
    // Ajouter un log pour déboguer
    console.log("Tentative de soumission de réponse:", answer);
    
    try {
      // Essayer d'envoyer la réponse au serveur
      await gameService.submitAnswer(id as string, answer);
      
      // En mode connecté, on attendrait que le serveur nous notifie du changement d'état
      // Mais pour le mode hors ligne, on simule la transition

      const newAnswer: Answer = {
        playerId: user.id || '1', // Utilisez l'ID réel de l'utilisateur
        content: answer,
        votes: 0,
      };
      
      // Simuler la transition vers la phase suivante (attente)
      Alert.alert("Réponse envoyée", "En attente des autres joueurs...");
      
      // Simuler que tous les joueurs ont répondu
      setTimeout(() => {
        // Simuler les réponses des autres joueurs
        const mockAnswers: Answer[] = [
          newAnswer,
          { playerId: '2', content: 'Une réponse de Sophie', votes: 0 },
          { playerId: '3', content: 'Une réponse de Thomas', votes: 0 },
          { playerId: '4', content: 'Une réponse d\'Emma', votes: 0 },
        ];
        
        setGameState(prev => ({
          ...prev,
          phase: gameState.targetPlayer?.id === (user.id || '1') 
            ? GamePhase.VOTE 
            : GamePhase.WAITING,
          answers: mockAnswers,
        }));
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de la soumission de la réponse:", error);
      Alert.alert("Erreur", "Impossible d'envoyer votre réponse. Veuillez réessayer.");
    }
  };
  
  // Gérer le vote pour une réponse préférée
  const handleVote = async (answerId: string) => {
    if (!gameState.targetPlayer || !gameState.currentQuestion) return;
    
    try {
      // Essayer d'envoyer le vote au serveur
      if (gameState.currentQuestion.id) {
        await gameService.submitVote(id as string, answerId, gameState.currentQuestion.id);
      }
      
      // Mise à jour locale des votes
      const updatedAnswers = gameState.answers.map(answer => 
        answer.playerId === answerId 
          ? { ...answer, votes: answer.votes + 1 } 
          : answer
      );
      
      // Mise à jour des scores
      const updatedScores = { ...gameState.scores };
      updatedScores[answerId] = (updatedScores[answerId] || 0) + 1;
      
      setGameState(prev => ({
        ...prev,
        answers: updatedAnswers,
        scores: updatedScores,
        phase: GamePhase.RESULTS,
      }));
    } catch (error) {
      console.error("Erreur lors du vote:", error);
      Alert.alert("Erreur", "Impossible d'enregistrer votre vote. Veuillez réessayer.");
    }
  };
  
  // Générer une nouvelle question
  const generateNewQuestion = async (theme: string, targetPlayer: Player) => {
    try {
      // Essayer d'abord de récupérer une question depuis le backend
      const questionFromAPI = await gameService.getRandomQuestion(theme, targetPlayer.name);
      
      if (questionFromAPI) {
        console.log('Question récupérée depuis le backend');
        return questionFromAPI;
      } else {
        // Si le backend ne répond pas, utiliser la génération locale
        console.log('Utilisation de la génération locale de questions');
        return gameService.generateOfflineQuestion(theme, targetPlayer);
      }
    } catch (error) {
      console.error('Erreur lors de la génération de question:', error);
      // En cas d'erreur, utiliser la génération locale
      return gameService.generateOfflineQuestion(theme, targetPlayer);
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
      // Essayer d'envoyer la demande de tour suivant au serveur
      await gameService.nextRound(id as string);
      
      // Pour le mode hors ligne, simuler le passage au tour suivant
      
      // Sélectionner un nouveau joueur cible et générer une nouvelle question
      const eligiblePlayers = gameState.players.filter(p => p.id !== (user?.id || '1'));
      const targetPlayer = eligiblePlayers.length > 0 
        ? eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)] 
        : gameState.players[Math.floor(Math.random() * gameState.players.length)];
      
      // Utiliser notre nouvelle fonction pour générer une question
      const questionObj = await generateNewQuestion(gameState.theme, targetPlayer);
      
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.QUESTION,
        currentRound: prev.currentRound + 1,
        targetPlayer: targetPlayer,
        currentQuestion: questionObj,
        answers: [],
      }));
    } catch (error) {
      console.error("Erreur lors du passage au tour suivant:", error);
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
        return <LoadingOverlay message="Préparation de la partie..." />;
        
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
            message={`${gameState.targetPlayer?.name} est en train de lire les réponses...`}
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
        <LoadingOverlay message="Chargement de la partie..." />
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
