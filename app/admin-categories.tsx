import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, Grid3x3 } from 'lucide-react-native';
import { Modal, Input } from '@/components/ui';

interface Category {
  id: string;
  name: string;
  order: number;
  productCount: number;
}

// Mock data
const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'Boissons Chaudes', order: 1, productCount: 7 },
  { id: '2', name: 'Boissons Froides', order: 2, productCount: 7 },
  { id: '3', name: 'Jus Frais', order: 3, productCount: 6 },
  { id: '4', name: 'Pâtisserie', order: 4, productCount: 7 },
  { id: '5', name: 'Sandwichs', order: 5, productCount: 6 },
  { id: '6', name: 'Salades', order: 6, productCount: 4 },
];

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');

  const openAddModal = () => {
    setEditingCategory(null);
    setFormName('');
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom de catégorie');
      return;
    }

    if (editingCategory) {
      // Update
      setCategories(prev => 
        prev.map(c => c.id === editingCategory.id ? { ...c, name: formName.trim() } : c)
      );
    } else {
      // Create
      const newCategory: Category = {
        id: Date.now().toString(),
        name: formName.trim(),
        order: categories.length + 1,
        productCount: 0,
      };
      setCategories(prev => [...prev, newCategory]);
    }

    setShowModal(false);
    // TODO: Sync with Supabase
  };

  const handleDelete = (category: Category) => {
    if (category.productCount > 0) {
      Alert.alert(
        'Attention',
        `Cette catégorie contient ${category.productCount} produits. Veuillez d'abord déplacer ou supprimer les produits.`
      );
      return;
    }

    Alert.alert(
      'Supprimer',
      `Voulez-vous supprimer "${category.name}"?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setCategories(prev => prev.filter(c => c.id !== category.id));
            // TODO: Sync with Supabase
          },
        },
      ]
    );
  };

  const renderCategory = ({ item, index }: { item: Category; index: number }) => (
    <View className="bg-white border-b border-gray-200 px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center">
            <Text className="text-lg font-bold text-gray-500">{index + 1}</Text>
          </View>
          <View>
            <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
            <Text className="text-sm text-gray-500 mt-1">
              {item.productCount} produits
            </Text>
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
            className="w-10 h-10 items-center justify-center bg-red-50 rounded-lg"
          >
            <Trash2 size={18} color="#EF4444" />
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
              <Text className="text-xl font-bold text-gray-900">Catégories</Text>
              <Text className="text-sm text-gray-500">{categories.length} catégories</Text>
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

      {/* Categories List */}
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Grid3x3 size={48} color="#D1D5DB" />
            <Text className="text-gray-400 mt-4 text-center text-base">
              Aucune catégorie
            </Text>
            <Text className="text-gray-400 mt-1 text-center text-sm">
              Appuyez sur Ajouter pour créer une catégorie
            </Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'Modifier Catégorie' : 'Nouvelle Catégorie'}
      >
        <View className="gap-4 pb-6">
          <Input
            label="Nom de la catégorie"
            value={formName}
            onChangeText={setFormName}
            placeholder="Ex: Boissons Chaudes"
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
                {editingCategory ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
