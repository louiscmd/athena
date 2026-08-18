import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Colors, Spacing } from '@/constants/theme';
import type { AthenaMode } from '@/types';

interface Props {
  mode: AthenaMode;
  onPressIn: () => void;
  onPressOut: () => void;
  onPress?: () => void;
}

export default function VoiceButton({ mode, onPressIn, onPressOut, onPress }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.92);
    onPressIn();
  }

  function handlePressOut() {
    scale.value = withSpring(1);
    onPressOut();
  }

  const isListening = mode === 'listening';
  const isThinking = mode === 'thinking';
  const isSpeaking = mode === 'speaking';

  function getIcon() {
    if (isListening) return '■';
    if (isThinking) return '···';
    if (isSpeaking) return '■';
    return '○';
  }

  function getLabel() {
    if (isListening) return 'Release to send';
    if (isThinking) return 'Thinking...';
    if (isSpeaking) return 'Tap to stop';
    return 'Hold to speak';
  }

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[animatedStyle]}>
        <TouchableOpacity
          style={[
            styles.button,
            isListening && styles.listening,
            isThinking && styles.thinking,
            isSpeaking && styles.speaking,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <Text style={styles.icon}>{getIcon()}</Text>
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.label}>{getLabel()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgElevated,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  listening: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primary,
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  thinking: {
    borderColor: Colors.secondary,
    shadowColor: Colors.secondary,
  },
  speaking: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
  },
  icon: {
    fontSize: 26,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
