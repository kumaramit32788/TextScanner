import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {MaterialIcons} from '@react-native-vector-icons/material-icons';
import Slider from '@react-native-community/slider';

type SelectedImageScreenProps = {
  imageUri: string;
  totalImages: number;
  currentImageIndex: number;
  isDarkMode: boolean;
  savingToDevice: boolean;
  rotation: number;
  onClose: () => void;
  onNextImage: () => void;
  onPreviousImage: () => void;
  onRotate: () => void;
  onShare: () => void;
  exportModalVisible: boolean;
  onOpenExportModal: () => void;
  onCloseExportModal: () => void;
  exportFileName: string;
  onExportFileNameChange: (value: string) => void;
  exportMinSizeMb: number;
  exportMaxSizeMb: number;
  exportTargetSizeMb: number;
  onExportTargetSizeMbChange: (value: number) => void;
  exportSize: 'A4' | 'Letter' | 'ORIGINAL';
  onExportSizeChange: (value: 'A4' | 'Letter' | 'ORIGINAL') => void;
  onSave: () => void;
};

function SelectedImageScreen({
  imageUri,
  totalImages,
  currentImageIndex,
  isDarkMode,
  savingToDevice,
  rotation,
  onClose,
  onNextImage,
  onPreviousImage,
  onRotate,
  onShare,
  exportModalVisible,
  onOpenExportModal,
  onCloseExportModal,
  exportFileName,
  onExportFileNameChange,
  exportMinSizeMb,
  exportMaxSizeMb,
  exportTargetSizeMb,
  onExportTargetSizeMbChange,
  exportSize,
  onExportSizeChange,
  onSave,
}: SelectedImageScreenProps) {
  const hasMultiple = totalImages > 1;
  const canGoPrev = currentImageIndex > 0;
  const canGoNext = currentImageIndex < totalImages - 1;
  const swipeThreshold = 40;
  const displayImageUri = encodeURI(
    imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`,
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          hasMultiple &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 8,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -swipeThreshold && canGoNext) {
            onNextImage();
            return;
          }
          if (gestureState.dx >= swipeThreshold && canGoPrev) {
            onPreviousImage();
          }
        },
      }),
    [canGoNext, canGoPrev, hasMultiple, onNextImage, onPreviousImage],
  );

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.card, isDarkMode && styles.cardDark]}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <MaterialIcons name="close" size={20} color="#fff" />
        </Pressable>
        <View style={styles.imageWrap} {...panResponder.panHandlers}>
          {hasMultiple ? (
            <Pressable
              style={[styles.navButton, styles.navLeft, !canGoPrev && styles.navDisabled]}
              onPress={onPreviousImage}
              disabled={!canGoPrev}>
              <MaterialIcons name="chevron-left" size={24} color="#fff" />
            </Pressable>
          ) : null}
          <Image
            source={{uri: displayImageUri}}
            style={[styles.image, {transform: [{rotate: `${rotation}deg`}]}]}
            resizeMode="contain"
          />
          {hasMultiple ? (
            <Pressable
              style={[styles.navButton, styles.navRight, !canGoNext && styles.navDisabled]}
              onPress={onNextImage}
              disabled={!canGoNext}>
              <MaterialIcons name="chevron-right" size={24} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        {hasMultiple ? (
          <View style={styles.pageIndicator}>
            <Text style={styles.pageText}>
              {currentImageIndex + 1}/{totalImages}
            </Text>
          </View>
        ) : null}
        <View style={styles.buttons}>
          <Pressable style={[styles.iconButton, styles.rotate]} onPress={onRotate}>
            <MaterialIcons name="rotate-right" size={22} color="#fff" />
          </Pressable>
          <Pressable style={[styles.iconButton, styles.share]} onPress={onShare}>
            <MaterialIcons name="share" size={22} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.iconButton, styles.primary]}
            onPress={onOpenExportModal}
            disabled={savingToDevice}>
            {savingToDevice ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialIcons name="picture-as-pdf" size={22} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={onCloseExportModal}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
            <Text style={styles.modalTitle}>Custom Export</Text>
            <TextInput
              value={exportFileName}
              onChangeText={onExportFileNameChange}
              placeholder="PDF name"
              placeholderTextColor="#9ca3af"
              style={styles.fileNameInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.rangeLabel}>
              Size range: {exportMinSizeMb.toFixed(1)} MB - {exportMaxSizeMb.toFixed(1)} MB
            </Text>
            <View style={styles.sliderWrap}>
              <Slider
                minimumValue={exportMinSizeMb}
                maximumValue={exportMaxSizeMb}
                step={0.1}
                value={exportTargetSizeMb}
                onValueChange={onExportTargetSizeMbChange}
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#4b5563"
                thumbTintColor="#60a5fa"
              />
            </View>
            <Text style={styles.targetSizeText}>
              Target: {exportTargetSizeMb.toFixed(1)} MB
            </Text>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Size</Text>
              <View style={styles.optionButtons}>
                {([
                  {label: 'A4', value: 'A4'},
                  {label: 'LETTER', value: 'Letter'},
                  {label: 'ORIGINAL', value: 'ORIGINAL'},
                ] as const).map(option => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.optionButton,
                      exportSize === option.value && styles.optionButtonActive,
                    ]}
                    onPress={() => onExportSizeChange(option.value)}>
                    <Text
                      style={[
                        styles.optionButtonText,
                        exportSize === option.value && styles.optionButtonTextActive,
                      ]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalAction, styles.cancelAction]} onPress={onCloseExportModal}>
                <Text style={styles.cancelActionText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalAction, styles.exportAction]} onPress={onSave}>
                <Text style={styles.exportActionText}>Export</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  containerDark: {
    backgroundColor: '#0b1220',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
    flex: 1,
    marginVertical: 16,
  },
  cardDark: {
    borderColor: '#4b5563',
    borderWidth: 1,
    backgroundColor: '#1f2937',
  },
  imageWrap: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(17,24,39,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(17,24,39,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: {
    left: 8,
  },
  navRight: {
    right: 8,
  },
  navDisabled: {
    opacity: 0.35,
  },
  pageIndicator: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 4,
  },
  pageText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  fileNameInput: {
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f9fafb',
    backgroundColor: 'rgba(17,24,39,0.35)',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionLabel: {
    color: '#d1d5db',
    fontSize: 12,
    width: 48,
  },
  optionButtons: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(17,24,39,0.35)',
  },
  optionButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionButtonText: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '600',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 12,
    backgroundColor: '#111827',
    padding: 14,
    gap: 10,
  },
  modalCardDark: {
    borderColor: '#4b5563',
    borderWidth: 1,
    backgroundColor: '#1f2937',
  },
  modalTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  rangeLabel: {
    color: '#d1d5db',
    fontSize: 12,
  },
  sliderWrap: {
    marginTop: 2,
  },
  targetSizeText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  modalAction: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelAction: {
    backgroundColor: '#374151',
  },
  exportAction: {
    backgroundColor: '#2563eb',
  },
  cancelActionText: {
    color: '#fff',
    fontWeight: '600',
  },
  exportActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  primary: {
    backgroundColor: '#2563eb',
  },
  share: {
    backgroundColor: '#374151',
  },
  rotate: {
    backgroundColor: '#7c3aed',
  },
});

export default SelectedImageScreen;
