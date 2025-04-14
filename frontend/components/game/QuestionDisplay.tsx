import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Question } from '../../types/gameTypes';

interface QuestionDisplayProps {
  question: Question;
  debugMode?: boolean;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ 
  question,
  debugMode = __DEV__ // Actif uniquement en mode développement par défaut
}) => {
  // Déterminer la source de la question basée sur son ID
  const isServerQuestion = question.id && !question.id.includes('.');
  
  return (
    <View style={styles.container}>
      <Text style={styles.questionText}>{question.text}</Text>
      
      {debugMode && (
        <View style={[
          styles.sourceIndicator, 
          isServerQuestion ? styles.serverSource : styles.fallbackSource
        ]}>
          <Text style={styles.sourceText}>
            {isServerQuestion 
              ? `Question du serveur (ID: ${question.id})` 
              : 'Question locale (fallback)'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    marginBottom: 15,
  },
  questionText: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  sourceIndicator: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  serverSource: {
    backgroundColor: 'rgba(46, 213, 115, 0.3)',
  },
  fallbackSource: {
    backgroundColor: 'rgba(255, 71, 87, 0.3)',
  },
  sourceText: {
    fontSize: 10,
    color: 'white',
    textAlign: 'center',
  }
});

export default QuestionDisplay;
