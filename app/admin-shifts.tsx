import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  User, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Copy,
  Trash2,
} from 'lucide-react-native';
import { shiftService, Shift, ShiftTemplate } from '../lib/shift-service';
import { userService } from '../lib/services';

interface WaiterUser {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Prévu', color: '#3B82F6', bg: '#EFF6FF' },
  active: { label: 'En cours', color: '#22C55E', bg: '#F0FDF4' },
  completed: { label: 'Terminé', color: '#6B7280', bg: '#F3F4F6' },
  absent: { label: 'Absent', color: '#EF4444', bg: '#FEF2F2' },
  cancelled: { label: 'Annulé', color: '#F59E0B', bg: '#FFFBEB' },
};

export default function AdminShiftsScreen() {
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [users, setUsers] = useState<WaiterUser[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'week' | 'templates'>('week');
  
  // Modal states
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  
  // Form states
  const [formUserId, setFormUserId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('16:00');
  const [formStatus, setFormStatus] = useState<Shift['status']>('scheduled');
  const [formNotes, setFormNotes] = useState('');

  const getWeekDates = useCallback(() => {
    const start = new Date(selectedWeek);
    start.setDate(start.getDate() - start.getDay()); // Start from Sunday
    
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [selectedWeek]);

  const loadData = useCallback(async () => {
    try {
      const weekDates = getWeekDates();
      const startDate = weekDates[0].toISOString().split('T')[0];
      const endDate = weekDates[6].toISOString().split('T')[0];

      const [shiftsData, templatesData, usersData] = await Promise.all([
        shiftService.getShifts(startDate, endDate),
        shiftService.getTemplates(),
        userService.getAll()
      ]);

      setShifts(shiftsData);
      setTemplates(templatesData);
      // Only show waiters in shift management
      setUsers((usersData || []).filter(u => u.role === 'waiter' && u.is_active));
    } catch (error) {
      console.error('Error loading shifts:', error);
    } finally {
      setLoading(false);
    }
  }, [getWeekDates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const navigateWeek = (direction: number) => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedWeek(newDate);
  };

  const getShiftForUserAndDate = (userId: string, date: Date): Shift | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.find(s => s.userId === userId && s.shiftDate === dateStr);
  };

  const openShiftModal = (userId: string, date: Date, existingShift?: Shift) => {
    setFormUserId(userId);
    setFormDate(date.toISOString().split('T')[0]);
    
    if (existingShift) {
      setEditingShift(existingShift);
      setFormStartTime(existingShift.startTime);
      setFormEndTime(existingShift.endTime);
      setFormStatus(existingShift.status);
      setFormNotes(existingShift.notes || '');
    } else {
      setEditingShift(null);
      setFormStartTime('08:00');
      setFormEndTime('16:00');
      setFormStatus('scheduled');
      setFormNotes('');
    }
    
    setShowShiftModal(true);
  };

  const openTemplateModal = (userId: string, dayOfWeek: number, existingTemplate?: ShiftTemplate) => {
    setFormUserId(userId);
    setFormDayOfWeek(dayOfWeek);
    
    if (existingTemplate) {
      setEditingTemplate(existingTemplate);
      setFormStartTime(existingTemplate.startTime);
      setFormEndTime(existingTemplate.endTime);
    } else {
      setEditingTemplate(null);
      setFormStartTime('08:00');
      setFormEndTime('16:00');
    }
    
    setShowTemplateModal(true);
  };

  const handleSaveShift = async () => {
    if (!formUserId || !formDate) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const success = await shiftService.saveShift({
      userId: formUserId,
      shiftDate: formDate,
      startTime: formStartTime,
      endTime: formEndTime,
      status: formStatus,
      notes: formNotes
    });

    if (success) {
      setShowShiftModal(false);
      loadData();
    } else {
      Alert.alert('Erreur', 'Impossible de sauvegarder le service');
    }
  };

  const handleDeleteShift = async () => {
    if (!editingShift) return;

    Alert.alert(
      'Supprimer le service',
      'Êtes-vous sûr de vouloir supprimer ce service ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const success = await shiftService.deleteShift(editingShift.id);
            if (success) {
              setShowShiftModal(false);
              loadData();
            }
          }
        }
      ]
    );
  };

  const handleSaveTemplate = async () => {
    if (!formUserId) {
      Alert.alert('Erreur', 'Veuillez sélectionner un utilisateur');
      return;
    }

    const success = await shiftService.saveTemplate({
      userId: formUserId,
      dayOfWeek: formDayOfWeek,
      startTime: formStartTime,
      endTime: formEndTime,
      isActive: true
    });

    if (success) {
      setShowTemplateModal(false);
      loadData();
    } else {
      Alert.alert('Erreur', 'Impossible de sauvegarder le modèle');
    }
  };

  const handleGenerateWeek = async () => {
    Alert.alert(
      'Générer les services',
      'Voulez-vous générer les services de la semaine à partir des modèles ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Générer',
          onPress: async () => {
            const weekDates = getWeekDates();
            const count = await shiftService.generateWeekShifts(weekDates[0]);
            Alert.alert('Succès', `${count} services générés`);
            loadData();
          }
        }
      ]
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates();
    const today = new Date().toISOString().split('T')[0];

    return (
      <View style={{ flex: 1 }}>
        {/* Week navigation */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#F3F4F6',
          borderRadius: 10,
          marginHorizontal: 16,
          marginBottom: 12
        }}>
          <TouchableOpacity onPress={() => navigateWeek(-1)} style={{ padding: 8 }}>
            <ChevronLeft size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
            {weekDates[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - {weekDates[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => navigateWeek(1)} style={{ padding: 8 }}>
            <ChevronRight size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Generate button */}
        <TouchableOpacity
          onPress={handleGenerateWeek}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#3B82F6',
            marginHorizontal: 16,
            marginBottom: 12,
            paddingVertical: 10,
            borderRadius: 8,
            gap: 8
          }}
        >
          <Copy size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Générer depuis modèles</Text>
        </TouchableOpacity>

        {/* Day headers */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 }}>
          <View style={{ width: 80 }} />
          {weekDates.map((date, index) => {
            const isToday = date.toISOString().split('T')[0] === today;
            return (
              <View 
                key={index} 
                style={{ 
                  flex: 1, 
                  alignItems: 'center',
                  backgroundColor: isToday ? '#3B82F6' : 'transparent',
                  borderRadius: 8,
                  paddingVertical: 4
                }}
              >
                <Text style={{ 
                  fontSize: 12, 
                  fontWeight: '600', 
                  color: isToday ? '#FFFFFF' : '#6B7280' 
                }}>
                  {DAY_NAMES[index]}
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: isToday ? '700' : '500', 
                  color: isToday ? '#FFFFFF' : '#111827' 
                }}>
                  {date.getDate()}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Users and their shifts */}
        <ScrollView style={{ flex: 1 }}>
          {users.map(user => (
            <View 
              key={user.id} 
              style={{ 
                flexDirection: 'row', 
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: '#E5E7EB'
              }}
            >
              {/* User name */}
              <View style={{ width: 80, justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }} numberOfLines={1}>
                  {user.name}
                </Text>
              </View>

              {/* Shifts for each day */}
              {weekDates.map((date, index) => {
                const shift = getShiftForUserAndDate(user.id, date);
                const statusConfig = shift ? STATUS_CONFIG[shift.status] : null;

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => openShiftModal(user.id, date, shift)}
                    style={{
                      flex: 1,
                      marginHorizontal: 2,
                      minHeight: 50,
                      backgroundColor: statusConfig?.bg || '#F9FAFB',
                      borderRadius: 6,
                      padding: 4,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: statusConfig?.color || '#E5E7EB',
                      borderStyle: shift ? 'solid' : 'dashed'
                    }}
                  >
                    {shift ? (
                      <>
                        <Text style={{ fontSize: 10, color: statusConfig?.color, fontWeight: '600' }}>
                          {shift.startTime}
                        </Text>
                        <Text style={{ fontSize: 10, color: statusConfig?.color }}>
                          {shift.endTime}
                        </Text>
                      </>
                    ) : (
                      <Plus size={16} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {users.length === 0 && (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <User size={48} color="#9CA3AF" />
              <Text style={{ marginTop: 12, color: '#6B7280', textAlign: 'center' }}>
                Aucun serveur actif.{'\n'}Ajoutez des serveurs dans Utilisateurs.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderTemplatesView = () => {
    return (
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {users.map(user => {
          const userTemplates = templates.filter(t => t.userId === user.id);
          
          return (
            <View 
              key={user.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
                {user.name}
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => {
                  const template = userTemplates.find(t => t.dayOfWeek === dayOfWeek);
                  
                  return (
                    <TouchableOpacity
                      key={dayOfWeek}
                      onPress={() => openTemplateModal(user.id, dayOfWeek, template)}
                      style={{
                        width: '13%',
                        minWidth: 44,
                        backgroundColor: template ? '#EFF6FF' : '#F9FAFB',
                        borderRadius: 8,
                        padding: 8,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: template ? '#3B82F6' : '#E5E7EB',
                        borderStyle: template ? 'solid' : 'dashed'
                      }}
                    >
                      <Text style={{ 
                        fontSize: 11, 
                        fontWeight: '600', 
                        color: template ? '#3B82F6' : '#9CA3AF' 
                      }}>
                        {DAY_NAMES[dayOfWeek]}
                      </Text>
                      {template && (
                        <>
                          <Text style={{ fontSize: 9, color: '#3B82F6', marginTop: 2 }}>
                            {template.startTime}
                          </Text>
                          <Text style={{ fontSize: 9, color: '#3B82F6' }}>
                            {template.endTime}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        {users.length === 0 && (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Calendar size={48} color="#9CA3AF" />
            <Text style={{ marginTop: 12, color: '#6B7280', textAlign: 'center' }}>
              Aucun serveur actif.{'\n'}Ajoutez des serveurs dans Utilisateurs.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
              Gestion des Services
            </Text>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>
              Planning des serveurs
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ 
        flexDirection: 'row', 
        padding: 16, 
        gap: 12 
      }}>
        <TouchableOpacity
          onPress={() => setActiveTab('week')}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: activeTab === 'week' ? '#3B82F6' : '#FFFFFF',
            borderRadius: 10,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: activeTab === 'week' ? '#3B82F6' : '#E5E7EB'
          }}
        >
          <Calendar size={20} color={activeTab === 'week' ? '#FFFFFF' : '#6B7280'} />
          <Text style={{ 
            marginTop: 4,
            fontSize: 13, 
            fontWeight: '600', 
            color: activeTab === 'week' ? '#FFFFFF' : '#374151' 
          }}>
            Semaine
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('templates')}
          style={{
            flex: 1,
            paddingVertical: 12,
            backgroundColor: activeTab === 'templates' ? '#3B82F6' : '#FFFFFF',
            borderRadius: 10,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: activeTab === 'templates' ? '#3B82F6' : '#E5E7EB'
          }}
        >
          <Copy size={20} color={activeTab === 'templates' ? '#FFFFFF' : '#6B7280'} />
          <Text style={{ 
            marginTop: 4,
            fontSize: 13, 
            fontWeight: '600', 
            color: activeTab === 'templates' ? '#FFFFFF' : '#374151' 
          }}>
            Modèles
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'week' ? renderWeekView() : renderTemplatesView()}

      {/* Shift Modal */}
      <Modal visible={showShiftModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                {editingShift ? 'Modifier le service' : 'Ajouter un service'}
              </Text>
              <TouchableOpacity onPress={() => setShowShiftModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Date display */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                Date
              </Text>
              <View style={{ 
                backgroundColor: '#F3F4F6', 
                padding: 12, 
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8
              }}>
                <Calendar size={18} color="#6B7280" />
                <Text style={{ color: '#111827' }}>
                  {formDate ? new Date(formDate).toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  }) : ''}
                </Text>
              </View>
            </View>

            {/* Time inputs */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                  Début
                </Text>
                <TextInput
                  value={formStartTime}
                  onChangeText={setFormStartTime}
                  placeholder="08:00"
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                  Fin
                </Text>
                <TextInput
                  value={formEndTime}
                  onChangeText={setFormEndTime}
                  placeholder="16:00"
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16
                  }}
                />
              </View>
            </View>

            {/* Status */}
            {editingShift && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  Statut
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setFormStatus(status as Shift['status'])}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: formStatus === status ? config.color : config.bg,
                        borderWidth: 1,
                        borderColor: config.color
                      }}
                    >
                      <Text style={{ 
                        fontSize: 13, 
                        fontWeight: '600',
                        color: formStatus === status ? '#FFFFFF' : config.color 
                      }}>
                        {config.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                Notes (optionnel)
              </Text>
              <TextInput
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Remarques..."
                multiline
                numberOfLines={2}
                style={{
                  backgroundColor: '#F9FAFB',
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  minHeight: 60,
                  textAlignVertical: 'top'
                }}
              />
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {editingShift && (
                <TouchableOpacity
                  onPress={handleDeleteShift}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    backgroundColor: '#FEF2F2',
                    borderRadius: 10,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  <Trash2 size={18} color="#EF4444" />
                  <Text style={{ color: '#EF4444', fontWeight: '600' }}>Supprimer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleSaveShift}
                style={{
                  flex: editingShift ? 1 : undefined,
                  width: editingShift ? undefined : '100%',
                  paddingVertical: 14,
                  backgroundColor: '#22C55E',
                  borderRadius: 10,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <Check size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Template Modal */}
      <Modal visible={showTemplateModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>
                Modèle - {DAY_NAMES_FULL[formDayOfWeek]}
              </Text>
              <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Time inputs */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                  Début
                </Text>
                <TextInput
                  value={formStartTime}
                  onChangeText={setFormStartTime}
                  placeholder="08:00"
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                  Fin
                </Text>
                <TextInput
                  value={formEndTime}
                  onChangeText={setFormEndTime}
                  placeholder="16:00"
                  style={{
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 16
                  }}
                />
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              onPress={handleSaveTemplate}
              style={{
                paddingVertical: 14,
                backgroundColor: '#3B82F6',
                borderRadius: 10,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Check size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Enregistrer le modèle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
