import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

type InviteModalProps = {
  visible: boolean;
  roomId: string;
  onClose: () => void;
  onCopyCode: () => void;
  onShareCode: () => void;
};

const InviteModal = ({ visible, roomId, onClose, onCopyCode, onShareCode }: InviteModalProps) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#321a5e', '#1a0933']}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inviter des amis</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inviteCodeContainer}>
              <MaterialCommunityIcons name="ticket-confirmation" size={60} color="rgba(255,255,255,0.8)" />
              <Text style={styles.inviteCodeLabel}>CODE DE LA SALLE</Text>
              <Text style={styles.inviteCode}>{roomId}</Text>
            </View>
            
            <Text style={styles.codeInstructionText}>
              Partagez ce code avec vos amis pour qu'ils puissent vous rejoindre dans cette salle
            </Text>
            
            <TouchableOpacity style={styles.actionButton} onPress={onCopyCode}>
              <MaterialCommunityIcons name="content-copy" size={22} color="white" />
              <Text style={styles.actionButtonText}>Copier le code</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.shareButton]}
              onPress={onShareCode}
            >
              <Ionicons name="share-social" size={22} color="white" />
              <Text style={styles.actionButtonText}>Partager</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(93, 109, 255, 0.5)',
  },
  modalGradient: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  inviteCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    marginBottom: 20,
  },
  inviteCodeLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 10,
    marginBottom: 5,
  },
  inviteCode: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 5,
  },
  codeInstructionText: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  shareButton: {
    backgroundColor: 'rgba(93, 109, 255, 0.8)',
    marginBottom: 0,
  },
});

export default InviteModal;
