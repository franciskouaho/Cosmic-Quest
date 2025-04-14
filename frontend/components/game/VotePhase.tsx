import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Answer, Question } from '../../types/gameTypes';
import GameTimer from './GameTimer';

interface VotePhaseProps {
  answers: Answer[];
  question: Question;
  onVote: (answerId: string) => void;
  timer?: {
    duration: number;
    startTime: number;
  } | null;
  isTargetPlayer?: boolean;
  hasVoted?: boolean;
}

const VotePhase: React.FC<VotePhaseProps> = ({ 
  answers, 
  question, 
  onVote, 
  timer,
  isTargetPlayer = false,
  hasVoted = false
}: VotePhaseProps) => {
  const [votableAnswers, setVotableAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  console.log(`🔍 VotePhase rendu: isTarget=${isTargetPlayer}, hasVoted=${hasVoted}, answers=${answers?.length || 0}`);
  
  useEffect(() => {
    try {
      if (!Array.isArray(answers)) {
        console.error('⚠️ VotePhase: answers n\'est pas un tableau:', answers);
        setError('Problème avec les données des réponses');
        setVotableAnswers([]);
        setLoading(false);
        return;
      }
      
      const filtered = answers.filter(answer => !answer.isOwnAnswer);
      console.log(`🎮 VotePhase: ${filtered.length}/${answers.length} réponses filtrées pour le vote`);
      
      if (filtered.length === 0 && answers.length > 0) {
        console.warn('⚠️ VotePhase: toutes les réponses ont été filtrées!');
      }
      
      setVotableAnswers(filtered);
      setLoading(false);
      
      if (filtered.length > 0) {
        filtered.forEach((answer, i) => {
          console.log(`🎮 Réponse ${i+1}: ID=${answer.id}, joueur=${answer.playerName}, contenu="${answer.content.substring(0, 30)}..."`);
        });
      }
    } catch (error) {
      console.error('❌ Erreur lors du filtrage des réponses:', error);
      setError('Une erreur est survenue lors du chargement des réponses');
      setLoading(false);
    }
  }, [answers]);

  if (!isTargetPlayer) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>En attente du vote</Text>
        <Text style={styles.messageText}>
          {question?.targetPlayer?.name || 'La cible'} est en train de voter pour la meilleure réponse.
        </Text>
        {timer && timer.duration > 0 && (
          <View style={styles.timerWrapper}>
            <GameTimer 
              duration={timer.duration} 
              startTime={timer.startTime} 
              alertThreshold={10}
            />
          </View>
        )}
      </View>
    );
  }

  if (hasVoted) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>Vote enregistré!</Text>
        <Text style={styles.messageText}>En attente des résultats...</Text>
        {timer && <GameTimer duration={timer.duration} startTime={timer.startTime} />}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5D6DFF" />
        <Text style={styles.loadingText}>Chargement des réponses...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.messageContainer}>
        <Text style={styles.messageTitle}>Une erreur est survenue</Text>
        <Text style={styles.messageText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => setError(null)}>
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>C'est à vous de voter!</Text>
      </View>

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
          Cette question vous concerne. Choisissez votre réponse préférée!
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
    backgroundColor: 'rgba(105, 78, 214, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  targetMessage: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
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
});

export default VotePhase;
