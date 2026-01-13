import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, Search, Package } from 'lucide-react-native';
import { Modal, Input } from '@/components/ui';
import { productService, categoryService } from '../lib/services';

// Types
interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function AdminProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsDb, categoriesDb] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
      ]);
      
      const categoriesData = categoriesDb.map(c => ({
        id: c.id,
        name: c.name,
      }));
      setCategories(categoriesData);
      
      const productsData = productsDb.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        categoryId: p.category_id,
        categoryName: categoriesData.find(c => c.id === p.category_id)?.name,
      }));
      setProducts(productsData);
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

  // Filter products by search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormCategoryId(categories[0]?.id || '');
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormCategoryId(product.categoryId);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrice || !formCategoryId) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setSaving(true);
    
    try {
      const category = categories.find(c => c.id === formCategoryId);
      
      if (editingProduct) {
        // Update in Supabase
        await productService.update(editingProduct.id, {
          name: formName.trim(),
          price: parseFloat(formPrice),
          category_id: formCategoryId,
        });
        
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
          ...p,
          name: formName.trim(),
          price: parseFloat(formPrice),
          categoryId: formCategoryId,
          categoryName: category?.name,
        } : p));
      } else {
        // Create in Supabase
        const newProduct = await productService.create({
          name: formName.trim(),
          price: parseFloat(formPrice),
          category_id: formCategoryId,
          is_active: true,
        });
        
        setProducts(prev => [...prev, {
          id: newProduct.id,
          name: newProduct.name,
          price: newProduct.price,
          categoryId: newProduct.category_id,
          categoryName: category?.name,
        }]);
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer le produit');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Supprimer',
      `Voulez-vous supprimer "${product.name}"?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.delete(product.id);
              setProducts(prev => prev.filter(p => p.id !== product.id));
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le produit');
            }
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View className="bg-white border-b border-gray-200 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
          <Text className="text-sm text-gray-500 mt-1">{item.categoryName}</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="bg-blue-100 px-3 py-1 rounded-full">
            <Text className="text-blue-700 font-bold">{item.price} MAD</Text>
          </View>
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
              <Text className="text-xl font-bold text-gray-900">Produits</Text>
              <Text className="text-sm text-gray-500">{products.length} produits</Text>
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

      {/* Search */}
      <View className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <View className="flex-row items-center bg-white border border-gray-300 rounded-lg px-3">
          <Search size={20} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un produit..."
            className="flex-1 py-3 px-2 text-base"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Package size={48} color="#D1D5DB" />
            <Text className="text-gray-400 mt-4 text-center text-base">
              Aucun produit trouvé
            </Text>
            <Text className="text-gray-400 mt-1 text-center text-sm">
              Appuyez sur + pour ajouter un produit
            </Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'Modifier Produit' : 'Nouveau Produit'}
      >
        <View className="gap-4 pb-6">
          <Input
            label="Nom du produit"
            value={formName}
            onChangeText={setFormName}
            placeholder="Ex: Café au Lait"
          />
          
          <Input
            label="Prix (MAD)"
            value={formPrice}
            onChangeText={setFormPrice}
            placeholder="Ex: 10"
            keyboardType="numeric"
          />

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Catégorie</Text>
            <View className="flex-row flex-wrap gap-2">
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setFormCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-full border ${
                    formCategoryId === cat.id
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      formCategoryId === cat.id ? 'text-white' : 'text-gray-700'
                    }`}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

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
                {editingProduct ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
