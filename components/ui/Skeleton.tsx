import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4,
  style 
}: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  );
}

// Table skeleton for waiter-tables screen
export function TableSkeleton() {
  return (
    <View style={styles.tableCard}>
      <View style={styles.tableRow}>
        <Skeleton width={52} height={52} borderRadius={8} />
        <View style={styles.tableInfo}>
          <Skeleton width={80} height={18} />
          <Skeleton width={120} height={14} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={80} height={32} borderRadius={16} />
      </View>
    </View>
  );
}

// Order skeleton for kitchen-orders screen
export function OrderSkeleton() {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Skeleton width={100} height={24} />
        <Skeleton width={60} height={20} borderRadius={10} />
      </View>
      <View style={{ marginTop: 12 }}>
        <Skeleton width="100%" height={16} />
        <Skeleton width="80%" height={16} style={{ marginTop: 8 }} />
        <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.orderFooter}>
        <Skeleton width={80} height={20} />
        <Skeleton width={120} height={40} borderRadius={8} />
      </View>
    </View>
  );
}

// Product skeleton for admin-products screen
export function ProductSkeleton() {
  return (
    <View style={styles.productCard}>
      <View style={styles.productRow}>
        <View style={{ flex: 1 }}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={70} height={28} borderRadius={14} />
        <Skeleton width={40} height={40} borderRadius={8} style={{ marginLeft: 12 }} />
        <Skeleton width={40} height={40} borderRadius={8} style={{ marginLeft: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tableInfo: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
