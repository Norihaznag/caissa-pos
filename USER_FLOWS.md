# POS System - User Flow Diagrams

## 1. Complete Order Flow (Happy Path)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WAITER SELECTS TABLE                            │
│  Screen: waiter-tables.tsx                                         │
│  Action: Tap on "OPEN" table                                       │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  CREATE ORDER & ADD ITEMS                          │
│  Screen: waiter-order.tsx                                          │
│  - Browse categories or search products                            │
│  - Add items to cart (with quantities)                             │
│  - Add notes to items (e.g., "Sans sucre")                         │
│  - View cart total                                                 │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼ Click "Envoyer à la Cuisine"
┌─────────────────────────────────────────────────────────────────────┐
│              STORE ACTION: createOrderAndOccupyTable()             │
│  1. Create order with status=NEW                                   │
│  2. Set table.status = "occupied"                                  │
│  3. Set table.activeOrderTotal = order.total                       │
│  4. Navigate back to tables screen                                 │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  KITCHEN SEES NEW ORDER                            │
│  Screen: kitchen-orders.tsx                                        │
│  - Order appears in NEW section (red badge)                        │
│  - Shows table number, items, total, notes                         │
│  - Time elapsed since order creation                               │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼ Click "Commencer"
┌─────────────────────────────────────────────────────────────────────┐
│              STORE ACTION: updateOrderStatus(PREPARING)            │
│  - Order status: NEW → PREPARING                                   │
│  - Order badge color: Red → Orange                                 │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼ Kitchen prepares food
┌─────────────────────────────────────────────────────────────────────┐
│                  KITCHEN MARKS ORDER READY                         │
│  Screen: kitchen-orders.tsx                                        │
│  Action: Click "Marquer Prête"                                     │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│              STORE ACTION: updateOrderStatus(READY)                │
│  - Order status: PREPARING → READY                                 │
│  - Order badge color: Orange → Green                               │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│               WAITER SEES READY INDICATOR                          │
│  Screen: waiter-tables.tsx                                         │
│  - Table card shows green border                                   │
│  - Green CHECK icon displayed                                      │
│  - Green "PRÊTE" badge                                             │
│  - Header shows "X prête(s)" count                                 │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼ Click payment button (💳) or tap table
┌─────────────────────────────────────────────────────────────────────┐
│                   PROCESS PAYMENT                                  │
│  Screen: waiter-payment.tsx                                        │
│  - Shows order items and total                                     │
│  - Select payment method (Cash/Card)                               │
│  - Apply discount (optional)                                       │
│  - Enter amount received (for cash)                                │
│  - Calculate change                                                │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼ Click "Confirmer le Paiement"
┌─────────────────────────────────────────────────────────────────────┐
│          STORE ACTION: completePaymentAndFreeTable()               │
│  1. Update order:                                                  │
│     - status = PAID                                                │
│     - paymentMethod = "cash" | "card"                              │
│     - paidAt = new Date()                                          │
│     - discount, discountType                                       │
│     - waiterName                                                   │
│  2. Free table:                                                    │
│     - table.status = "open"                                        │
│     - table.activeOrderTotal = undefined                           │
│  3. Navigate to receipt screen                                     │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   SHOW RECEIPT                                     │
│  Screen: receipt.tsx                                               │
│  - Restaurant info                                                 │
│  - Order details (ID, table, waiter, date/time)                    │
│  - Items with quantities and prices                                │
│  - Subtotal, discount, total                                       │
│  - Payment method, change                                          │
│  - Share/Print buttons                                             │
└─────────────────────────────────────────────────────────────────────┘

```

---

## 2. Table Status Management

### Scenario A: Occupied Table with Active Order
```
Table: OCCUPIED + Active Order
         │
         ▼ Waiter taps table
    ┌─────────────────┐
    │  Action Menu    │
    ├─────────────────┤
    │ View Order      │──► Navigate to waiter-order (edit mode)
    │ Pay             │──► Navigate to waiter-payment
    │ Cancel Order    │──► Call cancelOrderAndFreeTable()
    │ Cancel          │──► Close menu
    └─────────────────┘
```

### Scenario B: Occupied Table WITHOUT Order
```
Table: OCCUPIED + No Order
         │
         ▼ Waiter taps table
    ┌─────────────────┐
    │  Action Menu    │
    ├─────────────────┤
    │ Create Order    │──► Navigate to waiter-order (new)
    │ Free Table      │──► Set table.status = "open"
    │ Cancel          │──► Close menu
    └─────────────────┘
```

### Scenario C: Open Table
```
Table: OPEN
         │
         ▼ Waiter taps table
    ┌─────────────────┐
    │  Action Menu    │
    ├─────────────────┤
    │ Create Order    │──► Navigate to waiter-order (new)
    │ Mark Occupied   │──► Set table.status = "occupied"
    │ Cancel          │──► Close menu
    └─────────────────┘
```

### Scenario D: Long Press (Any Table)
```
Any Table
         │
         ▼ Waiter long-presses
    ┌────────────────────────┐
    │  Confirmation Dialog   │
    ├────────────────────────┤
    │ "Change table status?" │
    │                        │
    │  [Cancel]  [Confirm]   │
    └────────────────────────┘
              │
              ▼ Confirm
         Toggle Status
    (OPEN ↔ OCCUPIED)
```

---

## 3. Order Cancellation Flow

```
Waiter selects occupied table
         │
         ▼
   View Order option
         │
         ▼
   Click "Annuler la Commande"
         │
         ▼
┌──────────────────────────┐
│  Confirmation Dialog     │
│  "Cancel order for       │
│   Table X?"              │
│  [Non]  [Oui, Annuler]   │
└──────────────────────────┘
         │
         ▼ Confirm
┌──────────────────────────────────────┐
│ STORE: cancelOrderAndFreeTable()     │
│  1. order.status = CANCELLED         │
│  2. table.status = "open"            │
│  3. table.activeOrderTotal = undef.  │
└──────────────────────────────────────┘
         │
         ▼
   Navigate back to tables
```

---

## 4. Edit Existing Order Flow

```
Waiter selects occupied table
         │
         ▼
   View Order option
         │
         ▼
Screen: waiter-order.tsx
  - Loads existing order items into cart
  - Can add/remove/modify items
  - Can change item notes
         │
         ▼ Click "Envoyer à la Cuisine"
┌──────────────────────────────────┐
│ STORE: updateOrder()             │
│  - Update order.items            │
│  - Update order.total            │
│  - Update order.updatedAt        │
└──────────────────────────────────┘
         │
         ▼
   Navigate back to tables
```

---

## 5. Kitchen Order Status Progression

```
┌─────────┐    Click         ┌────────────┐    Click        ┌───────┐
│   NEW   │   "Commencer"    │ PREPARING  │  "Marquer Prête"│ READY │
│         │─────────────────►│            │────────────────►│       │
│  🔴 Red │                  │ 🟠 Orange  │                 │ 🟢 Green│
└─────────┘                  └────────────┘                 └───────┘
                                                                 │
                                                                 ▼
                                                       Waiter processes
                                                          payment
                                                                 │
                                                                 ▼
                                                            ┌──────┐
                                                            │ PAID │
                                                            │ ✓    │
                                                            └──────┘
```

---

## 6. Payment Processing Flow

```
waiter-payment.tsx loaded with orderId
         │
         ▼
Load order from store
         │
         ▼
┌────────────────────────────────┐
│  Payment Screen                │
│  ─────────────────────────     │
│  Items List                    │
│  Subtotal: XXX MAD             │
│  ─────────────────────────     │
│  Discount:                     │
│    [ ] Percentage              │
│    [ ] Fixed Amount            │
│  ─────────────────────────     │
│  Payment Method:               │
│    [Cash] [Card]               │
│  ─────────────────────────     │
│  If Cash:                      │
│    Amount Received: ___        │
│    Quick: [50][100][200][500]  │
│    Change: XXX MAD             │
│  ─────────────────────────     │
│  [Confirmer le Paiement]       │
└────────────────────────────────┘
         │
         ▼ Click Confirm
    Validation
    - If cash: received >= total?
         │
         ▼ Valid
┌────────────────────────────────┐
│  completePaymentAndFreeTable() │
│   with payment details         │
└────────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│  Success Dialog                │
│  "Payment Successful"          │
│                                │
│  [View Receipt] [Done]         │
└────────────────────────────────┘
```

---

## 7. Table Card Visual States

### Open Table
```
┌─────────────────────────────┐
│  🔵 [12]    Table 12        │
│                             │
│            Disponible       │
│                             │
│                   [LIBRE]   │ ← Gray badge
└─────────────────────────────┘
```

### Occupied Table (Order in Progress)
```
┌─────────────────────────────┐
│  🔵 [5]     Table 5         │
│                             │
│  Occupée  🛍️ 125 MAD       │ ← Shows order total
│                             │
│                  [OCCUPÉE]  │ ← Blue badge
└─────────────────────────────┘
```

### Occupied Table (Order READY)
```
┌═════════════════════════════┐ ← Green border
║  🔵 [8]     Table 8    ✓   ║ ← Check icon
║                             ║
║  Occupée  🛍️ 87 MAD        ║
║                             ║
║          💳      [PRÊTE]    ║ ← Green badge + Payment button
└═════════════════════════════┘
```

---

## 8. Data Persistence Flow

```
User Action
    │
    ▼
Zustand Store Update
    │
    ├──► State changes in memory
    │
    └──► persist() middleware triggers
         │
         ▼
    AsyncStorage.setItem()
         │
         ▼
    Data saved to device
         
         
On App Restart:
    │
    ▼
AsyncStorage.getItem()
    │
    ▼
Zustand hydrates state
    │
    ▼
All data restored
(tables, orders, products, etc.)
```

---

## 9. Store Actions Summary

| Action | Trigger | Effects |
|--------|---------|---------|
| `createOrderAndOccupyTable()` | Waiter sends order | • Create order (status=NEW)<br>• Mark table occupied<br>• Set activeOrderTotal |
| `updateOrderStatus()` | Kitchen changes status | • Update order.status<br>• Update order.updatedAt |
| `updateOrder()` | Waiter edits order | • Update order.items<br>• Update order.total<br>• Update order.updatedAt |
| `completePaymentAndFreeTable()` | Waiter processes payment | • Mark order PAID<br>• Save payment details<br>• Free table<br>• Clear activeOrderTotal |
| `cancelOrderAndFreeTable()` | Waiter cancels | • Mark order CANCELLED<br>• Free table<br>• Clear activeOrderTotal |
| `toggleTableStatus()` | Long press | • Toggle table.status<br>• (open ↔ occupied) |

---

## 10. Screen Navigation Map

```
┌──────────────┐
│     Home     │
│   (index)    │
└──────┬───────┘
       │
       ├──► Admin ────────► admin-products
       │                   admin-tables
       │                   admin-settings
       │                   order-history
       │
       ├──► Waiter ───┬──► waiter-tables
       │              │       │
       │              │       ├──► waiter-order (new/edit)
       │              │       │       │
       │              │       │       └──► Back to tables
       │              │       │
       │              │       └──► waiter-payment
       │              │               │
       │              │               └──► receipt
       │              │
       │              └──► waiter-orders (history)
       │
       └──► Kitchen ──────► kitchen-orders
                           (realtime updates)
```

---

## Summary

This POS system provides:

✅ **Complete order lifecycle** from creation to payment  
✅ **Automatic table management** based on order status  
✅ **Manual overrides** for special cases (long press)  
✅ **Real-time status updates** across all screens  
✅ **Kitchen integration** with visual status progression  
✅ **Flexible payment** with discounts and multiple methods  
✅ **Receipt generation** with share/print  
✅ **Offline persistence** with AsyncStorage  
✅ **Professional UX** with clear visual indicators  

**All flows are production-ready and fully integrated!** 🎉
