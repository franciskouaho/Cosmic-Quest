import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SOCKET_URL } from '@/config/axios';
import SocketService from '@/services/socketService';
import { testSocketConnection, checkSocketStatus } from '@/utils/socketTester';
import { router } from 'expo-router';

export default function WebSocketDebugScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [isLoadingServerInfo, setIsLoadingServerInfo] = useState(false);

  // Intercepter les logs pour les afficher à l'écran
  useEffect(() => {
    const oldConsoleLog = console.log;
    const oldConsoleError = console.error;

    console.log = (...args) => {
      oldConsoleLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev, `LOG: ${message}`]);
    };

    console.error = (...args) => {
      oldConsoleError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      setLogs(prev => [...prev, `ERROR: ${message}`]);
    };

    return () => {
      console.log = oldConsoleLog;
      console.error = oldConsoleError;
    };
  }, []);

  // Vérifier l'état de la connexion
  useEffect(() => {
    try {
      const socket = SocketService.getInstance();
      
      setIsConnected(socket.connected);
      setSocketId(socket.id || null);
      
      const onConnect = () => {
        setIsConnected(true);
        setSocketId(socket.id);
        setLogs(prev => [...prev, `ÉVÉNEMENT: Connecté au socket (ID: ${socket.id})`]);
      };
      
      const onDisconnect = (reason: string) => {
        setIsConnected(false);
        setLogs(prev => [...prev, `ÉVÉNEMENT: Déconnecté (raison: ${reason})`]);
      };
      
      const onError = (error: any) => {
        setLogs(prev => [...prev, `ÉVÉNEMENT: Erreur socket (${error.message || JSON.stringify(error)})`]);
      };
      
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('error', onError);
      
      // Si déjà connecté, mettre à jour l'état
      if (socket.connected) {
        setIsConnected(true);
        setSocketId(socket.id);
      }
      
      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('error', onError);
      };
    } catch (error) {
      setLogs(prev => [...prev, `ERREUR: ${error.message}`]);
      setIsConnected(false);
    }
  }, []);

  // Test de connexion WebSocket
  const handleTestConnection = async () => {
    setIsTesting(true);
    setLogs([]);
    
    try {
      testSocketConnection();
    } catch (error) {
      setLogs(prev => [...prev, `ERREUR: ${error.message}`]);
    }
    
    setTimeout(() => setIsTesting(false), 5000);
  };

  // Récupérer les informations du serveur WebSocket
  const fetchServerInfo = async () => {
    setIsLoadingServerInfo(true);
    
    try {
      const response = await fetch(`${SOCKET_URL}/api/v1/ws/status`);
      const data = await response.json();
      setServerInfo(data);
      setLogs(prev => [...prev, `INFO SERVEUR: ${JSON.stringify(data, null, 2)}`]);
    } catch (error) {
      setLogs(prev => [...prev, `ERREUR API: ${error.message}`]);
    } finally {
      setIsLoadingServerInfo(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Diagnostic WebSocket</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>État de la connexion</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusIndicator, {
            backgroundColor: isConnected === null 
              ? '#888' 
              : isConnected 
                ? '#4caf50' 
                : '#f44336'
          }]} />
          <Text style={styles.statusText}>
            {isConnected === null 
              ? 'Vérification...' 
              : isConnected 
                ? 'Connecté' 
                : 'Déconnecté'}
          </Text>
        </View>
        
        <Text style={styles.infoValue}>URL: {SOCKET_URL}</Text>
        <Text style={styles.infoValue}>Socket ID: {socketId || 'N/A'}</Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, isTesting && styles.buttonDisabled]} 
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Tester la connexion</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, isLoadingServerInfo && styles.buttonDisabled]} 
          onPress={fetchServerInfo}
          disabled={isLoadingServerInfo}
        >
          {isLoadingServerInfo ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Info serveur</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Logs ({logs.length})</Text>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={[
              styles.logEntry,
              log.startsWith('ERROR') ? styles.logError : 
              log.startsWith('ÉVÉNEMENT') ? styles.logEvent : 
              styles.logRegular
            ]}>
              {log}
            </Text>
          ))}
          {logs.length === 0 && (
            <Text style={styles.emptyLog}>Aucun log à afficher</Text>
          )}
        </ScrollView>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Développement et débogage WebSocket
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0933',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
  },
  backText: {
    color: '#fff',
    fontWeight: '600',
  },
  infoContainer: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: 10,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
  },
  infoValue: {
    color: '#ddd',
    fontSize: 14,
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: .0,
    paddingHorizontal: 10,
  },
  button: {
    backgroundColor: '#5D6DFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(93, 109, 255, 0.5)',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
    margin: 10,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
  },
  logTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logScroll: {
    flex: 1,
  },
  logEntry: {
    color: '#ddd',
    fontSize: 12,
    fontFamily: 'monospace',
    paddingVertical: 3,
  },
  logError: {
    color: '#ff6b6b',
  },
  logEvent: {
    color: '#5eead4',
  },
  logRegular: {
    color: '#ddd',
  },
  emptyLog: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  footer: {
    padding: 10,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
});
