import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { LogOut, RefreshCw, CreditCard, ShoppingBag, Check, Table2, Bell, Clock, LayoutGrid, List } from "lucide-react-native";
import { useAppStore, Table as TableType, Order } from "../lib/store";
import { tableService, orderService, orderItemService } from "../lib/services";
import { TableSkeleton } from "@/components/ui";
import * as Haptics from "expo-haptics";
import { useOrderReadyNotification } from "../lib/sounds";

type TableViewMode = 'list' | 'grid';

export default function WaiterTablesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableViewMode, setTableViewMode] = useState<TableViewMode>('list');
  const isLoadingRef = useRef(false);
  
  // Enable notifications for ready orders
  useOrderReadyNotification();
  
  // Get data from store
  const tables = useAppStore((state) => state.tables);
  const orders = useAppStore((state) => state.orders);
  const setTables = useAppStore((state) => state.setTables);
  const setOrders = useAppStore((state) => state.setOrders);
  const updateTable = useAppStore((state) => state.updateTable);
  const cancelOrderAndFreeTable = useAppStore((state) => state.cancelOrderAndFreeTable);
  const logout = useAppStore((state) => state.logout);

  const loadTables = useCallback(async () => {
    // Prevent overlapping requests
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      // Fetch tables from Supabase
      const tablesDb = await tableService.getAll();
      const ordersDb = await orderService.getPending();
      
      // Create a set of valid pending order IDs for quick lookup
      const pendingOrderIds = new Set(ordersDb.map(o => o.id));
      
      // Transform tables - validate that current_order_id points to a pending order
      const tablesData: TableType[] = await Promise.all(
        tablesDb.map(async (t) => {
          let activeOrderTotal = 0;
          let validOrderId = t.current_order_id;
          let tableStatus = t.status;
          
          if (t.current_order_id) {
            // Check if this order is still pending
            if (pendingOrderIds.has(t.current_order_id)) {
              const order = await orderService.getById(t.current_order_id);
              if (order && ['NEW', 'PREPARING', 'READY'].includes(order.status)) {
                activeOrderTotal = order.total_amount;
              } else {
                // Order was paid/cancelled - clean up table
                validOrderId = undefined;
                tableStatus = 'open';
                // Also update in DB to fix the inconsistency
                await tableService.setOpen(t.id).catch(console.error);
              }
            } else {
              // Order doesn't exist in pending orders - table should be free
              validOrderId = undefined;
              tableStatus = 'open';
              // Fix inconsistency in DB
              await tableService.setOpen(t.id).catch(console.error);
            }
          }
          
          return {
            id: t.id,
            number: t.number,
            status: tableStatus,
            currentOrderId: validOrderId || undefined,
            activeOrderTotal: activeOrderTotal || undefined,
          };
        })
      );
      
      // Transform orders - filter out orphan orders with no items
      const ordersDataRaw: Order[] = await Promise.all(
        ordersDb.map(async (o) => {
          const itemsDb = await orderItemService.getByOrderId(o.id);
          const table = tablesDb.find(t => t.id === o.table_id);
          
          return {
            id: o.id,
            tableId: o.table_id,
            tableNumber: table?.number || 0,
            items: Array.isArray(itemsDb) ? itemsDb.filter(i => i).map(i => ({
              id: i.id || '',
              productId: i.product_id || '',
              productName: i.product_name || 'Produit',
              price: i.price || 0,
              quantity: i.quantity || 0,
            })) : [],
            status: o.status || 'NEW',
            isServed: o.is_served || false,
            totalAmount: o.total_amount || 0,
            createdAt: o.created_at ? new Date(o.created_at) : new Date(),
            updatedAt: o.updated_at ? new Date(o.updated_at) : new Date(),
            waiterId: o.waiter_id || undefined,
          };
        })
      );
      
      // Filter out orders with no items (orphaned orders) and cancel them
      const ordersData: Order[] = [];
      for (const order of ordersDataRaw) {
        if (!order.items || order.items.length === 0) {
          // This is an orphan order - cancel it and free the table
          console.warn(`Orphan order detected: ${order.id} has no items, cleaning up...`);
          try {
            await orderService.cancelOrder(order.id, 'Commande orpheline sans articles');
            // Free the associated table
            const linkedTable = tablesData.find(t => t.currentOrderId === order.id);
            if (linkedTable) {
              await tableService.setOpen(linkedTable.id);
              // Update local table data
              const tableIndex = tablesData.findIndex(t => t.id === linkedTable.id);
              if (tableIndex >= 0) {
                tablesData[tableIndex] = { ...tablesData[tableIndex], status: 'open', currentOrderId: undefined };
              }
            }
          } catch (e) {
            console.error('Failed to clean orphan order:', e);
          }
        } else {
          ordersData.push(order);
        }
      }
      
      setTables(tablesData);
      setOrders(ordersData);
    } catch (error) {
      console.error("Error loading tables:", error);
      Alert.alert("Erreur", "Impossible de charger les tables");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [setTables, setOrders]);

  useEffect(() => {
    loadTables();
    
    // Auto-refresh every 5 seconds to get kitchen status updates
    const interval = setInterval(() => {
      loadTables();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadTables]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTables();
  };

  // Get active order for a table - match by table ID for accuracy
  const getTableOrder = (tableNumber: number, tableId?: string): Order | undefined => {
    if (!orders || !Array.isArray(orders)) return undefined;
    
    // Find order by tableId first (more accurate), fallback to tableNumber
    return orders.find(o => {
      if (!o || !o.status || ['PAID', 'CANCELLED'].includes(o.status)) return false;
      
      // If we have tableId, use it for precise matching
      if (tableId && o.tableId) {
        return o.tableId === tableId;
      }
      // Fallback to tableNumber matching
      return o.tableNumber === tableNumber;
    });
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'NEW': return 'Nouvelle';
      case 'PREPARING': return 'En préparation';
      case 'READY': return 'Prête';
      default: return status;
    }
  };

  const freeTable = async (table: TableType) => {
    try {
      // Update in database first
      await tableService.setOpen(table.id);
      // Then update local store
      updateTable(table.id, { 
        status: 'open', 
        currentOrderId: undefined, 
        activeOrderTotal: undefined 
      });
    } catch (error) {
      console.error('Error freeing table:', error);
      Alert.alert('Erreur', 'Impossible de libérer la table');
    }
  };

  const confirmCancelOrder = (order: Order, table: TableType) => {
    // Redirect to order screen for proper cancellation flow with reason
    router.push(`/waiter-order?tableNumber=${table.number}&tableId=${table.id}&orderId=${order.id}&showCancel=true`);
  };

  // Transfer order to another table
  const transferToTable = async (fromTable: TableType, order: Order) => {
    // Get available (open) tables
    const availableTables = tables.filter(t => t.status === 'open' && t.id !== fromTable.id);
    
    if (availableTables.length === 0) {
      Alert.alert('Impossible', 'Aucune table libre disponible pour le transfert.');
      return;
    }

    // Show table selection
    const tableButtons = availableTables.slice(0, 5).map(t => ({
      text: `Table ${t.number}`,
      onPress: async () => {
        try {
          // Update order with new table
          await orderService.update(order.id, { table_id: t.id });
          // Free old table
          await tableService.setOpen(fromTable.id);
          // Occupy new table
          await tableService.setOccupied(t.id, order.id);
          
          // Update local store
          updateTable(fromTable.id, { status: 'open', currentOrderId: undefined, activeOrderTotal: undefined });
          updateTable(t.id, { status: 'occupied', currentOrderId: order.id, activeOrderTotal: order.totalAmount });
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Succès', `Commande transférée à la Table ${t.number}`);
          loadTables();
        } catch (error) {
          console.error('Error transferring order:', error);
          Alert.alert('Erreur', 'Impossible de transférer la commande');
        }
      }
    }));

    Alert.alert(
      'Transférer vers',
      `Choisissez la table de destination pour la commande de la Table ${fromTable.number}`,
      [{ text: 'Annuler', style: 'cancel' }, ...tableButtons]
    );
  };

  const handleTablePress = (table: TableType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const activeOrder = getTableOrder(table.number, table.id);
    
    if (table.status === "occupied" && activeOrder) {
      const itemsCount = Array.isArray(activeOrder.items) ? activeOrder.items.length : 0;
      const orderTotal = activeOrder.totalAmount || 0;
      // Show order options - Android supports max 3 buttons, so split into submenu
      Alert.alert(
        `Table ${table.number}`,
        `Commande: ${itemsCount} articles\nTotal: ${orderTotal} MAD\nStatut: ${getStatusText(activeOrder.status || 'NEW')}`,
        [
          { text: "Fermer", style: "cancel" },
          {
            text: "Voir/Modifier",
            onPress: () => router.push(`/waiter-order?tableNumber=${table.number}&tableId=${table.id}&orderId=${activeOrder.id}`),
          },
          {
            text: "Actions",
            onPress: () => {
              // Second alert for payment/cancel/transfer actions
              Alert.alert(
                `Actions - Table ${table.number}`,
                "Que voulez-vous faire?",
                [
                  { text: "Retour", style: "cancel" },
                  {
                    text: "Transférer",
                    onPress: () => transferToTable(table, activeOrder),
                  },
                  {
                    text: "Paiement",
                    onPress: () => router.push(`/waiter-payment?tableNumber=${table.number}&tableId=${table.id}&orderId=${activeOrder.id}`),
                  },
                ]
              );
            },
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
    const activeOrder = getTableOrder(table.number, table.id);
    
    if (table.status === 'open') {
      Alert.alert(
        `Table ${table.number}`,
        "Marquer cette table comme occupée?",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Marquer Occupée",
            onPress: async () => {
              try {
                await tableService.update(table.id, { status: 'occupied' });
                updateTable(table.id, { status: 'occupied' });
              } catch (error) {
                console.error('Error updating table:', error);
                Alert.alert('Erreur', 'Impossible de mettre à jour la table');
              }
            },
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
    const activeOrder = getTableOrder(item.number, item.id);
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
                    🍽️ Commande prête à servir!
                  </Text>
                </View>
              )}
              {orderStatus === 'PREPARING' && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Clock size={14} color="#F59E0B" />
                  <Text style={{ fontSize: 13, color: "#F59E0B", fontWeight: "600" }}>
                    🍳 En préparation...
                  </Text>
                </View>
              )}
              {orderStatus === 'NEW' && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Bell size={14} color="#EF4444" />
                  <Text style={{ fontSize: 13, color: "#EF4444", fontWeight: "600" }}>
                    📋 Nouvelle commande
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

  const occupiedCount = Array.isArray(tables) ? tables.filter((t) => t && t.status === "occupied").length : 0;
  const openCount = Array.isArray(tables) ? tables.filter((t) => t && t.status === "open").length : 0;
  const readyOrdersCount = Array.isArray(orders) ? orders.filter(o => o && o.status === 'READY').length : 0;

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
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }} numberOfLines={1}>
              Tables
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              <Text style={{ fontSize: 13, color: "#6B7280" }}>
                {occupiedCount} occupées • {openCount} libres
              </Text>
              {readyOrdersCount > 0 && (
                <View style={{ 
                  backgroundColor: "#22C55E", 
                  paddingHorizontal: 8, 
                  paddingVertical: 2, 
                  borderRadius: 10 
                }}>
                  <Text style={{ fontSize: 11, color: "#FFFFFF", fontWeight: "600" }}>
                    {readyOrdersCount} prête{readyOrdersCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Grid/List Toggle */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 2 }}>
              <TouchableOpacity
                onPress={() => setTableViewMode('list')}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  backgroundColor: tableViewMode === 'list' ? '#FFFFFF' : 'transparent',
                }}
              >
                <List size={18} color={tableViewMode === 'list' ? '#3B82F6' : '#9CA3AF'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTableViewMode('grid')}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  backgroundColor: tableViewMode === 'grid' ? '#FFFFFF' : 'transparent',
                }}
              >
                <LayoutGrid size={18} color={tableViewMode === 'grid' ? '#3B82F6' : '#9CA3AF'} />
              </TouchableOpacity>
            </View>

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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 13, color: "#1E40AF", flex: 1 }}>
          💡 Appuyez longuement pour changer le statut
        </Text>
      </View>

      {/* Tables - List or Grid */}
      {tableViewMode === 'list' ? (
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
      ) : (
        <FlatList
          data={tables}
          numColumns={3}
          key="grid"
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3B82F6"]}
              tintColor="#3B82F6"
            />
          }
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const isOccupied = item.status === "occupied";
            const activeOrder = getTableOrder(item.number, item.id);
            const orderStatus = activeOrder?.status;
            const orderTotal = activeOrder?.totalAmount || item.activeOrderTotal || 0;

            return (
              <TouchableOpacity
                onPress={() => handleTablePress(item)}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={500}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  backgroundColor: isOccupied 
                    ? orderStatus === 'READY' ? '#DCFCE7' : '#DBEAFE' 
                    : '#FFFFFF',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: orderStatus === 'READY' ? 2 : 1,
                  borderColor: orderStatus === 'READY' ? '#22C55E' : '#E5E7EB',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: isOccupied 
                    ? orderStatus === 'READY' ? '#16A34A' : '#3B82F6' 
                    : '#6B7280',
                }}>
                  {item.number}
                </Text>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: isOccupied 
                    ? orderStatus === 'READY' ? '#16A34A' : '#3B82F6' 
                    : '#9CA3AF',
                  marginTop: 4,
                }}>
                  {orderStatus === 'READY' ? 'PRÊTE' : isOccupied ? 'OCCUPÉE' : 'LIBRE'}
                </Text>
                {isOccupied && orderTotal > 0 && (
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#111827',
                    marginTop: 4,
                  }}>
                    {orderTotal} MAD
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
              <Table2 size={64} color="#D1D5DB" />
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 }}>
                Aucune table
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

