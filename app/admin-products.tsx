import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, Search, Package, LayoutGrid, List, Camera, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Input } from '@/components/ui';
import { productService, categoryService, imageService } from '../lib/services';

// Types
interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName?: string;
  imageUrl?: string;
  isActive?: boolean;
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
  const [productViewMode, setProductViewMode] = useState<'list' | 'grid'>('list');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formImageUri, setFormImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsDb, categoriesDb] = await Promise.all([
        productService.getAll(),
        categoryService.getAll(),
      ]);
      
      const safeCategoriesDb = Array.isArray(categoriesDb) ? categoriesDb : [];
      const safeProductsDb = Array.isArray(productsDb) ? productsDb : [];
      
      const categoriesData = safeCategoriesDb.filter(c => c && c.id).map(c => ({
        id: c.id,
        name: c.name || '',
      }));
      setCategories(categoriesData);
      
      const productsData = safeProductsDb.filter(p => p && p.id).map(p => ({
        id: p.id,
        name: p.name || '',
        price: p.price || 0,
        categoryId: p.category_id || '',
        categoryName: categoriesData.find(c => c.id === p.category_id)?.name,
        imageUrl: p.image_url,
        isActive: p.is_active ?? true,
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
  const filteredProducts = Array.isArray(products) 
    ? products.filter(p => 
        p && p.name && (p.name.toLowerCase().includes((searchQuery || '').toLowerCase()))
      )
    : [];

  const openAddModal = () => {
    if (categories.length === 0) {
      Alert.alert('Erreur', 'Veuillez d\'abord créer une catégorie');
      return;
    }
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormCategoryId(categories[0]?.id || '');
    setFormImageUri(null);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormCategoryId(product.categoryId);
    setFormImageUri(product.imageUrl || null);
    setShowModal(true);
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la galerie');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la caméra');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormImageUri(result.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Ajouter une image',
      'Choisissez une option',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Prendre une photo', onPress: takePhoto },
        { text: 'Galerie', onPress: pickImage },
      ]
    );
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrice || !formCategoryId) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const parsedPrice = parseFloat(formPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix valide');
      return;
    }

    setSaving(true);
    
    try {
      const category = categories.find(c => c.id === formCategoryId);
      let imageUrl: string | undefined = undefined;

      // Handle image upload if there's a new local image
      if (formImageUri && formImageUri.startsWith('file://')) {
        setUploadingImage(true);
        const productId = editingProduct?.id || `temp-${Date.now()}`;
        const uploadedUrl = await imageService.uploadProductImage(formImageUri, productId);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
        setUploadingImage(false);
      } else if (formImageUri && !formImageUri.startsWith('file://')) {
        // Keep existing URL
        imageUrl = formImageUri;
      }
      
      if (editingProduct) {
        // Update in Supabase
        await productService.update(editingProduct.id, {
          name: formName.trim(),
          price: parsedPrice,
          category_id: formCategoryId,
          image_url: imageUrl || null,
        });
        
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? {
          ...p,
          name: formName.trim(),
          price: parsedPrice,
          categoryId: formCategoryId,
          categoryName: category?.name,
          imageUrl: imageUrl,
        } : p));
      } else {
        // Create in Supabase
        const newProduct = await productService.create({
          name: formName.trim(),
          price: parsedPrice,
          category_id: formCategoryId,
          is_active: true,
          image_url: imageUrl,
        });

        // If we used a temp ID, upload with the real ID
        if (imageUrl && formImageUri?.startsWith('file://')) {
          const realUrl = await imageService.uploadProductImage(formImageUri, newProduct.id);
          if (realUrl) {
            await productService.update(newProduct.id, { image_url: realUrl });
            imageUrl = realUrl;
          }
        }
        
        setProducts(prev => [...prev, {
          id: newProduct.id,
          name: newProduct.name,
          price: newProduct.price,
          categoryId: newProduct.category_id,
          categoryName: category?.name,
          imageUrl: imageUrl,
        }]);
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer le produit');
    } finally {
      setSaving(false);
      setUploadingImage(false);
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

  // Toggle product availability (out of stock)
  const toggleAvailability = async (product: Product) => {
    const newStatus = !product.isActive;
    try {
      await productService.update(product.id, { is_active: newStatus });
      setProducts(prev => prev.map(p => 
        p.id === product.id ? { ...p, isActive: newStatus } : p
      ));
    } catch (error) {
      console.error('Error toggling availability:', error);
      Alert.alert('Erreur', 'Impossible de modifier la disponibilité');
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={{
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      paddingHorizontal: 16,
      paddingVertical: 14,
      opacity: item.isActive === false ? 0.5 : 1,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
          {/* Product Image */}
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{
                width: 50,
                height: 50,
                borderRadius: 8,
                backgroundColor: '#F3F4F6',
              }}
            />
          ) : (
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 8,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Package size={24} color="#9CA3AF" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{item.name}</Text>
              {item.isActive === false && (
                <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#DC2626' }}>ÉPUISÉ</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{item.categoryName}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 }}>
            <Text style={{ color: '#1D4ED8', fontWeight: '700', fontSize: 13 }}>{item.price} MAD</Text>
          </View>
          <TouchableOpacity
            onPress={() => toggleAvailability(item)}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: item.isActive !== false ? '#DCFCE7' : '#FEE2E2',
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 14 }}>{item.isActive !== false ? '✓' : '✕'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F3F4F6',
              borderRadius: 8,
            }}
          >
            <Pencil size={16} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FEE2E2',
              borderRadius: 8,
            }}
          >
            <Trash2 size={16} color="#EF4444" />
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>Produits</Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>{products.length} produits</Text>
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

      {/* Search */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#D1D5DB',
          borderRadius: 10,
          paddingHorizontal: 12,
        }}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un produit..."
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 8,
              fontSize: 15,
              color: '#111827',
            }}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        {/* Grid/List Toggle */}
        <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', padding: 2, marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => setProductViewMode('list')}
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 8,
              backgroundColor: productViewMode === 'list' ? '#EFF6FF' : 'transparent',
              alignItems: 'center',
            }}
          >
            <List size={20} color={productViewMode === 'list' ? '#3B82F6' : '#9CA3AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setProductViewMode('grid')}
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 8,
              backgroundColor: productViewMode === 'grid' ? '#EFF6FF' : 'transparent',
              alignItems: 'center',
            }}
          >
            <LayoutGrid size={20} color={productViewMode === 'grid' ? '#3B82F6' : '#9CA3AF'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Products List or Grid */}
      {productViewMode === 'list' ? (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Package size={48} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', marginTop: 16, textAlign: 'center', fontSize: 15 }}>
                Aucun produit trouvé
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredProducts}
          numColumns={2}
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
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                padding: 10,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                minHeight: 160,
              }}
            >
              {/* Product Image */}
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{
                    width: '100%',
                    height: 80,
                    borderRadius: 8,
                    backgroundColor: '#F3F4F6',
                    marginBottom: 8,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{
                  width: '100%',
                  height: 80,
                  borderRadius: 8,
                  backgroundColor: '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <Package size={32} color="#D1D5DB" />
                </View>
              )}
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{item.categoryName}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#3B82F6' }}>{item.price} MAD</Text>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={{ padding: 4 }}
                >
                  <Trash2 size={14} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Package size={48} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', marginTop: 16, textAlign: 'center', fontSize: 15 }}>
                Aucun produit trouvé
              </Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'Modifier Produit' : 'Nouveau Produit'}
      >
        <View style={{ gap: 16, paddingBottom: 24 }}>
          {/* Image Picker */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 8 }}>Image du produit</Text>
            <TouchableOpacity
              onPress={showImageOptions}
              style={{
                width: '100%',
                height: 150,
                borderRadius: 12,
                backgroundColor: '#F3F4F6',
                borderWidth: 2,
                borderColor: '#E5E7EB',
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {formImageUri ? (
                <View style={{ width: '100%', height: '100%' }}>
                  <Image
                    source={{ uri: formImageUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setFormImageUri(null)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      borderRadius: 12,
                      padding: 4,
                    }}
                  >
                    <X size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Camera size={32} color="#9CA3AF" />
                  <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 8 }}>
                    Ajouter une image
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

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
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 8 }}>Catégorie</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setFormCategoryId(cat.id)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    backgroundColor: formCategoryId === cat.id ? '#3B82F6' : '#FFFFFF',
                    borderColor: formCategoryId === cat.id ? '#3B82F6' : '#D1D5DB',
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: formCategoryId === cat.id ? '#FFFFFF' : '#374151',
                  }}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => setShowModal(false)}
              disabled={saving || uploadingImage}
              style={{
                flex: 1,
                paddingVertical: 14,
                backgroundColor: '#F3F4F6',
                borderRadius: 10,
                opacity: saving || uploadingImage ? 0.5 : 1,
              }}
            >
              <Text style={{ textAlign: 'center', fontWeight: '600', color: '#374151', fontSize: 15 }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || uploadingImage}
              style={{
                flex: 1,
                paddingVertical: 14,
                backgroundColor: '#3B82F6',
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: saving || uploadingImage ? 0.7 : 1,
              }}
            >
              {(saving || uploadingImage) && (
                <ActivityIndicator size="small" color="#FFFFFF" />
              )}
              <Text style={{ textAlign: 'center', fontWeight: '600', color: '#FFFFFF', fontSize: 15 }}>
                {uploadingImage ? 'Upload...' : saving ? 'Enregistrement...' : editingProduct ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
