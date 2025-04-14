import React, { useState, useEffect } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type ToastProps = {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onHide?: () => void;
};

const toastQueue: ToastProps[] = [];
let isProcessing = false;

const processNextToast = (setCurrentToast: (toast: ToastProps | null) => void) => {
  if (toastQueue.length > 0 && !isProcessing) {
    isProcessing = true;
    const nextToast = toastQueue.shift()!;
    setCurrentToast(nextToast);
    
    setTimeout(() => {
      setCurrentToast(null);
      isProcessing = false;
      processNextToast(setCurrentToast);
    }, nextToast.duration || 3000);
  }
};

const Toast: React.FC<ToastProps> = (props) => {
  const [currentToast, setCurrentToast] = useState<ToastProps | null>(null);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    if (props.message) {
      toastQueue.push(props);
      processNextToast(setCurrentToast);
    }
  }, [props.message]);

  useEffect(() => {
    if (currentToast) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(currentToast.duration || 3000),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => currentToast.onHide?.());
    }
  }, [currentToast]);

  const getBackgroundColor = () => {
    switch (currentToast?.type) {
      case 'success': return 'rgba(76, 175, 80, 0.9)';
      case 'error': return 'rgba(244, 67, 54, 0.9)';
      case 'warning': return 'rgba(255, 152, 0, 0.9)';
      default: return 'rgba(33, 150, 243, 0.9)';
    }
  };

  if (!currentToast) return null;

  return (
    <Animated.View style={[
      styles.container, 
      { opacity, backgroundColor: getBackgroundColor() }
    ]}>
      <Text style={styles.text}>{currentToast.message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default Toast;
