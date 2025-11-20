import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '../styles/theme';

type OptionValue = string | number;

type SelectOption = {
  label: string;
  value: OptionValue;
};

type SelectFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  options: SelectOption[];
  value: OptionValue;
  onValueChange: (value: OptionValue) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SelectField({
  label,
  placeholder = 'Select an option',
  helperText,
  options,
  value,
  onValueChange,
  disabled,
  style,
}: SelectFieldProps) {
  const [visible, setVisible] = useState(false);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  const handleSelect = (optionValue: OptionValue) => {
    onValueChange(optionValue);
    setVisible(false);
  };

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.field, disabled && styles.fieldDisabled]}
        activeOpacity={0.85}
        onPress={() => {
          if (!disabled) {
            setVisible(true);
          }
        }}
      >
        <Text style={[styles.valueText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label ?? 'Select an option'}</Text>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8}>
                <Feather name="x" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionList}>
              {options.map((option) => {
                const isActive = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value.toString()}
                    style={[styles.optionRow, isActive && styles.optionRowActive]}
                    onPress={() => handleSelect(option.value)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]} numberOfLines={2}>
                      {option.label}
                    </Text>
                    {isActive ? <Feather name="check" size={16} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  field: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fieldDisabled: {
    opacity: 0.5,
  },
  valueText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  placeholder: {
    color: colors.textMuted,
  },
  helper: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  optionList: {
    maxHeight: 320,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionRowActive: {
    backgroundColor: colors.surfaceAlt,
  },
  optionLabel: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  optionLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
