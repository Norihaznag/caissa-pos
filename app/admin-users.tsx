import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, User, Shield, ChefHat, Coffee, Users, Store } from 'lucide-react-native';
import { Modal, Input } from '@/components/ui';
import { userService } from '../lib/services';

interface StaffUser {
  id: string;
  name: string;
  pin: string;
  role: 'admin' | 'waiter' | 'kitchen' | 'cashier';
  isActive: boolean;
}

const ROLE_CONFIG = {
  admin: { label: 'Admin', color: '#8B5CF6', icon: Shield },
  waiter: { label: 'Serveur', color: '#3B82F6', icon: Coffee },
  kitchen: { label: 'Cuisine', color: '#F59E0B', icon: ChefHat },
  cashier: { label: 'Caissier', color: '#10B981', icon: Store },
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
      const safeUsersDb = Array.isArray(usersDb) ? usersDb : [];
      const usersData = safeUsersDb.filter(u => u && u.id).map(u => ({
        id: u.id,
        name: u.name || '',
        pin: u.pin || '',
        role: u.role || 'waiter',
        isActive: u.is_active ?? true,
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
      <View style={{
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingVertical: 16,
        opacity: item.isActive ? 1 : 0.5,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View 
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${roleConfig.color}20`,
              }}
            >
              <RoleIcon size={22} color={roleConfig.color} />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{item.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <View 
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 12,
                    backgroundColor: `${roleConfig.color}20`,
                  }}
                >
                  <Text 
                    style={{
                      fontSize: 11,
                      fontWeight: '500',
                      color: roleConfig.color,
                    }}
                  >
                    {roleConfig.label}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>PIN: {item.pin}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleToggleActive(item)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: item.isActive ? '#DCFCE7' : '#F3F4F6',
              }}
            >
              <Text style={{
                fontSize: 11,
                fontWeight: '500',
                color: item.isActive ? '#166534' : '#6B7280',
              }}>
                {item.isActive ? 'Actif' : 'Inactif'}
              </Text>
            </TouchableOpacity>
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
  };

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
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }} numberOfLines={1}>Utilisateurs</Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>
                {users.filter(u => u.isActive).length} actifs
              </Text>
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

      {/* Users List */}
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Users size={48} color="#D1D5DB" />
            <Text style={{ color: '#9CA3AF', marginTop: 16, textAlign: 'center', fontSize: 15 }}>
              Aucun utilisateur
            </Text>
            <Text style={{ color: '#9CA3AF', marginTop: 4, textAlign: 'center', fontSize: 13 }}>
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
        <View style={{ gap: 16, paddingBottom: 24 }}>
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
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 8 }}>Rôle</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(Object.keys(ROLE_CONFIG) as Array<keyof typeof ROLE_CONFIG>).map((role) => {
                const config = ROLE_CONFIG[role];
                const isSelected = formRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setFormRole(role)}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      alignItems: 'center',
                      borderColor: isSelected ? '#3B82F6' : '#D1D5DB',
                      backgroundColor: isSelected ? `${config.color}15` : '#FFFFFF',
                    }}
                  >
                    <config.icon size={20} color={isSelected ? config.color : '#9CA3AF'} />
                    <Text 
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        marginTop: 4,
                        color: isSelected ? '#111827' : '#6B7280',
                      }}
                    >
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

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
                {editingUser ? 'Modifier' : 'Ajouter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
