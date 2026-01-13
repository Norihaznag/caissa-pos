import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, User, Shield, ChefHat, Coffee, Users } from 'lucide-react-native';
import { Modal, Input } from '@/components/ui';
import { userService } from '../lib/services';

interface StaffUser {
  id: string;
  name: string;
  pin: string;
  role: 'admin' | 'waiter' | 'kitchen';
  isActive: boolean;
}

const ROLE_CONFIG = {
  admin: { label: 'Admin', color: '#8B5CF6', icon: Shield },
  waiter: { label: 'Serveur', color: '#3B82F6', icon: Coffee },
  kitchen: { label: 'Cuisine', color: '#F59E0B', icon: ChefHat },
};

export default function AdminUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState<StaffUser['role']>('waiter');

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const usersDb = await userService.getAll();
      const usersData = usersDb.map(u => ({
        id: u.id,
        name: u.name,
        pin: u.pin,
        role: u.role,
        isActive: u.is_active,
      }));
      setUsers(usersData);
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
    setEditingUser(null);
    setFormName('');
    setFormPin('');
    setFormRole('waiter');
    setShowModal(true);
  };

  const openEditModal = (user: StaffUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormPin(user.pin);
    setFormRole(user.role);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPin.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (formPin.length !== 4 || !/^\d{4}$/.test(formPin)) {
      Alert.alert('Erreur', 'Le code PIN doit contenir exactement 4 chiffres');
      return;
    }

    // Check for duplicate PIN
    const existingUser = users.find(
      u => u.pin === formPin && u.id !== editingUser?.id
    );
    if (existingUser) {
      Alert.alert('Erreur', 'Ce code PIN est déjà utilisé');
      return;
    }

    setSaving(true);
    
    try {
      if (editingUser) {
        // Update in Supabase
        await userService.update(editingUser.id, {
          name: formName.trim(),
          pin: formPin,
          role: formRole,
        });
        setUsers(prev => prev.map(u => u.id === editingUser.id ? {
          ...u,
          name: formName.trim(),
          pin: formPin,
          role: formRole,
        } : u));
      } else {
        // Create in Supabase
        const newUserDb = await userService.create({
          name: formName.trim(),
          pin: formPin,
          role: formRole,
          is_active: true,
        });
        const userData: StaffUser = {
          id: newUserDb.id,
          name: newUserDb.name,
          pin: newUserDb.pin,
          role: newUserDb.role,
          isActive: newUserDb.is_active,
        };
        setUsers(prev => [...prev, userData]);
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving user:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'utilisateur');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    try {
      await userService.update(user.id, { is_active: !user.isActive });
      setUsers(prev => 
        prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u)
      );
    } catch (error) {
      console.error('Error updating user:', error);
      Alert.alert('Erreur', 'Impossible de modifier le statut');
    }
  };

  const handleDelete = (user: StaffUser) => {
    Alert.alert(
      'Supprimer',
      `Voulez-vous supprimer "${user.name}"?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await userService.delete(user.id);
              setUsers(prev => prev.filter(u => u.id !== user.id));
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'utilisateur');
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: StaffUser }) => {
    const roleConfig = ROLE_CONFIG[item.role];
    const RoleIcon = roleConfig.icon;

    return (
      <View className={`bg-white border-b border-gray-200 px-4 py-4 ${!item.isActive ? 'opacity-50' : ''}`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View 
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: `${roleConfig.color}20` }}
            >
              <RoleIcon size={22} color={roleConfig.color} />
            </View>
            <View>
              <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
              <View className="flex-row items-center gap-2 mt-1">
                <View 
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${roleConfig.color}20` }}
                >
                  <Text 
                    className="text-xs font-medium"
                    style={{ color: roleConfig.color }}
                  >
                    {roleConfig.label}
                  </Text>
                </View>
                <Text className="text-xs text-gray-400">PIN: {item.pin}</Text>
              </View>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => handleToggleActive(item)}
              className={`px-3 py-2 rounded-lg ${item.isActive ? 'bg-green-100' : 'bg-gray-100'}`}
            >
              <Text className={`text-xs font-medium ${item.isActive ? 'text-green-700' : 'text-gray-500'}`}>
                {item.isActive ? 'Actif' : 'Inactif'}
              </Text>
            </TouchableOpacity>
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
  };

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
              <Text className="text-xl font-bold text-gray-900">Utilisateurs</Text>
              <Text className="text-sm text-gray-500">
                {users.filter(u => u.isActive).length} actifs
              </Text>
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

      {/* Users List */}
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Users size={48} color="#D1D5DB" />
            <Text className="text-gray-400 mt-4 text-center text-base">
              Aucun utilisateur
            </Text>
            <Text className="text-gray-400 mt-1 text-center text-sm">
              Appuyez sur Ajouter pour créer un utilisateur
            </Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
      >
        <View className="gap-4 pb-6">
          <Input
            label="Nom"
            value={formName}
            onChangeText={setFormName}
            placeholder="Ex: Mohammed"
          />
          
          <Input
            label="Code PIN (4 chiffres)"
            value={formPin}
            onChangeText={setFormPin}
            placeholder="Ex: 1234"
            keyboardType="numeric"
            maxLength={4}
          />

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Rôle</Text>
            <View className="flex-row gap-2">
              {(Object.keys(ROLE_CONFIG) as Array<keyof typeof ROLE_CONFIG>).map((role) => {
                const config = ROLE_CONFIG[role];
                const isSelected = formRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setFormRole(role)}
                    className={`flex-1 py-3 rounded-lg border items-center ${
                      isSelected ? 'border-blue-500' : 'border-gray-300'
                    }`}
                    style={isSelected ? { backgroundColor: `${config.color}15` } : {}}
                  >
                    <config.icon size={20} color={isSelected ? config.color : '#9CA3AF'} />
                    <Text 
                      className={`text-sm font-medium mt-1 ${
                        isSelected ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
                {editingUser ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
