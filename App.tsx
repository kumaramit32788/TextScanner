import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import RNFS from 'react-native-fs';
import {SafeAreaProvider} from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent isDarkMode={isDarkMode} />
    </SafeAreaProvider>
  );
}

function AppContent({isDarkMode}: {isDarkMode: boolean}) {
  const [savedImages, setSavedImages] = useState<string[]>([]);
  const [lastSavedPath, setLastSavedPath] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingToDevice, setSavingToDevice] = useState(false);

  const scansDir = `${RNFS.DocumentDirectoryPath}/scans`;

  const requestAndroidCameraPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera permission',
        message: 'Camera access is needed to scan documents.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const requestAndroidStoragePermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    if (Platform.Version >= 33) {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage permission',
        message: 'Storage access is needed to save images to your device.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  };

  const loadSavedImages = useCallback(async () => {
    try {
      const dirExists = await RNFS.exists(scansDir);
      if (!dirExists) {
        setSavedImages([]);
        return;
      }

      const entries = await RNFS.readDir(scansDir);
      const sortedFiles = entries
        .filter(entry => entry.isFile() && /\.(jpg|jpeg|png)$/i.test(entry.name))
        .sort((a, b) => (b.mtime?.getTime() ?? 0) - (a.mtime?.getTime() ?? 0))
        .map(entry => `file://${entry.path}`);

      setSavedImages(sortedFiles);
    } catch {
      setError('Failed to load saved images.');
    }
  }, [scansDir]);

  useEffect(() => {
    loadSavedImages();
  }, [loadSavedImages]);

  const captureAndSaveDocument = async () => {
    setError('');
    setSuccess('');
    setLastSavedPath('');

    const hasPermission = await requestAndroidCameraPermission();
    if (!hasPermission) {
      setError('Camera permission denied.');
      return;
    }

    try {
      setScanning(true);
      const {scannedImages, status} = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
        croppedImageQuality: 100,
      });

      if (status === ScanDocumentResponseStatus.Cancel) {
        return;
      }

      const sourcePath = scannedImages?.[0];
      if (!sourcePath) {
        setError('No document captured.');
        return;
      }

      const timestamp = Date.now();
      const destPath = `${scansDir}/scan-${timestamp}.jpg`;

      const dirExists = await RNFS.exists(scansDir);
      if (!dirExists) {
        await RNFS.mkdir(scansDir);
      }

      await RNFS.copyFile(sourcePath, destPath);
      const formattedPath = `file://${destPath}`;
      setLastSavedPath(formattedPath);
      await loadSavedImages();
      setSuccess('Document scanned and saved locally.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to scan and save document';
      setError(message);
    } finally {
      setScanning(false);
    }
  };

  const saveToDevice = async () => {
    if (!selectedImage) {
      return;
    }

    const hasStoragePermission = await requestAndroidStoragePermission();
    if (!hasStoragePermission) {
      setError('Storage permission denied.');
      return;
    }

    try {
      setSavingToDevice(true);
      setError('');
      setSuccess('');
      const sourcePath = selectedImage.replace('file://', '');
      const timestamp = Date.now();
      const destinationPath = `${RNFS.DownloadDirectoryPath}/scan-${timestamp}.jpg`;
      await RNFS.copyFile(sourcePath, destinationPath);
      setLastSavedPath(`file://${destinationPath}`);
      setSuccess('Image saved to Downloads folder.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save image to device';
      setError(message);
    } finally {
      setSavingToDevice(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSavedImages();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <FlatList
        data={savedImages}
        keyExtractor={item => item}
        numColumns={2}
        contentContainerStyle={styles.content}
        columnWrapperStyle={savedImages.length > 0 ? styles.gridRow : undefined}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>
              Document Scanner
            </Text>
            <Text style={[styles.label, isDarkMode && styles.textDark]}>
              Captured documents are saved locally and listed below.
            </Text>
            {lastSavedPath ? (
              <Text style={[styles.pathText, isDarkMode && styles.textDark]}>
                Last saved: {lastSavedPath}
              </Text>
            ) : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          <View style={[styles.previewBox, isDarkMode && styles.previewBoxDark]}>
            <Text style={[styles.previewPlaceholder, isDarkMode && styles.textDark]}>
              No saved documents yet. Tap SCAN to add your first one.
            </Text>
          </View>
        }
        renderItem={({item}) => (
          <Pressable
            style={[styles.gridItem, isDarkMode && styles.previewBoxDark]}
            onPress={() => setSelectedImage(item)}>
            <Image source={{uri: item}} style={styles.gridImage} resizeMode="cover" />
          </Pressable>
        )}
      />

      <View style={styles.fabGroup}>
        <Pressable
          style={[styles.fabPrimary, scanning && styles.buttonDisabled]}
          onPress={captureAndSaveDocument}
          disabled={scanning}>
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.fabPrimaryText}>SCAN</Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={Boolean(selectedImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDarkMode && styles.previewBoxDark]}>
            {selectedImage ? (
              <Image
                source={{uri: selectedImage}}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalSecondary]}
                onPress={() => setSelectedImage(null)}>
                <Text style={styles.modalSecondaryText}>Close</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalPrimary]}
                onPress={saveToDevice}
                disabled={savingToDevice}>
                {savingToDevice ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Save to Device</Text>
                )}
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
    backgroundColor: '#f3f4f6',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 96,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  titleDark: {
    color: '#f9fafb',
  },
  label: {
    fontSize: 14,
    color: '#374151',
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  previewBox: {
    minHeight: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  previewBoxDark: {
    borderColor: '#4b5563',
    backgroundColor: '#1f2937',
  },
  previewPlaceholder: {
    color: '#6b7280',
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '48%',
    aspectRatio: 0.72,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  pathText: {
    color: '#4b5563',
    fontSize: 12,
  },
  error: {
    color: '#dc2626',
  },
  success: {
    color: '#059669',
  },
  textDark: {
    color: '#f9fafb',
  },
  fabGroup: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    alignItems: 'center',
  },
  fabPrimary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  fabPrimaryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
    gap: 12,
  },
  modalImage: {
    width: '100%',
    height: 420,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalPrimary: {
    backgroundColor: '#2563eb',
  },
  modalSecondary: {
    backgroundColor: '#e5e7eb',
  },
  modalPrimaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalSecondaryText: {
    color: '#111827',
    fontWeight: '600',
  },
});

export default App;
