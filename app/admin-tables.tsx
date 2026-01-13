import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react-native';
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
  const [saving, setSaving] = useState(false);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const tablesDb = await tableService.getAll();
      const tablesData = tablesDb.map(t => ({
        id: t.id,
        number: t.number,
        status: t.status,
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
    const nextNumber = tables.length > 0 ? Math.max(...tables.map(t => t.number)) + 1 : 1;
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
    <View className="bg-white border-b border-gray-200 px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          <View className={`w-14 h-14 rounded-lg items-center justify-center ${
            item.status === 'occupied' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            <Text className={`text-xl font-bold ${
              item.status === 'occupied' ? 'text-blue-600' : 'text-gray-600'
            }`}>
              {item.number}
            </Text>
          </View>
          <View>
            <Text className="text-base font-semibold text-gray-900">
              Table {item.number}
            </Text>
            <View className={`mt-1 px-2 py-0.5 rounded-full self-start ${
              item.status === 'occupied' ? 'bg-blue-100' : 'bg-green-100'
            }`}>
              <Text className={`text-xs font-medium ${
                item.status === 'occupied' ? 'text-blue-700' : 'text-green-700'
              }`}>
                {item.status === 'occupied' ? 'Occupée' : 'Libre'}
              </Text>
            </View>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg"
          >
            <Pencil size={18} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className={`w-10 h-10 items-center justify-center rounded-lg ${
              item.status === 'occupied' ? 'bg-gray-100' : 'bg-red-50'
            }`}
            disabled={item.status === 'occupied'}
          >
            <Trash2 size={18} color={item.status === 'occupied' ? '#D1D5DB' : '#EF4444'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-bold text-gray-900">Tables</Text>
              <Text className="text-sm text-gray-500">{tables.length} tables</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={openAddModal}
            className="flex-row items-center gap-2 bg-blue-500 px-4 py-2 rounded-lg"
          >
            <Plus size={18} color="#FFFFFF" />
            <Text className="text-white font-semibold">Ajouter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Banner */}
      <View className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Text className="text-sm text-gray-600">
          {tables.filter(t => t.status === 'open').length} libres • {' '}
          {tables.filter(t => t.status === 'occupied').length} occupées
        </Text>
      </View>

      {/* Tables List */}
      <FlatList
        data={tables}
        renderItem={renderTable}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingTable ? 'Modifier Table' : 'Nouvelle Table'}
      >
        <View className="gap-4 pb-6">
          <Input
            label="Numéro de table"
            value={formNumber}
            onChangeText={setFormNumber}
            placeholder="Ex: 13"
            keyboardType="numeric"
            autoFocus
          />

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              className="flex-1 py-3 bg-gray-100 rounded-lg"
            >
              <Text className="text-center font-semibold text-gray-700">Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              className="flex-1 py-3 bg-blue-500 rounded-lg"
            >
              <Text className="text-center font-semibold text-white">
                {editingTable ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
