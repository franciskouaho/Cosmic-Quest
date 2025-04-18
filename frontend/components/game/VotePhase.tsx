import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Answer } from '@/types/gameTypes';
import GameTimer from './GameTimer';

type VotePhaseProps = {
  answers: Answer[];
  question: {
    id: number | string;
    text: string;
  };
  onVote: (answerId: string) => void;
  timer?: {
    duration: number;
    startTime: number;
  } | null;
  isTargetPlayer: boolean;
  hasVoted: boolean;
  allPlayersVoted?: boolean;
};

const VotePhase: React.FC<VotePhaseProps> = ({ 
  answers, 
  question, 
  onVote, 
  timer,
  isTargetPlayer = false,
  hasVoted = false,
  allPlayersVoted = false
}: VotePhaseProps) => {
  // Log de débogage pour tracer les états
  useEffect(() => {
    console.log(`🎯 VotePhase: isTargetPlayer=${isTargetPlayer}, hasVoted=${hasVoted}, allPlayersVoted=${allPlayersVoted}, réponses disponibles=${answers.length}`);
  }, [isTargetPlayer, hasVoted, allPlayersVoted, answers.length]);
  
  // Filtrer les réponses pour ne pas afficher les propres réponses du joueur
  const votableAnswers = answers.filter(answer => !answer.isOwnAnswer);
  
  // Si tout le monde a voté, afficher un message d'attente
  if (allPlayersVoted) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>Tous les votes sont enregistrés</Text>
        <Text style={styles.messageText}>
          Attendez que le jeu passe au tour suivant.
        </Text>
        {timer && (
          <View style={styles.timerWrapper}>
            <GameTimer 
              duration={timer.duration}
              startTime={timer.startTime}
            />
          </View>
        )}
      </View>
    );
  }

  // Si l'utilisateur n'est pas la cible, ou a déjà voté, afficher un message d'attente
  if (!isTargetPlayer || hasVoted) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>
          {hasVoted ? "Vote enregistré !" : "En attente du vote"}
        </Text>
        <Text style={styles.messageText}>
          {hasVoted 
            ? "Votre vote a été enregistré. Attendons que tout le monde termine." 
            : "Attendez que la personne ciblée vote pour sa réponse préférée."}
        </Text>
        {timer && (
          <View style={styles.timerWrapper}>
            <GameTimer 
              duration={timer.duration}
              startTime={timer.startTime}
            />
          </View>
        )}
      </View>
    );
  }

  // Cas où l'utilisateur est la cible mais n'a pas encore de réponses à évaluer
  if (votableAnswers.length === 0) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>En attente des réponses</Text>
        <Text style={styles.messageText}>
          Les autres joueurs sont en train de répondre à votre question.
          Vous pourrez voter dès que les réponses seront disponibles.
        </Text>
        <ActivityIndicator size="large" color="#694ED6" style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {timer && (
        <View style={styles.timerContainer}>
          <GameTimer 
            duration={timer.duration}
            startTime={timer.startTime}
          />
        </View>
      )}

      <View style={styles.targetMessageContainer}>
        <Text style={styles.targetMessage}>
          Cette question vous concerne. Vous devez choisir votre réponse préférée!
        </Text>
        <Text style={styles.targetMessageHighlight}>
          Votez maintenant ou le jeu passera automatiquement au tour suivant!
        </Text>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          <LinearGradient
            colors={['rgba(105, 78, 214, 0.3)', 'rgba(105, 78, 214, 0.1)']}
            style={styles.cardGradient}
          >
            <Text style={styles.questionText}>{question.text}</Text>
          </LinearGradient>
        </View>

        <Text style={styles.sectionTitle}>Les réponses des autres joueurs</Text>

        {votableAnswers.length > 0 ? (
          votableAnswers.map((answer) => (
            <TouchableOpacity 
              key={answer.id.toString()}
              style={styles.answerCard}
              onPress={() => onVote(answer.id.toString())}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.answerGradient}
              >
                <Text style={styles.answerText}>{answer.content}</Text>
                <View style={styles.voteButton}>
                  <MaterialCommunityIcons name="heart" size={24} color="#ff6b6b" />
                  <Text style={styles.voteText}>Choisir</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.noAnswersContainer}>
            <Text style={styles.noAnswersText}>
              {answers.length > 0 
                ? 'Aucune réponse disponible pour voter' 
                : 'Personne n\'a encore répondu à cette question'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  timerContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  questionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 25,
  },
  cardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#b3a5d9',
    marginBottom: 16,
  },
  answerCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  answerGradient: {
    padding: 16,
    borderRadius: 12,
  },
  answerText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  voteText: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  noAnswersContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  noAnswersText: {
    color: '#b3a5d9',
    textAlign: 'center',
    fontSize: 16,
  },
  targetMessageContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ff6b6b'
  },
  targetMessage: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold'
  },
  targetMessageHighlight: {
    color: '#ffcc00',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
  },
  messageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffcc00',
    textAlign: 'center',
    marginBottom: 10,
  },
  messageText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#5D6DFF',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#5D6DFF',
    borderRadius: 20,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  timerWrapper: {
    width: '100%',
    marginTop: 20,
  },
  loader: {
    marginTop: 20
  }
});

export default VotePhase;
