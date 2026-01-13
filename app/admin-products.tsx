import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, Search, Package } from 'lucide-react-native';
import { Modal, Input } from '@/components/ui';

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

// Mock data - TODO: Replace with Supabase
const MOCK_CATEGORIES: Category[] = [
  { id: '1', name: 'Boissons Chaudes' },
  { id: '2', name: 'Boissons Froides' },
  { id: '3', name: 'Jus' },
  { id: '4', name: 'Pâtisserie' },
  { id: '5', name: 'Sandwichs' },
  { id: '6', name: 'Salades' },
];

const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Café Noir', price: 5, categoryId: '1', categoryName: 'Boissons Chaudes' },
  { id: '2', name: 'Café au Lait', price: 7, categoryId: '1', categoryName: 'Boissons Chaudes' },
  { id: '3', name: 'Noisette', price: 6, categoryId: '1', categoryName: 'Boissons Chaudes' },
  { id: '4', name: 'Cappuccino', price: 12, categoryId: '1', categoryName: 'Boissons Chaudes' },
  { id: '5', name: 'Thé à la Menthe', price: 5, categoryId: '1', categoryName: 'Boissons Chaudes' },
  { id: '6', name: 'Coca Cola', price: 8, categoryId: '2', categoryName: 'Boissons Froides' },
  { id: '7', name: 'Fanta', price: 8, categoryId: '2', categoryName: 'Boissons Froides' },
  { id: '8', name: 'Jus d\'Orange', price: 15, categoryId: '3', categoryName: 'Jus' },
  { id: '9', name: 'Croissant', price: 8, categoryId: '4', categoryName: 'Pâtisserie' },
  { id: '10', name: 'Msemen', price: 3, categoryId: '4', categoryName: 'Pâtisserie' },
  { id: '11', name: 'Sandwich Thon', price: 18, categoryId: '5', categoryName: 'Sandwichs' },
  { id: '12', name: 'Salade Marocaine', price: 15, categoryId: '6', categoryName: 'Salades' },
];

export default function AdminProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [categories] = useState<Category[]>(MOCK_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');

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

  const handleSave = () => {
    if (!formName.trim() || !formPrice || !formCategoryId) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const category = categories.find(c => c.id === formCategoryId);
    const productData: Product = {
      id: editingProduct?.id || Date.now().toString(),
      name: formName.trim(),
      price: parseFloat(formPrice),
      categoryId: formCategoryId,
      categoryName: category?.name,
    };

    if (editingProduct) {
      // Update
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? productData : p));
    } else {
      // Create
      setProducts(prev => [...prev, productData]);
    }

    setShowModal(false);
    // TODO: Sync with Supabase
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
          onPress: () => {
            setProducts(prev => prev.filter(p => p.id !== product.id));
            // TODO: Sync with Supabase
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
