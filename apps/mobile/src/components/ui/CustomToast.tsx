import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';
import Ionicons from '@react-native-vector-icons/ionicons';
import { colors, radius, shadows, spacing } from '../../theme';

interface CustomToastProps extends BaseToastProps {
  text1?: string;
  text2?: string;
}

const { width } = Dimensions.get('window');

export const toastConfig = {
  success: (props: CustomToastProps) => (
    <View style={[styles.container, { backgroundColor: colors.success, borderColor: colors.success }]}>
      <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}>
        <Ionicons name="checkmark-circle" size={24} color="#FFF" />
      </View>
      <View style={styles.textContainer}>
        {props.text1 ? <Text style={[styles.title, { color: '#FFF' }]}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={[styles.message, { color: 'rgba(255,255,255,0.9)' }]}>{props.text2}</Text> : null}
      </View>
    </View>
  ),
  error: (props: CustomToastProps) => (
    <View style={[styles.container, { backgroundColor: colors.error, borderColor: colors.error }]}>
      <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}>
        <Ionicons name="alert-circle" size={24} color="#FFF" />
      </View>
      <View style={styles.textContainer}>
        {props.text1 ? <Text style={[styles.title, { color: '#FFF' }]}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={[styles.message, { color: 'rgba(255,255,255,0.9)' }]}>{props.text2}</Text> : null}
      </View>
    </View>
  ),
  info: (props: CustomToastProps) => (
    <View style={[styles.container, { backgroundColor: colors.amber, borderColor: colors.amber }]}>
      <View style={[styles.iconContainer, { backgroundColor: 'rgba(0, 0, 0, 0.15)' }]}>
        <Ionicons name="information-circle" size={24} color={colors.ink} />
      </View>
      <View style={styles.textContainer}>
        {props.text1 ? <Text style={[styles.title, { color: colors.ink }]}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={[styles.message, { color: 'rgba(0,0,0,0.8)' }]}>{props.text2}</Text> : null}
      </View>
    </View>
  )
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: width - spacing.xl * 2,
    backgroundColor: colors.carbon,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    marginTop: Platform.OS === 'ios' ? 0 : spacing.sm,
    overflow: 'hidden',
  },
  successIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.success,
  },
  errorIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.error,
  },
  infoIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.amber,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Syne_700Bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
