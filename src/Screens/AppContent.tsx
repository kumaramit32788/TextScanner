
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Dimensions,
  Image,
  PermissionsAndroid,
  Platform,
  ToastAndroid,
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
import ShareFile from 'react-native-share';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import SelectedImageScreen from './SelectedImageScreen';
import {formatLastSavedPath, toSafeFileName} from './AppContent.helpers';
import DashboardScreen, {GroupedSavedItem} from './DashboardScreen';

type AppContentStackParamList = {
  Dashboard: undefined;
  Preview: undefined;
};

const AppContentStack = createNativeStackNavigator<AppContentStackParamList>();

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

    const captureAndAppendToCurrentSelection = async () => {
      setError('');
      setSuccess('');

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

        const currentBatchMatch = selectedImages[0]?.match(/scan-(\d+)-(\d+)\.(jpg|jpeg|png)$/i);
        const batchId = currentBatchMatch?.[1] ?? String(Date.now());
        const highestIndexInSelection = selectedImages.reduce((maxIndex, imageUri) => {
          const match = imageUri.match(/scan-\d+-(\d+)\.(jpg|jpeg|png)$/i);
          const index = Number(match?.[1] ?? 0);
          return Math.max(maxIndex, index);
        }, 0);

        const savedPaths: string[] = [];
        for (const [index, sourcePath] of sourcePaths.entries()) {
          const normalizedSourcePath = sourcePath.replace('file://', '');
          const destPath = `${scansDir}/scan-${batchId}-${highestIndexInSelection + index + 1}.jpg`;
          await RNFS.copyFile(normalizedSourcePath, destPath);
          savedPaths.push(`file://${destPath}`);
        }

        setSelectedImages(prev => [...prev, ...savedPaths]);
        setSelectedImageIndex(selectedImages.length);
        setSelectedImageRotation(0);
        setLastSavedPath(savedPaths[savedPaths.length - 1]);
        await loadSavedImages();
        setSuccess(
          `${savedPaths.length} page${savedPaths.length > 1 ? 's' : ''} added to this scan.`,
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to add new capture';
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
        let sourcePdfPath = '';
        if (lastSavedPath && lastSavedPath.toLowerCase().endsWith('.pdf')) {
          const resolvedSavedPdfPath = await resolveExistingPath(lastSavedPath);
          if (await RNFS.exists(resolvedSavedPdfPath)) {
            sourcePdfPath = resolvedSavedPdfPath;
          }
        }

        if (!sourcePdfPath) {
          const sourceImages = selectedImages.length > 0 ? selectedImages : [imagePath];
          const preparedImagePaths = await Promise.all(
            sourceImages.map((path, index) =>
              index === selectedImageIndex
                ? createRotatedImageIfNeeded(path, selectedImageRotation)
                : Promise.resolve(path.replace('file://', '')),
            ),
          );

          const sharePdfName = `scan-share-${Date.now()}`;
          const pdfParams: {
            imagePaths: string[];
            name: string;
            paperSize?: 'A4' | 'Letter';
          } = {
            imagePaths: preparedImagePaths,
            name: sharePdfName,
          };

          if (exportSize !== 'ORIGINAL') {
            pdfParams.paperSize = exportSize;
          }

          const {filePath} = await createPdf(pdfParams);
          const resolvedPdfPath = await resolveExistingPath(filePath);
          sourcePdfPath = resolvedPdfPath;
          setLastSavedPath(`file://${resolvedPdfPath}`);
        }

        const shareablePdfPath = `${RNFS.CachesDirectoryPath}/scan-share-${Date.now()}.pdf`;
        if (await RNFS.exists(shareablePdfPath)) {
          await RNFS.unlink(shareablePdfPath);
        }
        await RNFS.copyFile(sourcePdfPath, shareablePdfPath);

        await ShareFile.open({
          url: `file://${shareablePdfPath}`,
          type: 'application/pdf',
          filename: 'scanned-document',
          failOnCancel: false,
          title: 'Share PDF',
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
      const groups = new Map<string, GroupedSavedItem>();
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

    const openPreviewItem = (
      coverUri: string,
      preferredName?: string,
      navigateToPreview?: () => void,
    ) => {
      const {images, selectedIndex} = getBatchGroup(coverUri);
      setSelectedImages(images);
      setSelectedImageIndex(selectedIndex);
      setSelectedImageRotation(0);
      const normalizedPreferredName = preferredName ? toSafeFileName(preferredName) : '';
      setExportFileName(normalizedPreferredName || `scan-${Date.now()}`);
      setExportSize('A4');
      navigateToPreview?.();
    };

    const closePreviewState = () => {
      setSelectedImages([]);
      setSelectedImageIndex(0);
      setSelectedImageRotation(0);
      setExportModalVisible(false);
    };

    const renderPreviewScreen = (navigation: {goBack: () => void}) => {
      const currentImage = selectedImages[selectedImageIndex] ?? selectedImages[0];
      if (!currentImage) {
        return null;
      }

      return (
        <SelectedImageScreen
          imageUri={currentImage}
          totalImages={selectedImages.length}
          currentImageIndex={selectedImageIndex}
          isDarkMode={isDarkMode}
          savingToDevice={savingToDevice}
          rotation={selectedImageRotation}
          onClose={() => {
            closePreviewState();
            navigation.goBack();
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
          onAddCapture={captureAndAppendToCurrentSelection}
          capturing={scanning}
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
    };

    const renderDashboardScreen = (navigation: {navigate: (name: 'Preview') => void}) => (
      <DashboardScreen
        isDarkMode={isDarkMode}
        groupedSavedItems={groupedSavedItems}
        refreshing={refreshing}
        onRefresh={onRefresh}
        swipeThreshold={swipeThreshold}
        swipeActionWidth={swipeActionWidth}
        onDeleteGroup={handleDeleteGroup}
        onOpenRename={handleOpenRename}
        onOpenPreview={(coverUri, preferredName) =>
          openPreviewItem(coverUri, preferredName, () => navigation.navigate('Preview'))
        }
        renameModalVisible={renameModalVisible}
        onCloseRenameModal={() => setRenameModalVisible(false)}
        renameValue={renameValue}
        onChangeRenameValue={setRenameValue}
        onConfirmRename={handleConfirmRename}
        scanning={scanning}
        onCapture={captureAndSaveDocument}
        success={success}
        error={error}
        lastSavedPath={lastSavedPath}
        formatLastSavedPath={formatLastSavedPath}
        toDisplayUri={toDisplayUri}
      />
    );
  
    return (
      <AppContentStack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{headerShown: false, animation: 'slide_from_right'}}>
        <AppContentStack.Screen name="Dashboard">
          {({navigation}) => renderDashboardScreen(navigation)}
        </AppContentStack.Screen>
        <AppContentStack.Screen
          name="Preview"
          listeners={{
            blur: () => {
              closePreviewState();
            },
          }}>
          {({navigation}) => renderPreviewScreen(navigation)}
        </AppContentStack.Screen>
      </AppContentStack.Navigator>
    );
  }


  export default AppContent