
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import DocumentScanner, {
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';
import RNFS from 'react-native-fs';
import {createPdf} from 'react-native-pdf-from-image';
import RNPhotoManipulator, {
  MimeType,
  RotationMode,
} from 'react-native-photo-manipulator';
import {MaterialIcons} from '@react-native-vector-icons/material-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import SelectedImageScreen from './SelectedImageScreen';

function AppContent({isDarkMode}: {isDarkMode: boolean}) {
    const rowUsableWidth = Dimensions.get('window').width - 32;
    const swipeActionWidth = Math.round(rowUsableWidth * 0.4);
    const swipeThreshold = Math.round(swipeActionWidth * 0.6);
    const [savedImages, setSavedImages] = useState<string[]>([]);
    const [lastSavedPath, setLastSavedPath] = useState('');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [selectedImageRotation, setSelectedImageRotation] = useState(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [scanning, setScanning] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [savingToDevice, setSavingToDevice] = useState(false);
    const [exportFileName, setExportFileName] = useState('');
    const [exportSize, setExportSize] = useState<'A4' | 'Letter' | 'ORIGINAL'>('A4');
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [exportMinSizeMb, setExportMinSizeMb] = useState(0.5);
    const [exportMaxSizeMb, setExportMaxSizeMb] = useState(5);
    const [exportTargetSizeMb, setExportTargetSizeMb] = useState(5);
    const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [renameTargetGroupId, setRenameTargetGroupId] = useState('');
    const [renameValue, setRenameValue] = useState('');
  
    const scansDir = `${RNFS.DocumentDirectoryPath}/scans`;
    const toDisplayUri = (path: string) => {
      const normalized = path.startsWith('file://') ? path : `file://${path}`;
      return encodeURI(normalized);
    };
  
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
          message: 'Storage access is needed to save PDF files to your device.',
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
          maxNumDocuments: 20,
          croppedImageQuality: 100,
        });
  
        if (status === ScanDocumentResponseStatus.Cancel) {
          return;
        }
  
        const sourcePaths = scannedImages?.filter(Boolean) ?? [];
        if (sourcePaths.length === 0) {
          setError('No document captured.');
          return;
        }
  
        const dirExists = await RNFS.exists(scansDir);
        if (!dirExists) {
          await RNFS.mkdir(scansDir);
        }
  
        const batchId = Date.now();
        const savedPaths: string[] = [];
        for (const [index, sourcePath] of sourcePaths.entries()) {
          const normalizedSourcePath = sourcePath.replace('file://', '');
          const destPath = `${scansDir}/scan-${batchId}-${index + 1}.jpg`;
          await RNFS.copyFile(normalizedSourcePath, destPath);
          savedPaths.push(`file://${destPath}`);
        }

        setLastSavedPath(savedPaths[savedPaths.length - 1]);
        await loadSavedImages();
        setSuccess(
          `${savedPaths.length} document${savedPaths.length > 1 ? 's' : ''} scanned and saved locally.`,
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to scan and save document';
        setError(message);
      } finally {
        setScanning(false);
      }
    };
  
    const resolveExistingPath = async (path: string) => {
      const withoutFilePrefix = path.replace('file://', '');
      if (await RNFS.exists(withoutFilePrefix)) {
        return withoutFilePrefix;
      }
      if (await RNFS.exists(path)) {
        return path;
      }
      return withoutFilePrefix;
    };

    const buildPdfForQuality = async (
      imagePaths: string[],
      quality: number,
      pdfName: string,
      scaleFactor: number,
    ) => {
      const optimizedPaths = await Promise.all(
        imagePaths.map(async path => {
          let workingPath = await resolveExistingPath(path);
          try {
            if (scaleFactor < 0.999) {
              const imageUri = workingPath.startsWith('file://')
                ? workingPath
                : `file://${workingPath}`;
              const dimensions = await new Promise<{width: number; height: number}>(
                (resolve, reject) => {
                  Image.getSize(
                    imageUri,
                    (width, height) => resolve({width, height}),
                    reject,
                  );
                },
              );
              const resized = await RNPhotoManipulator.crop(
                imageUri,
                {x: 0, y: 0, width: dimensions.width, height: dimensions.height},
                {
                  width: Math.max(1, Math.round(dimensions.width * scaleFactor)),
                  height: Math.max(1, Math.round(dimensions.height * scaleFactor)),
                },
                MimeType.JPEG,
              );
              workingPath = await resolveExistingPath(resized);
            }

            const optimized = await RNPhotoManipulator.optimize(workingPath, quality);
            return resolveExistingPath(optimized);
          } catch {
            return resolveExistingPath(workingPath);
          }
        }),
      );

      const pdfParams: {
        imagePaths: string[];
        name: string;
        paperSize?: 'A4' | 'Letter';
      } = {
        imagePaths: optimizedPaths,
        name: pdfName,
      };
      if (exportSize !== 'ORIGINAL') {
        pdfParams.paperSize = exportSize;
      }

      const {filePath} = await createPdf(pdfParams);
      const resolvedPdfPath = await resolveExistingPath(filePath);
      const pdfStats = await RNFS.stat(resolvedPdfPath);
      return {
        filePath: resolvedPdfPath,
        sizeMb: Number(pdfStats.size) / (1024 * 1024),
      };
    };

    const saveToDevice = async (imagePaths: string[], activeIndex: number) => {
      const hasStoragePermission = await requestAndroidStoragePermission();
      if (!hasStoragePermission) {
        setError('Storage permission denied.');
        return;
      }

      try {
        setSavingToDevice(true);
        setError('');
        setSuccess('Downloading started...');

        const sourcePaths = await Promise.all(
          imagePaths.map((imagePath, index) =>
            index === activeIndex
              ? createRotatedImageIfNeeded(imagePath, selectedImageRotation)
              : Promise.resolve(imagePath.replace('file://', '')),
          ),
        );

        const timestamp = Date.now();
        const normalizedName = (exportFileName.trim() || `scan-${timestamp}`).replace(
          /\.pdf$/i,
          '',
        );
        const targetMb = Math.max(exportMinSizeMb, exportTargetSizeMb);
        let bestResult: {filePath: string; sizeMb: number} | null = null;
        const generatedPdfPaths = new Set<string>();
        const scaleCandidates = [1, 0.85, 0.7, 0.55, 0.4, 0.3];

        for (const scaleFactor of scaleCandidates) {
          let low = 20;
          let high = 100;
          for (let attempt = 0; attempt < 4 && low <= high; attempt += 1) {
            const quality = Math.round((low + high) / 2);
            const tempName = `${normalizedName}-tmp-${timestamp}-${Math.round(
              scaleFactor * 100,
            )}-${quality}-${attempt}`;
            const result = await buildPdfForQuality(
              sourcePaths,
              quality,
              tempName,
              scaleFactor,
            );
            generatedPdfPaths.add(result.filePath);

            if (
              !bestResult ||
              Math.abs(result.sizeMb - targetMb) < Math.abs(bestResult.sizeMb - targetMb)
            ) {
              bestResult = result;
            }

            if (result.sizeMb > targetMb) {
              high = quality - 5;
            } else {
              low = quality + 5;
            }

            if (Math.abs(result.sizeMb - targetMb) <= 0.15) {
              break;
            }
          }

          if (bestResult && bestResult.sizeMb <= targetMb + 0.15) {
            break;
          }
        }

        if (!bestResult) {
          throw new Error('Unable to generate PDF');
        }

        const baseOutputDir =
          Platform.OS === 'android'
            ? RNFS.DownloadDirectoryPath
            : RNFS.DocumentDirectoryPath;
        const destinationPath = `${baseOutputDir}/${normalizedName}.pdf`;

        if (bestResult.filePath !== destinationPath) {
          const destinationExists = await RNFS.exists(destinationPath);
          if (destinationExists) {
            await RNFS.unlink(destinationPath);
          }
          await RNFS.moveFile(bestResult.filePath, destinationPath);
        }

        for (const path of generatedPdfPaths) {
          if (path !== destinationPath && (await RNFS.exists(path))) {
            await RNFS.unlink(path);
          }
        }

        setLastSavedPath(`file://${destinationPath}`);
        setSuccess(
          `PDF exported to: file://${destinationPath} (${bestResult.sizeMb.toFixed(2)} MB)`,
        );
        if (Platform.OS === 'android') {
          ToastAndroid.show('PDF downloaded successfully', ToastAndroid.SHORT);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to export PDF';
        setError(message);
        setSuccess('');
      } finally {
        setSavingToDevice(false);
      }
    };
  
    const onRefresh = async () => {
      setRefreshing(true);
      await loadSavedImages();
      setRefreshing(false);
    };

    const createRotatedImageIfNeeded = async (imagePath: string, rotation: number) => {
      const normalizedRotation = ((rotation % 360) + 360) % 360;
      if (normalizedRotation === 0) {
        return imagePath.replace('file://', '');
      }

      const rotationMode =
        normalizedRotation === 90
          ? RotationMode.R90
          : normalizedRotation === 180
            ? RotationMode.R180
            : RotationMode.R270;

      const rotatedPath = await RNPhotoManipulator.rotateImage(
        imagePath,
        rotationMode,
      );
      return rotatedPath.replace('file://', '');
    };

    const shareSelected = async (imagePath: string) => {
      try {
        setError('');
        let preferredUri = imagePath;
        if (lastSavedPath && lastSavedPath.toLowerCase().endsWith('.pdf')) {
          preferredUri = lastSavedPath;
        } else if (selectedImageRotation !== 0) {
          const rotatedPath = await createRotatedImageIfNeeded(
            imagePath,
            selectedImageRotation,
          );
          preferredUri = `file://${rotatedPath}`;
        }
        await Share.share({
          message: preferredUri,
          url: preferredUri,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to share file';
        setError(message);
      }
    };

    const getBatchGroup = (imagePath: string) => {
      const match = imagePath.match(/scan-(\d+)-(\d+)\.(jpg|jpeg|png)$/i);
      if (!match) {
        return {images: [imagePath], selectedIndex: 0};
      }

      const batchId = match[1];
      const batchImages = savedImages
        .filter(path => path.includes(`scan-${batchId}-`))
        .sort((a, b) => {
          const aIndex = Number(a.match(/scan-\d+-(\d+)\.(jpg|jpeg|png)$/i)?.[1] ?? 0);
          const bIndex = Number(b.match(/scan-\d+-(\d+)\.(jpg|jpeg|png)$/i)?.[1] ?? 0);
          return aIndex - bIndex;
        });
      const selectedIndex = Math.max(0, batchImages.findIndex(path => path === imagePath));
      return {images: batchImages.length > 0 ? batchImages : [imagePath], selectedIndex};
    };

    const openExportModal = async (imagePaths: string[]) => {
      try {
        const totalBytes = (
          await Promise.all(
            imagePaths.map(path => RNFS.stat(path.replace('file://', '')).then(s => Number(s.size))),
          )
        ).reduce((sum, size) => sum + size, 0);

        const totalSizeMb = Math.max(0.1, totalBytes / (1024 * 1024));
        const maxSizeMb = Number(totalSizeMb.toFixed(1));
        const minSizeMb = Number(Math.max(0.1, totalSizeMb * 0.1).toFixed(1));
        const boundedMin = Math.min(minSizeMb, maxSizeMb);

        setExportMinSizeMb(boundedMin);
        setExportMaxSizeMb(maxSizeMb);
        setExportTargetSizeMb(maxSizeMb);
        if (!exportFileName.trim()) {
          setExportFileName(`scan-${Date.now()}`);
        }
        setExportModalVisible(true);
      } catch {
        setError('Failed to prepare custom export settings.');
      }
    };

    const confirmCustomExport = async () => {
      const boundedTarget = Math.min(
        exportMaxSizeMb,
        Math.max(exportMinSizeMb, exportTargetSizeMb),
      );
      setExportTargetSizeMb(Number(boundedTarget.toFixed(1)));
      setExportModalVisible(false);
      await saveToDevice(selectedImages, selectedImageIndex);
    };

    const groupedSavedItems = useMemo(() => {
      const groups = new Map<
        string,
        {
          id: string;
          coverUri: string;
          images: string[];
          count: number;
          name: string;
        }
      >();
      const orderedIds: string[] = [];

      for (const path of savedImages) {
        const match = path.match(/scan-(\d+)-(\d+)\.(jpg|jpeg|png)$/i);
        const groupId = match ? `batch-${match[1]}` : `single-${path}`;

        if (!groups.has(groupId)) {
          const defaultName = match ? `Scan ${match[1]}` : 'Single Scan';
          groups.set(groupId, {
            id: groupId,
            coverUri: path,
            images: [path],
            count: 1,
            name: customGroupNames[groupId] ?? defaultName,
          });
          orderedIds.push(groupId);
        } else {
          const group = groups.get(groupId)!;
          group.images.push(path);
          group.count = group.images.length;
        }
      }

      for (const id of orderedIds) {
        const group = groups.get(id)!;
        group.images.sort((a, b) => {
          const aIndex = Number(a.match(/scan-\d+-(\d+)\.(jpg|jpeg|png)$/i)?.[1] ?? 0);
          const bIndex = Number(b.match(/scan-\d+-(\d+)\.(jpg|jpeg|png)$/i)?.[1] ?? 0);
          return aIndex - bIndex;
        });
      }

      return orderedIds.map(id => groups.get(id)!);
    }, [customGroupNames, savedImages]);

    const handleOpenRename = (groupId: string, currentName: string) => {
      setRenameTargetGroupId(groupId);
      setRenameValue(currentName);
      setRenameModalVisible(true);
    };

    const handleConfirmRename = () => {
      const trimmed = renameValue.trim();
      if (!renameTargetGroupId || !trimmed) {
        setRenameModalVisible(false);
        return;
      }
      setCustomGroupNames(prev => ({
        ...prev,
        [renameTargetGroupId]: trimmed,
      }));
      setRenameModalVisible(false);
    };

    const handleDeleteGroup = (groupId: string, images: string[]) => {
      Alert.alert('Delete scan', 'Swipe action selected. Delete this scan?', [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const imageUri of images) {
                const path = imageUri.replace('file://', '');
                if (await RNFS.exists(path)) {
                  await RNFS.unlink(path);
                }
              }
              setCustomGroupNames(prev => {
                const next = {...prev};
                delete next[groupId];
                return next;
              });
              await loadSavedImages();
              setSuccess('Scan deleted.');
            } catch {
              setError('Failed to delete scan.');
            }
          },
        },
      ]);
    };

    const openPreviewItem = (coverUri: string) => {
      const {images, selectedIndex} = getBatchGroup(coverUri);
      setSelectedImages(images);
      setSelectedImageIndex(selectedIndex);
      setSelectedImageRotation(0);
      setExportFileName(`scan-${Date.now()}`);
      setExportSize('A4');
    };

    if (selectedImages.length > 0) {
      const currentImage = selectedImages[selectedImageIndex] ?? selectedImages[0];
      return (
        <SelectedImageScreen
          imageUri={currentImage}
          totalImages={selectedImages.length}
          currentImageIndex={selectedImageIndex}
          isDarkMode={isDarkMode}
          savingToDevice={savingToDevice}
          rotation={selectedImageRotation}
          onClose={() => {
            setSelectedImages([]);
            setSelectedImageIndex(0);
            setSelectedImageRotation(0);
          }}
          onNextImage={() => {
            setSelectedImageRotation(0);
            setSelectedImageIndex(prev => Math.min(prev + 1, selectedImages.length - 1));
          }}
          onPreviousImage={() => {
            setSelectedImageRotation(0);
            setSelectedImageIndex(prev => Math.max(prev - 1, 0));
          }}
          onRotate={() =>
            setSelectedImageRotation(prevRotation => (prevRotation + 90) % 360)
          }
          onShare={() => shareSelected(currentImage)}
          exportModalVisible={exportModalVisible}
          onOpenExportModal={() => openExportModal(selectedImages)}
          onCloseExportModal={() => setExportModalVisible(false)}
          exportFileName={exportFileName}
          onExportFileNameChange={setExportFileName}
          exportMinSizeMb={exportMinSizeMb}
          exportMaxSizeMb={exportMaxSizeMb}
          exportTargetSizeMb={exportTargetSizeMb}
          onExportTargetSizeMbChange={setExportTargetSizeMb}
          exportSize={exportSize}
          onExportSizeChange={setExportSize}
          onSave={confirmCustomExport}
        />
      );
    }
  
    return (
      <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
        <FlatList
          data={groupedSavedItems}
          keyExtractor={item => item.id}
          numColumns={1}
          contentContainerStyle={styles.content}
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
            <Swipeable
              rightThreshold={swipeThreshold}
              overshootRight={false}
              friction={2}
              renderRightActions={() => (
                <View style={[styles.swipeRightActions, {width: swipeActionWidth}]}>
                  <Pressable
                    style={styles.swipeDeleteAction}
                    onPress={() => handleDeleteGroup(item.id, item.images)}>
                    <MaterialIcons name="delete" size={22} color="#fff" />
                    <Text style={styles.swipeDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              )}>
              <View style={[styles.gridItem, isDarkMode && styles.previewBoxDark]}>
                <Pressable style={styles.gridImagePressable} onPress={() => openPreviewItem(item.coverUri)}>
                <Image
                  source={{uri: toDisplayUri(item.coverUri)}}
                  style={styles.gridImage}
                  resizeMode="cover"
                />
                  {item.count > 1 ? (
                    <View style={styles.multiBadge}>
                      <Text style={styles.multiBadgeText}>{item.count}</Text>
                    </View>
                  ) : null}
                </Pressable>
                <View style={styles.itemRightPanel}>
                  <View style={styles.itemMeta}>
                    <Text style={[styles.itemName, isDarkMode && styles.textDark]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemCount}>
                      {item.count}/{item.count} image{item.count > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.itemActions}>
                    <Pressable
                      style={[styles.iconActionButton, styles.actionEdit]}
                      onPress={() => handleOpenRename(item.id, item.name)}>
                      <MaterialIcons name="drive-file-rename-outline" size={18} color="#fff" />
                      <Text style={styles.actionText}>Rename</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.iconActionButton, styles.actionOpen]}
                      onPress={() => openPreviewItem(item.coverUri)}>
                      <MaterialIcons name="edit" size={18} color="#fff" />
                      <Text style={styles.actionText}>Edit</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Swipeable>
          )}
        />
        <Modal
          visible={renameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRenameModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, isDarkMode && styles.previewBoxDark]}>
              <Text style={[styles.modalTitle, isDarkMode && styles.textDark]}>Rename scan</Text>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                style={[styles.renameInput, isDarkMode && styles.renameInputDark]}
                placeholder="Enter name"
                placeholderTextColor="#9ca3af"
              />
              <View style={styles.modalActions}>
                <Pressable style={[styles.actionButton, styles.actionEdit]} onPress={() => setRenameModalVisible(false)}>
                  <Text style={styles.actionText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.actionDelete]} onPress={handleConfirmRename}>
                  <Text style={styles.actionText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
  
        <View style={styles.fabGroup}>
          <Pressable
            style={[styles.fabPrimary, scanning && styles.buttonDisabled]}
            onPress={captureAndSaveDocument}
            disabled={scanning}>
            {scanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <MaterialIcons name="photo-camera" size={26} color="#fff" />
            )}
          </Pressable>
        </View>
  
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
      width: '100%',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#d1d5db',
      backgroundColor: '#fff',
      flexDirection: 'row',
      padding: 10,
      alignItems: 'center',
      gap: 10,
    },
    gridImage: {
      width: '100%',
      height: '100%',
    },
    gridImagePressable: {
      width: 88,
      height: 110,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#d1d5db',
    },
    multiBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(17,24,39,0.8)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    multiBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    itemRightPanel: {
      flex: 1,
      justifyContent: 'space-between',
      minHeight: 110,
    },
    itemMeta: {
      gap: 2,
    },
    itemName: {
      color: '#111827',
      fontSize: 13,
      fontWeight: '700',
    },
    itemCount: {
      color: '#6b7280',
      fontSize: 12,
    },
    itemActions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconActionButton: {
      flex: 1,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 8,
    },
    actionButton: {
      flex: 1,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    actionEdit: {
      backgroundColor: '#2563eb',
    },
    actionDelete: {
      backgroundColor: '#dc2626',
    },
    actionOpen: {
      backgroundColor: '#059669',
    },
    actionText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 12,
    },
    swipeDeleteAction: {
      flex: 1,
      marginVertical: 4,
      marginLeft: 8,
      borderRadius: 10,
      backgroundColor: '#dc2626',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    swipeRightActions: {
      justifyContent: 'center',
    },
    swipeDeleteText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      borderRadius: 12,
      backgroundColor: '#fff',
      padding: 12,
      gap: 10,
    },
    modalTitle: {
      color: '#111827',
      fontSize: 16,
      fontWeight: '700',
    },
    renameInput: {
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: '#111827',
      backgroundColor: '#fff',
    },
    renameInputDark: {
      borderColor: '#4b5563',
      color: '#f9fafb',
      backgroundColor: '#111827',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 8,
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
  });
  export default AppContent