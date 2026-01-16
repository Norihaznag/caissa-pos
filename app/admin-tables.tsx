import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, LayoutGrid, List, Table2 } from 'lucide-react-native';
import { Modal, Input } from '@/components/ui';
import { tableService } from '../lib/services';

interface Table {
  id: string;
  number: number;
  status: 'open' | 'occupied';
}

export default function AdminTablesScreen() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formNumber, setFormNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableViewMode, setTableViewMode] = useState<'list' | 'grid'>('list');
  const [saving, setSaving] = useState(false);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const tablesDb = await tableService.getAll();
      const safeTablesDb = Array.isArray(tablesDb) ? tablesDb : [];
      const tablesData = safeTablesDb.filter(t => t && t.id).map(t => ({
        id: t.id,
        number: t.number || 0,
        status: t.status || 'open',
      }));
      setTables(tablesData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditingTable(null);
    const validNumbers = tables.map(t => t?.number).filter((n): n is number => typeof n === 'number' && !isNaN(n));
    const nextNumber = validNumbers.length > 0 ? Math.max(...validNumbers) + 1 : 1;
    setFormNumber(nextNumber.toString());
    setShowModal(true);
  };

  const openEditModal = (table: Table) => {
    setEditingTable(table);
    setFormNumber(table.number.toString());
    setShowModal(true);
  };

  const handleSave = async () => {
    const tableNumber = parseInt(formNumber);
    
    if (isNaN(tableNumber) || tableNumber <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de table valide');
      return;
    }

    // Check for duplicate number
    const existingTable = tables.find(
      t => t.number === tableNumber && t.id !== editingTable?.id
    );
    if (existingTable) {
      Alert.alert('Erreur', `La table ${tableNumber} existe déjà`);
      return;
    }

    setSaving(true);
    
    try {
      if (editingTable) {
        // Update in Supabase
        await tableService.update(editingTable.id, { number: tableNumber });
        setTables(prev => 
          prev.map(t => t.id === editingTable.id ? { ...t, number: tableNumber } : t)
            .sort((a, b) => a.number - b.number)
        );
      } else {
        // Create in Supabase
        const newTableDb = await tableService.create({
          number: tableNumber,
          status: 'open',
          current_order_id: null,
        });
        const newTable: Table = {
          id: newTableDb.id,
          number: newTableDb.number,
          status: 'open',
        };
        setTables(prev => [...prev, newTable].sort((a, b) => a.number - b.number));
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving table:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la table');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (table: Table) => {
    if (table.status === 'occupied') {
      Alert.alert('Attention', 'Impossible de supprimer une table occupée');
      return;
    }

    Alert.alert(
      'Supprimer',
      `Voulez-vous supprimer la Table ${table.number}?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await tableService.delete(table.id);
              setTables(prev => prev.filter(t => t.id !== table.id));
            } catch (error) {
              console.error('Error deleting table:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la table');
            }
          },
        },
      ]
    );
  };

  const renderTable = ({ item }: { item: Table }) => (
    <View style={{
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      paddingHorizontal: 16,
      paddingVertical: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: item.status === 'occupied' ? '#DBEAFE' : '#F3F4F6',
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: item.status === 'occupied' ? '#2563EB' : '#4B5563',
            }}>
              {item.number}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>
              Table {item.number}
            </Text>
            <View style={{
              marginTop: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 12,
              alignSelf: 'flex-start',
              backgroundColor: item.status === 'occupied' ? '#DBEAFE' : '#DCFCE7',
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '500',
                color: item.status === 'occupied' ? '#1D4ED8' : '#166534',
              }}>
                {item.status === 'occupied' ? 'Occupée' : 'Libre'}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F3F4F6',
              borderRadius: 10,
            }}
          >
            <Pencil size={18} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: item.status === 'occupied' ? '#F3F4F6' : '#FEE2E2',
              borderRadius: 10,
            }}
            disabled={item.status === 'occupied'}
          >
            <Trash2 size={18} color={item.status === 'occupied' ? '#D1D5DB' : '#EF4444'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F3F4F6',
                borderRadius: 10,
              }}
            >
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>Tables</Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>{tables.length} tables</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={openAddModal}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#3B82F6',
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>Ajouter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Banner + View Toggle */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 13, color: '#4B5563' }}>
          {tables.filter(t => t.status === 'open').length} libres • {' '}
          {tables.filter(t => t.status === 'occupied').length} occupées
        </Text>
        {/* Grid/List Toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#E5E7EB' }}>
          <TouchableOpacity
            onPress={() => setTableViewMode('list')}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: tableViewMode === 'list' ? '#EFF6FF' : 'transparent',
            }}
          >
            <List size={18} color={tableViewMode === 'list' ? '#3B82F6' : '#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTableViewMode('grid')}
            style={{
              padding: 6,
              borderRadius: 6,
              backgroundColor: tableViewMode === 'grid' ? '#EFF6FF' : 'transparent',
            }}
          >
            <LayoutGrid size={18} color={tableViewMode === 'grid' ? '#3B82F6' : '#9CA3AF'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tables List or Grid */}
      {tableViewMode === 'list' ? (
        <FlatList
          data={tables}
          renderItem={renderTable}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Table2 size={48} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', marginTop: 16 }}>Aucune table</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={tables}
          numColumns={3}
          key="grid"
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                aspectRatio: 1,
                backgroundColor: item.status === 'occupied' ? '#DBEAFE' : '#FFFFFF',
                borderRadius: 12,
                padding: 10,
                borderWidth: 1,
                borderColor: item.status === 'occupied' ? '#93C5FD' : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: '700', color: item.status === 'occupied' ? '#2563EB' : '#374151' }}>
                {item.number}
              </Text>
              <Text style={{ 
                fontSize: 11, 
                fontWeight: '500', 
                color: item.status === 'occupied' ? '#2563EB' : '#16A34A',
                marginTop: 4,
              }}>
                {item.status === 'occupied' ? 'OCCUPÉE' : 'LIBRE'}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Table2 size={48} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', marginTop: 16 }}>Aucune table</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingTable ? 'Modifier Table' : 'Nouvelle Table'}
      >
        <View style={{ gap: 16, paddingBottom: 24 }}>
          <Input
            label="Numéro de table"
            value={formNumber}
            onChangeText={setFormNumber}
            placeholder="Ex: 13"
            keyboardType="numeric"
            autoFocus
          />

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={{
                flex: 1,
                paddingVertical: 14,
                backgroundColor: '#F3F4F6',
                borderRadius: 10,
              }}
            >
              <Text style={{ textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: 15 }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={{
                flex: 1,
                paddingVertical: 14,
                backgroundColor: '#3B82F6',
                borderRadius: 10,
              }}
            >
              <Text style={{ textAlign: 'center', fontWeight: '600', color: '#FFFFFF', fontSize: 15 }}>
                {editingTable ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
