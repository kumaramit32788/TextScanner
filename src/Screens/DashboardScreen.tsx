import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {MaterialIcons} from '@react-native-vector-icons/material-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';

export type GroupedSavedItem = {
  id: string;
  coverUri: string;
  images: string[];
  count: number;
  name: string;
};

type DashboardScreenProps = {
  isDarkMode: boolean;
  groupedSavedItems: GroupedSavedItem[];
  refreshing: boolean;
  onRefresh: () => void;
  swipeThreshold: number;
  swipeActionWidth: number;
  onDeleteGroup: (groupId: string, images: string[]) => void;
  onOpenRename: (groupId: string, currentName: string) => void;
  onOpenPreview: (coverUri: string, preferredName?: string) => void;
  renameModalVisible: boolean;
  onCloseRenameModal: () => void;
  renameValue: string;
  onChangeRenameValue: (value: string) => void;
  onConfirmRename: () => void;
  scanning: boolean;
  onCapture: () => void;
  success: string;
  error: string;
  lastSavedPath: string;
  formatLastSavedPath: (path: string) => string;
  toDisplayUri: (path: string) => string;
};

function DashboardScreen({
  isDarkMode,
  groupedSavedItems,
  refreshing,
  onRefresh,
  swipeThreshold,
  swipeActionWidth,
  onDeleteGroup,
  onOpenRename,
  onOpenPreview,
  renameModalVisible,
  onCloseRenameModal,
  renameValue,
  onChangeRenameValue,
  onConfirmRename,
  scanning,
  onCapture,
  success,
  error,
  lastSavedPath,
  formatLastSavedPath,
  toDisplayUri,
}: DashboardScreenProps) {
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
            <View style={[styles.headerCard, isDarkMode && styles.previewBoxDark]}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                Document Scanner
              </Text>
              <View style={styles.headerMetaRow}>
                <Text style={[styles.metaPill, isDarkMode && styles.metaPillDark]}>
                  {groupedSavedItems.length} scan{groupedSavedItems.length === 1 ? '' : 's'}
                </Text>
                {lastSavedPath ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.lastSavedPill, isDarkMode && styles.lastSavedPillDark]}>
                    Last: {formatLastSavedPath(lastSavedPath)}
                  </Text>
                ) : null}
              </View>
            </View>
            {success ? <Text style={styles.success}>{success}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          <View style={[styles.previewBox, isDarkMode && styles.previewBoxDark]}>
            <Text style={[styles.previewPlaceholder, isDarkMode && styles.textDark]}>
               Tap SCAN to add your first one.
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
                  onPress={() => onDeleteGroup(item.id, item.images)}>
                  <MaterialIcons name="delete" size={22} color="#fff" />
                  <Text style={styles.swipeDeleteText}>Delete</Text>
                </Pressable>
              </View>
            )}>
            <View style={[styles.gridItem, isDarkMode && styles.previewBoxDark]}>
              <Pressable
                style={styles.gridImagePressable}
                onPress={() => onOpenPreview(item.coverUri, item.name)}>
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
                    onPress={() => onOpenRename(item.id, item.name)}>
                    <MaterialIcons name="drive-file-rename-outline" size={18} color="#fff" />
                    <Text style={styles.actionText}>Rename</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.iconActionButton, styles.actionOpen]}
                    onPress={() => onOpenPreview(item.coverUri, item.name)}>
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
        onRequestClose={onCloseRenameModal}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDarkMode && styles.previewBoxDark]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.textDark]}>Rename scan</Text>
            <TextInput
              value={renameValue}
              onChangeText={onChangeRenameValue}
              style={[styles.renameInput, isDarkMode && styles.renameInputDark]}
              placeholder="Enter name"
              placeholderTextColor="#9ca3af"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.actionButton, styles.actionEdit]}
                onPress={onCloseRenameModal}>
                <Text style={styles.actionText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.actionDelete]} onPress={onConfirmRename}>
                <Text style={styles.actionText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.fabGroup}>
        <Pressable
          style={[styles.fabPrimary, scanning && styles.buttonDisabled]}
          onPress={onCapture}
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
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#111827',
  },
  titleDark: {
    color: '#f9fafb',
  },
  headerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    fontSize: 12,
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: '600',
  },
  metaPillDark: {
    color: '#bfdbfe',
    backgroundColor: '#1e3a8a',
  },
  lastSavedPill: {
    flexShrink: 1,
    fontSize: 12,
    color: '#4b5563',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: '500',
  },
  lastSavedPillDark: {
    color: '#d1d5db',
    backgroundColor: '#374151',
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
  error: {
    color: '#dc2626',
  },
  success: {
    color: '#059669',
    fontWeight: '600',
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

export default DashboardScreen;
