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
  capturing: boolean;
  onClose: () => void;
  onNextImage: () => void;
  onPreviousImage: () => void;
  onRotate: () => void;
  onShare: () => void;
  onAddCapture: () => void;
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
  capturing,
  onClose,
  onNextImage,
  onPreviousImage,
  onRotate,
  onShare,
  onAddCapture,
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
  const [controlsVisible, setControlsVisible] = React.useState(false);
  const hasMultiple = totalImages > 1;
  const canGoPrev = currentImageIndex > 0;
  const canGoNext = currentImageIndex < totalImages - 1;
  const swipeThreshold = 40;
  const displayImageUri = encodeURI(
    imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`,
  );
  const modalTitleStyle = [styles.modalTitle, isDarkMode ? styles.modalTitleDark : styles.modalTitleLight];
  const rangeLabelStyle = [styles.rangeLabel, isDarkMode ? styles.rangeLabelDark : styles.rangeLabelLight];
  const targetSizeTextStyle = [
    styles.targetSizeText,
    isDarkMode ? styles.targetSizeTextDark : styles.targetSizeTextLight,
  ];
  const fileNameInputStyle = [
    styles.fileNameInput,
    isDarkMode ? styles.fileNameInputDark : styles.fileNameInputLight,
  ];
  const optionLabelStyle = [styles.optionLabel, isDarkMode ? styles.optionLabelDark : styles.optionLabelLight];
  const placeholderColor = isDarkMode ? '#9ca3af' : '#6b7280';

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

  React.useEffect(() => {
    if (!controlsVisible) {
      return;
    }
    const timer = setTimeout(() => setControlsVisible(false), 2200);
    return () => clearTimeout(timer);
  }, [controlsVisible]);

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.card}>
        {controlsVisible ? (
          <Pressable style={styles.closeButton} onPress={onClose}>
            <MaterialIcons name="close" size={20} color="#fff" />
          </Pressable>
        ) : null}
        <View style={styles.imageWrap} {...panResponder.panHandlers}>
          {controlsVisible && hasMultiple ? (
            <Pressable
              style={[styles.navButton, styles.navLeft, !canGoPrev && styles.navDisabled]}
              onPress={onPreviousImage}
              disabled={!canGoPrev}>
              <MaterialIcons name="chevron-left" size={24} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setControlsVisible(prev => !prev)}
            style={styles.imageTouchArea}>
            <Image
              source={{uri: displayImageUri}}
              style={[styles.image, {transform: [{rotate: `${rotation}deg`}]}]}
              resizeMode="contain"
            />
          </Pressable>
          {controlsVisible && hasMultiple ? (
            <Pressable
              style={[styles.navButton, styles.navRight, !canGoNext && styles.navDisabled]}
              onPress={onNextImage}
              disabled={!canGoNext}>
              <MaterialIcons name="chevron-right" size={24} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        {controlsVisible && hasMultiple ? (
          <View style={styles.pageIndicator}>
            <Text style={styles.pageText}>
              {currentImageIndex + 1}/{totalImages}
            </Text>
          </View>
        ) : null}
        {controlsVisible ? (
          <View style={styles.buttons}>
            <Pressable
              style={[styles.iconButton, styles.add, capturing && styles.navDisabled]}
              onPress={onAddCapture}
              disabled={capturing}>
              {capturing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <MaterialIcons name="add-a-photo" size={22} color="#fff" />
              )}
            </Pressable>
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
        ) : null}
      </View>
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={onCloseExportModal}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDarkMode && styles.modalCardDark]}>
            <Text style={modalTitleStyle}>Custom Export</Text>
            <TextInput
              value={exportFileName}
              onChangeText={onExportFileNameChange}
              placeholder="PDF name"
              placeholderTextColor={placeholderColor}
              style={fileNameInputStyle}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={rangeLabelStyle}>
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
            <Text style={targetSizeTextStyle}>
              Target: {exportTargetSizeMb.toFixed(1)} MB
            </Text>
            <View style={styles.optionRow}>
              <Text style={optionLabelStyle}>Size</Text>
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
                        !isDarkMode && styles.optionButtonTextLight,
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
  },
  containerDark: {
    backgroundColor: '#0b1220',
  },
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    padding: 0,
    flex: 1,
  },
  imageWrap: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  imageTouchArea: {
    flex: 1,
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
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fileNameInputDark: {
    borderColor: '#4b5563',
    color: '#f9fafb',
    backgroundColor: 'rgba(17,24,39,0.35)',
  },
  fileNameInputLight: {
    borderColor: '#d1d5db',
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionLabel: {
    fontSize: 12,
    width: 48,
  },
  optionLabelDark: {
    color: '#d1d5db',
  },
  optionLabelLight: {
    color: '#374151',
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
  optionButtonTextLight: {
    color: '#374151',
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
    fontWeight: '700',
    fontSize: 16,
  },
  modalTitleDark: {
    color: '#fff',
  },
  modalTitleLight: {
    color: '#111827',
  },
  rangeLabel: {
    fontSize: 12,
  },
  rangeLabelDark: {
    color: '#d1d5db',
  },
  rangeLabelLight: {
    color: '#4b5563',
  },
  sliderWrap: {
    marginTop: 2,
  },
  targetSizeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  targetSizeTextDark: {
    color: '#e5e7eb',
  },
  targetSizeTextLight: {
    color: '#1f2937',
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
  add: {
    backgroundColor: '#0f766e',
  },
});

export default SelectedImageScreen;
