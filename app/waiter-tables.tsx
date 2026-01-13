import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LogOut, RefreshCw, CreditCard, ShoppingBag, Check, Table2 } from "lucide-react-native";
import { useAppStore, Table as TableType, Order } from "../lib/store";
import { TableSkeleton } from "@/components/ui";
import * as Haptics from "expo-haptics";

export default function WaiterTablesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Get data from store
  const tables = useAppStore((state) => state.tables);
  const orders = useAppStore((state) => state.orders);
  const setTables = useAppStore((state) => state.setTables);
  const updateTable = useAppStore((state) => state.updateTable);
  const cancelOrderAndFreeTable = useAppStore((state) => state.cancelOrderAndFreeTable);
  const logout = useAppStore((state) => state.logout);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      // Initialize tables if empty
      if (tables.length === 0) {
        const initialTables: TableType[] = Array.from({ length: 12 }, (_, i) => ({
          id: (i + 1).toString(),
          number: i + 1,
          status: 'open' as const,
        }));
        setTables(initialTables);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Error loading tables:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTables();
  };

  // Get active order for a table
  const getTableOrder = (tableNumber: number): Order | undefined => {
    return orders.find(o => 
      o.tableNumber === tableNumber && 
      !['PAID', 'CANCELLED'].includes(o.status)
    );
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'NEW': return 'Nouvelle';
      case 'PREPARING': return 'En préparation';
      case 'READY': return 'Prête';
      default: return status;
    }
  };

  const freeTable = (table: TableType) => {
    updateTable(table.id, { 
      status: 'open', 
      currentOrderId: undefined, 
      activeOrderTotal: undefined 
    });
  };

  const confirmCancelOrder = (order: Order, table: TableType) => {
    Alert.alert(
      "Annuler la commande?",
      `Êtes-vous sûr de vouloir annuler la commande de la Table ${table.number}?\n\nTotal: ${order.totalAmount} MAD`,
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, Annuler",
          style: "destructive",
          onPress: () => {
            cancelOrderAndFreeTable(order.id, table.id);
            Alert.alert("Commande annulée", "La table est maintenant disponible.");
          },
        },
      ]
    );
  };

  const handleTablePress = (table: TableType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const activeOrder = getTableOrder(table.number);
    
    if (table.status === "occupied" && activeOrder) {
      Alert.alert(
        `Table ${table.number}`,
        `Commande: ${(activeOrder.items || []).length} articles\nTotal: ${activeOrder.totalAmount} MAD\nStatut: ${getStatusText(activeOrder.status)}`,
        [
          { text: "Fermer", style: "cancel" },
          {
            text: "Voir/Modifier",
            onPress: () => router.push(`/waiter-order?tableNumber=${table.number}&tableId=${table.id}&orderId=${activeOrder.id}`),
          },
          {
            text: "Paiement",
            onPress: () => router.push(`/waiter-payment?tableNumber=${table.number}&tableId=${table.id}&orderId=${activeOrder.id}`),
          },
          {
            text: "Annuler",
            style: "destructive",
            onPress: () => confirmCancelOrder(activeOrder, table),
          },
        ]
      );
    } else if (table.status === "occupied") {
      Alert.alert(
        `Table ${table.number}`,
        "Cette table est occupée sans commande active.",
        [
          { text: "Fermer", style: "cancel" },
          {
            text: "Nouvelle Commande",
            onPress: () => router.push(`/waiter-order?tableNumber=${table.number}&tableId=${table.id}`),
          },
          {
            text: "Libérer Table",
            onPress: () => freeTable(table),
          },
        ]
      );
    } else {
      router.push(`/waiter-order?tableNumber=${table.number}&tableId=${table.id}`);
    }
  };

  const handleLongPress = (table: TableType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const activeOrder = getTableOrder(table.number);
    
    if (table.status === 'open') {
      Alert.alert(
        `Table ${table.number}`,
        "Marquer cette table comme occupée?",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Marquer Occupée",
            onPress: () => updateTable(table.id, { status: 'occupied' }),
          },
        ]
      );
    } else if (activeOrder) {
      Alert.alert(
        "Attention",
        "Cette table a une commande active. Annulez d'abord la commande ou effectuez le paiement."
      );
    } else {
      Alert.alert(
        `Table ${table.number}`,
        "Libérer cette table?",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Libérer Table", onPress: () => freeTable(table) },
        ]
      );
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Déconnexion",
      "Voulez-vous vous déconnecter?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: () => {
            logout();
            router.replace("/");
          },
        },
      ]
    );
  };

  const renderTable = ({ item }: { item: TableType }) => {
    const isOccupied = item.status === "occupied";
    const activeOrder = getTableOrder(item.number);
    const orderTotal = activeOrder?.totalAmount || item.activeOrderTotal || 0;
    const orderStatus = activeOrder?.status;

    return (
      <TouchableOpacity
        onPress={() => handleTablePress(item)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}
        style={{
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
          paddingHorizontal: 16,
          paddingVertical: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 8,
                backgroundColor: isOccupied 
                  ? orderStatus === 'READY' ? '#DCFCE7' : '#DBEAFE' 
                  : '#F3F4F6',
                alignItems: "center",
                justifyContent: "center",
                borderWidth: orderStatus === 'READY' ? 2 : 0,
                borderColor: '#22C55E',
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                  color: isOccupied 
                    ? orderStatus === 'READY' ? '#16A34A' : '#3B82F6' 
                    : '#6B7280',
                }}
              >
                {item.number}
              </Text>
            </View>

            <View>
              <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>
                Table {item.number}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 14, color: "#6B7280" }}>
                  {isOccupied ? "Occupée" : "Disponible"}
                </Text>
                {isOccupied && orderTotal > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <ShoppingBag size={12} color="#3B82F6" />
                    <Text style={{ fontSize: 14, color: "#3B82F6", fontWeight: "600" }}>
                      {orderTotal} MAD
                    </Text>
                  </View>
                )}
              </View>
              {orderStatus === 'READY' && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Check size={14} color="#22C55E" />
                  <Text style={{ fontSize: 13, color: "#22C55E", fontWeight: "600" }}>
                    Commande prête!
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isOccupied && activeOrder && (
              <TouchableOpacity
                onPress={() => router.push(`/waiter-payment?tableNumber=${item.number}&tableId=${item.id}&orderId=${activeOrder.id}`)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: "#DCFCE7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CreditCard color="#16A34A" size={20} />
              </TouchableOpacity>
            )}
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: isOccupied 
                  ? orderStatus === 'READY' ? '#22C55E' : '#3B82F6' 
                  : '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: isOccupied ? "#FFFFFF" : "#6B7280",
                }}
              >
                {orderStatus === 'READY' ? 'PRÊTE' : isOccupied ? 'OCCUPÉE' : 'LIBRE'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* Skeleton Header */}
        <View style={{ backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <View style={{ width: 80, height: 22, backgroundColor: "#E5E7EB", borderRadius: 4 }} />
              <View style={{ width: 120, height: 14, backgroundColor: "#F3F4F6", borderRadius: 4, marginTop: 6 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ width: 40, height: 40, backgroundColor: "#F3F4F6", borderRadius: 8 }} />
              <View style={{ width: 40, height: 40, backgroundColor: "#FEE2E2", borderRadius: 8 }} />
            </View>
          </View>
        </View>
        {/* Skeleton Tables */}
        <View>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <TableSkeleton key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const occupiedCount = tables.filter((t) => t.status === "occupied").length;
  const openCount = tables.filter((t) => t.status === "open").length;
  const readyOrdersCount = orders.filter(o => o.status === 'READY').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ fontSize: 22, fontWeight: "700", color: "#111827" }}>
              Tables
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
              <Text style={{ fontSize: 14, color: "#6B7280" }}>
                {occupiedCount} occupées • {openCount} libres
              </Text>
              {readyOrdersCount > 0 && (
                <View style={{ 
                  backgroundColor: "#22C55E", 
                  paddingHorizontal: 8, 
                  paddingVertical: 2, 
                  borderRadius: 10 
                }}>
                  <Text style={{ fontSize: 12, color: "#FFFFFF", fontWeight: "600" }}>
                    {readyOrdersCount} prête{readyOrdersCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={onRefresh}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: "#F3F4F6",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RefreshCw color="#6B7280" size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: "#FEE2E2",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogOut color="#EF4444" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Info Banner */}
      <View style={{ 
        backgroundColor: "#EFF6FF", 
        paddingHorizontal: 16, 
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#DBEAFE",
      }}>
        <Text style={{ fontSize: 13, color: "#1E40AF" }}>
          💡 Appuyez longuement sur une table pour changer son statut manuellement
        </Text>
      </View>

      {/* Tables List */}
      <FlatList
        data={tables}
        renderItem={renderTable}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
        contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Table2 size={64} color="#D1D5DB" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 }}>
              Aucune table
            </Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
              Tirez vers le bas pour actualiser
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

