import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseToastProps } from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface CustomToastProps extends BaseToastProps {
  text1?: string;
  text2?: string;
}

export const toastConfig = {
  success: (props: CustomToastProps) => (
    <View style={[styles.container, styles.successContainer]}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
      </View>
      <View style={styles.textContainer}>
        {props.text1 ? <Text style={styles.title}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={styles.message}>{props.text2}</Text> : null}
      </View>
    </View>
  ),
  error: (props: CustomToastProps) => (
    <View style={[styles.container, styles.errorContainer]}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle" size={24} color={colors.danger} />
      </View>
      <View style={styles.textContainer}>
        {props.text1 ? <Text style={styles.title}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={styles.message}>{props.text2}</Text> : null}
      </View>
    </View>
  ),
  info: (props: CustomToastProps) => (
    <View style={[styles.container, styles.infoContainer]}>
      <View style={styles.iconContainer}>
        <Ionicons name="information-circle" size={24} color={colors.primary} />
      </View>
      <View style={styles.textContainer}>
        {props.text1 ? <Text style={styles.title}>{props.text1}</Text> : null}
        {props.text2 ? <Text style={styles.message}>{props.text2}</Text> : null}
      </View>
    </View>
  )
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '90%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  successContainer: {
    borderLeftColor: colors.success,
  },
  errorContainer: {
    borderLeftColor: colors.danger,
  },
  infoContainer: {
    borderLeftColor: colors.primary,
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
