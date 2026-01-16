import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, Grid3x3 } from 'lucide-react-native';
import { Modal, Input } from '@/components/ui';
import { categoryService, productService } from '../lib/services';

interface Category {
  id: string;
  name: string;
  order: number;
  productCount: number;
}

export default function AdminCategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoriesDb, productsDb] = await Promise.all([
        categoryService.getAll(),
        productService.getAll(),
      ]);
      
      const safeCategories = Array.isArray(categoriesDb) ? categoriesDb : [];
      const safeProducts = Array.isArray(productsDb) ? productsDb : [];
      const categoriesData = safeCategories.filter(c => c && c.id).map(c => ({
        id: c.id,
        name: c.name || '',
        order: c.display_order || 0,
        productCount: safeProducts.filter(p => p && p.category_id === c.id).length,
      }));
      setCategories(categoriesData);
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
    setEditingCategory(null);
    setFormName('');
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un nom de catégorie');
      return;
    }

    setSaving(true);
    
    try {
      if (editingCategory) {
        // Update in Supabase
        await categoryService.update(editingCategory.id, { name: formName.trim() });
        setCategories(prev => 
          prev.map(c => c.id === editingCategory.id ? { ...c, name: formName.trim() } : c)
        );
      } else {
        // Create in Supabase
        const newCategoryDb = await categoryService.create({
          name: formName.trim(),
          display_order: categories.length + 1,
        });
        const newCategory: Category = {
          id: newCategoryDb.id,
          name: newCategoryDb.name,
          order: newCategoryDb.display_order,
          productCount: 0,
        };
        setCategories(prev => [...prev, newCategory]);
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la catégorie');
    } finally {
      setSaving(false);
    }
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
          onPress: async () => {
            try {
              await categoryService.delete(category.id);
              setCategories(prev => prev.filter(c => c.id !== category.id));
            } catch (error) {
              console.error('Error deleting category:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la catégorie');
            }
          },
        },
      ]
    );
  };

  const renderCategory = ({ item, index }: { item: Category; index: number }) => (
    <View style={{
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      paddingHorizontal: 16,
      paddingVertical: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 40,
            height: 40,
            backgroundColor: '#F3F4F6',
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#6B7280' }}>{index + 1}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{item.name}</Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
              {item.productCount} produits
            </Text>
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
              backgroundColor: '#FEE2E2',
              borderRadius: 10,
            }}
          >
            <Trash2 size={18} color="#EF4444" />
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>Catégories</Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>{categories.length} catégories</Text>
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

      {/* Categories List */}
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Grid3x3 size={48} color="#D1D5DB" />
            <Text style={{ color: '#9CA3AF', marginTop: 16, textAlign: 'center', fontSize: 15 }}>
              Aucune catégorie
            </Text>
            <Text style={{ color: '#9CA3AF', marginTop: 4, textAlign: 'center', fontSize: 13 }}>
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
        <View style={{ gap: 16, paddingBottom: 24 }}>
          <Input
            label="Nom de la catégorie"
            value={formName}
            onChangeText={setFormName}
            placeholder="Ex: Boissons Chaudes"
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
                {editingCategory ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
