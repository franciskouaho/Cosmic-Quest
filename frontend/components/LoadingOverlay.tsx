import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Composant de repli qui redirige vers le composant dans le bon dossier
// (au cas où quelque part dans le code il y aurait une importation directe)
export default function LoadingOverlay({ message = 'Chargement...' }) {
  // Utiliser directement le composant du chemin correct
  const ActualLoadingOverlay = require('./common/LoadingOverlay').default;
  
  console.warn('⚠️ Importation obsolète: Utiliser @/components/common/LoadingOverlay au lieu de @/components/LoadingOverlay');
  
  return <ActualLoadingOverlay message={message} />;
}
