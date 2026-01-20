# CaissaPro Design System Documentation

## Overview

CaissaPro uses a **macOS-inspired design system** modeled after Apple's System Preferences and native macOS applications. This document describes the current implementation for AI assistants to understand and enhance.

---

## Design Philosophy

The design follows **Apple's Human Interface Guidelines** principles:
- **Light, clean interfaces** with subtle depth
- **Consistency** across all components
- **Subtle shadows and borders** for depth without heavy effects
- **Apple Blue (#007AFF)** as the primary accent color
- **Gray toolbar headers** matching macOS window chrome
- **Segmented controls** for category selection
- **Push buttons** with subtle 3D appearance

---

## Color Palette

### Primary Colors (macOS-inspired)

```javascript
// Header Gradient (Title Bar)
headerGradient: ['#CACACA', '#A7A7A7', '#8A8A8A']  // Light gray gradient, top to bottom
headerBorder: '#545454'  // Dark border at bottom of header
headerText: '#4D4D4D'    // Dark gray text on light header

// Backgrounds
background: '#EDEDED'       // Main app background (light gray)
surfaceLight: '#E8E8E8'     // Secondary surfaces, toolbars
surfaceWhite: '#FAFAFA'     // Buttons, cards, inputs
card: '#FFFFFF'             // Cards, modals

// Text Colors
textPrimary: '#333333'      // Main text
textSecondary: '#666666'    // Subtitles, labels
textMuted: '#999999'        // Placeholder, disabled
textOnButton: '#4D4D4D'     // Icons/text on light buttons

// Borders
borderLight: '#B0B0B0'      // Button borders
borderMedium: '#C0C0C0'     // Dividers
borderDark: '#545454'       // Header bottom border

// Primary Accent - Apple Blue
primary: '#007AFF'          // Primary buttons, links, selection
primaryLight: '#E5F1FF'     // Light blue backgrounds
primaryDark: '#0066DD'      // Pressed state

// Status Colors (Apple System Colors)
success: '#34C759'          // Success, cash payments, connected states
successLight: '#E8F8EB'     // Success backgrounds
warning: '#FF9500'          // Warning, pending orders
warningLight: '#FFF4E5'     // Warning backgrounds  
danger: '#FF3B30'           // Errors, badges, delete buttons
dangerLight: '#FFE5E5'      // Danger backgrounds
info: '#5AC8FA'             // Information
infoLight: '#E5F6FF'        // Info backgrounds
```

---

## Component Specifications

### 1. Header (Title Bar)

The header mimics a macOS window title bar:

```jsx
<LinearGradient
  colors={['#CACACA', '#A7A7A7', '#8A8A8A']}
  start={{ x: 0, y: 0 }}
  end={{ x: 0, y: 1 }}
  style={{ 
    borderBottomWidth: 1,
    borderBottomColor: '#545454',
  }}
>
```

**Key Elements:**
- **App Title**: Left-aligned, 13px, weight 600, color `#4D4D4D`
- **Toolbar Buttons**: Right-aligned, macOS push button style
- **No decorative elements** - clean, functional design

**Title Text Shadow (Embossed Effect):**
```jsx
textShadowColor: 'rgba(255,255,255,0.5)',
textShadowOffset: { width: 0, height: 1 },
textShadowRadius: 0,
```

### 2. Push Buttons (Icon Buttons)

Small toolbar buttons for actions:

```jsx
{
  width: 28,
  height: 22,
  borderRadius: 4,
  backgroundColor: '#FAFAFA',
  borderWidth: 1,
  borderColor: '#B0B0B0',
  alignItems: 'center',
  justifyContent: 'center',
}
```

**Icon Style:**
- Size: 14px
- Color: `#4D4D4D` (dark gray on light background)

**Active/Connected State:**
```jsx
{
  backgroundColor: '#5CB85C',  // Green
  borderColor: '#4CAE4C',
}
// Icon color: #FFFFFF (white)
```

### 3. Text Buttons (Push Buttons with Labels)

Buttons with text labels:

```jsx
{
  paddingHorizontal: 14,
  paddingVertical: 4,
  borderRadius: 4,
  backgroundColor: '#FAFAFA',
  borderWidth: 1,
  borderColor: '#B0B0B0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 0.5 },
  shadowOpacity: 0.1,
  shadowRadius: 0.5,
}
```

**Text Style:**
```jsx
{
  fontSize: 12,
  color: '#333333',
  fontWeight: '400',  // Regular weight for macOS buttons
}
```

### 4. Modal Headers

All modals use a consistent macOS-style light header:

```jsx
{
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 14,  // 14 phone, 18 tablet
  paddingHorizontal: 16,  // 16 phone, 24 tablet
  backgroundColor: '#F5F5F5',
  borderBottomWidth: 1,
  borderBottomColor: '#D0D0D0',
}
```

**Modal Title with Icon:**
```jsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
  <View style={{ 
    width: 36, 
    height: 36, 
    borderRadius: 8, 
    backgroundColor: '#E5F1FF',  // Use appropriate light color
    alignItems: 'center', 
    justifyContent: 'center' 
  }}>
    <Icon size={18} color="#007AFF" />  // Use appropriate accent color
  </View>
  <View>
    <Text style={{ fontSize: 17, fontWeight: '600', color: '#333333' }}>Title</Text>
    <Text style={{ fontSize: 13, color: '#666666' }}>Subtitle</Text>
  </View>
</View>
```

**Modal Close Button:**
```jsx
{
  width: 32,
  height: 32,
  borderRadius: 6,
  backgroundColor: '#E8E8E8',
  borderWidth: 1,
  borderColor: '#C8C8C8',
  alignItems: 'center',
  justifyContent: 'center',
}
// Icon: X, size 16, color #666666
```

**Icon Background Colors by Type:**
- Blue (default/info): `#E5F1FF` with icon `#007AFF`
- Green (success/open): `#E8F8EB` with icon `#34C759`
- Orange (warning/pending): `#FFF4E5` with icon `#FF9500`
- Red (danger/expenses): `#FFE5E5` with icon `#FF3B30`

### 5. Stats Bar (Toolbar)

Secondary toolbar below header:

```jsx
{
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 12,
  paddingVertical: 8,
  backgroundColor: '#E8E8E8',
  borderBottomWidth: 1,
  borderBottomColor: '#C0C0C0',
}
```

### 6. Search Field

macOS-style search input:

```jsx
{
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  borderRadius: 6,
  paddingHorizontal: 12,
  minHeight: 36,
  borderWidth: 1,
  borderColor: '#B8B8B8',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 1,
}
```

**Search Icon:** 14px, color `#999999`
**Placeholder Text:** color `#999999`
**Input Text:** 13px, color `#333333`

### 6. Segmented Control (Categories)

macOS-style segmented control for category selection:

**Container:**
```jsx
{
  flexDirection: 'row',
  backgroundColor: '#E0E0E0',
  borderRadius: 6,
  padding: 2,
  borderWidth: 1,
  borderColor: '#C8C8C8',
}
```

**Segment (Unselected):**
```jsx
{
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 4,
  backgroundColor: 'transparent',
}
// Text: fontSize 12, color #666666
```

**Segment (Selected):**
```jsx
{
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 4,
  backgroundColor: '#FFFFFF',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.15,
  shadowRadius: 1,
}
// Text: fontSize 12, color #333333, fontWeight 500
```

### 7. Table Selector Button

Button for selecting tables:

**Unselected (Counter/Comptoir):**
```jsx
{
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 4,
  gap: 6,
  borderWidth: 1,
  borderColor: '#B8B8B8',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 1,
}
// Icon: 16px, color #666666
// Text: 13px, weight 500, color #333333
```

**Selected (Table Active):**
```jsx
{
  backgroundColor: '#007AFF',  // Apple blue
  borderColor: '#0066DD',
}
// Icon: 16px, color #FFFFFF
// Text: 13px, weight 500, color #FFFFFF
```

### 8. Notification Badges

Red badge for notifications/alerts:

```jsx
{
  position: 'absolute',
  top: -5,
  right: -5,
  minWidth: 14,
  height: 14,
  borderRadius: 7,
  backgroundColor: '#FF3B30',  // Apple red
  alignItems: 'center',
  justifyContent: 'center',
}
// Text: fontSize 9, color #FFFFFF, fontWeight 700
```

**Blue badge (Orders):**
```jsx
{
  backgroundColor: '#007AFF',  // Apple blue
}
```

### 9. Warning Tags

Stock low warning tag:

```jsx
{
  backgroundColor: '#FFF3CD',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 4,
  borderWidth: 1,
  borderColor: '#FFE69C',
}
// Text: fontSize 11, weight 500, color #856404
```

### 10. Pending Orders Button

Orange warning-style button:

```jsx
{
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FF9500',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 4,
  gap: 6,
  borderWidth: 1,
  borderColor: '#E08600',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.3,
  shadowRadius: 1,
}
// Icon: 14px, color #FFFFFF
// Text: 12px, weight 600, color #FFFFFF
```

---

## Typography

### Font Weights
- **Regular (400)**: Body text, button labels
- **Medium (500)**: Subtitles, selected segments
- **Semibold (600)**: Headers, amounts, emphasis
- **Bold (700)**: Badges

### Font Sizes
- **9px**: Badges
- **11px**: Captions, small labels
- **12px**: Button labels, secondary info
- **13px**: Body text, input text
- **18px**: Large numbers (revenue)

---

## Shadow Specifications

### Subtle Button Shadow
```jsx
shadowColor: '#000',
shadowOffset: { width: 0, height: 0.5 },
shadowOpacity: 0.1,
shadowRadius: 0.5,
```

### Card/Segment Shadow
```jsx
shadowColor: '#000',
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.15,
shadowRadius: 1,
```

### Pressed/Active Shadow
```jsx
shadowColor: '#000',
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.3,
shadowRadius: 1,
```

---

## Spacing System

```javascript
spacing: {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}
```

Common gaps: 4px (tight), 6px (buttons), 8px (elements), 12px (sections)

---

## File Locations

| Component | File Path |
|-----------|-----------|
| Main Cashier Screen | `app/cashier-simple.tsx` |
| Theme Context | `lib/themes/ThemeContext.tsx` |
| Theme Definitions | `lib/themes/index.ts` |
| Admin Panel | `components/AdminPanel.tsx` |
| UI Components | `components/ui/` |

---

## Key Implementation Notes

1. **LinearGradient**: Using `expo-linear-gradient` for header gradient
2. **Dynamic Theme**: Uses `useAppTheme()` hook from ThemeContext
3. **Icons**: Using `lucide-react-native` icon library
4. **No Round Buttons**: All buttons use `borderRadius: 4` (rectangular)
5. **Traffic Lights**: Decorative only, no functionality
6. **Text Shadows**: Used sparingly for embossed effect on main header title only

---

## Enhancement Guidelines

When making design changes:

1. **Maintain Light Theme**: Keep backgrounds light (#EDEDED, #E8E8E8, #FAFAFA, #F5F5F5)
2. **Use Apple System Colors**: Blue #007AFF, Green #34C759, Red #FF3B30, Orange #FF9500
3. **Subtle Shadows**: Keep opacity low (0.08-0.15), small offset (0.5-2px)
4. **Consistent Border Radius**: 4px buttons, 6px close buttons, 8px icon badges, 12px cards
5. **Gray Borders**: #B0B0B0 buttons, #C8C8C8 close buttons, #D0D0D0 modal headers
6. **Dark Text on Light**: #333333 primary, #666666 secondary, #999999 muted
7. **Light Modal Headers**: Use #F5F5F5 background with colored icon badges, not colored headers

---

## Quick Reference Card

```
MAIN HEADER:    Gradient #CACACA → #8A8A8A, border #545454
MODAL HEADER:   bg #F5F5F5, border #D0D0D0
CLOSE BUTTON:   bg #E8E8E8, border #C8C8C8, radius 6px, icon #666666
ICON BADGE:     36x36px, radius 8px, light bg + colored icon
BUTTONS:        bg #FAFAFA, border #B0B0B0, radius 4px
ACTIVE:         bg #34C759, border #2DB84D (green)
SELECTED:       bg #007AFF, border #0066DD (blue)
WARNING:        bg #FF9500, border #E68600 (orange)
DANGER:         bg #FF3B30 (red)
BACKGROUND:     #EDEDED (main), #E8E8E8 (toolbar), #F5F5F5 (modal header)
TEXT:           #333333 (primary), #666666 (secondary), #999999 (muted)
CARDS:          bg #FFFFFF, border #D0D0D0, radius 12px
SHADOWS:        color #000, offset 0.5-2px, opacity 0.08-0.15
```
