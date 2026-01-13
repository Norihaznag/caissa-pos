# Theme Configuration Guide

This document provides instructions for modifying the app's theme, including colors, and design tokens.

## Overview

The theming system uses CSS variables with NativeWind (Tailwind CSS for React Native). Theme values are defined in `theme.ts` and consumed via Tailwind classes.

**Key files:**

- `theme.ts` - Theme variables (colors, radius)
- `tailwind.config.js` - Tailwind configuration mapping CSS variables to classes
- `components/ThemeProvider.tsx` - Theme context provider

---

## Modifying Colors

### File: `theme.ts`

Colors are defined as RGB space-separated values (e.g., `"255 255 255"` for white) to support Tailwind's alpha modifier.

### Light Theme Colors

```typescript
export const lightTheme = vars({
  '--background': '255 255 255', // Page background
  '--foreground': '23 23 23', // Primary text

  '--card': '255 255 255', // Card background
  '--card-foreground': '23 23 23', // Card text

  '--primary': '24 24 27', // Primary buttons/actions
  '--primary-foreground': '250 250 250', // Text on primary

  '--secondary': '244 244 245', // Secondary buttons
  '--secondary-foreground': '24 24 27', // Text on secondary

  '--muted': '244 244 245', // Muted backgrounds
  '--muted-foreground': '113 113 122', // Subtle text

  '--accent': '244 244 245', // Accent highlights
  '--accent-foreground': '24 24 27', // Text on accent

  '--destructive': '220 38 38', // Error/danger actions

  '--border': '228 228 231', // Borders
  '--input': '228 228 231', // Input backgrounds
  '--ring': '161 161 170', // Focus rings
});
```

### Dark Theme Colors

```typescript
export const darkTheme = vars({
  '--background': '23 23 23', // Page background
  '--foreground': '250 250 250', // Primary text

  '--card': '30 30 30', // Card background
  '--card-foreground': '250 250 250', // Card text

  '--primary': '228 228 231', // Primary buttons
  '--primary-foreground': '24 24 27', // Text on primary

  // ... similar pattern for other colors
});
```

### How to Change a Color

1. **Pick your color** based on app category (see Color Selection below)
2. **Convert hex to RGB space-separated**: `#EA580C` → `234 88 12`
3. **Update the variable** in both `lightTheme` and `darkTheme`

**Example - Change primary color:**

```typescript
// In lightTheme:
"--primary": "234 88 12",           // Your chosen color
"--primary-foreground": "255 255 255", // Contrasting text

// In darkTheme:
"--primary": "251 146 60",           // Lighter variant for dark mode
"--primary-foreground": "23 23 23",  // Dark text on light background
```

### Color Conversion Reference

| Hex       | RGB Space-Separated |
| --------- | ------------------- |
| `#FFFFFF` | `255 255 255`       |
| `#000000` | `0 0 0`             |
| `#3B82F6` | `59 130 246`        |
| `#10B981` | `16 185 129`        |
| `#EF4444` | `239 68 68`         |
| `#F59E0B` | `245 158 11`        |
| `#8B5CF6` | `139 92 246`        |

---

## Semantic Color Tokens

| Token                  | Usage                      | Tailwind Class              |
| ---------------------- | -------------------------- | --------------------------- |
| `background`           | Page backgrounds           | `bg-background`             |
| `foreground`           | Primary text               | `text-foreground`           |
| `card`                 | Card/surface backgrounds   | `bg-card`                   |
| `card-foreground`      | Text on cards              | `text-card-foreground`      |
| `primary`              | Primary buttons, CTAs      | `bg-primary`                |
| `primary-foreground`   | Text on primary elements   | `text-primary-foreground`   |
| `secondary`            | Secondary buttons          | `bg-secondary`              |
| `secondary-foreground` | Text on secondary          | `text-secondary-foreground` |
| `muted`                | Muted/disabled backgrounds | `bg-muted`                  |
| `muted-foreground`     | Subtle/secondary text      | `text-muted-foreground`     |
| `accent`               | Accent highlights          | `bg-accent`                 |
| `accent-foreground`    | Text on accent             | `text-accent-foreground`    |
| `destructive`          | Error/danger states        | `bg-destructive`            |
| `border`               | Borders                    | `border-border`             |
| `input`                | Input field backgrounds    | `bg-input`                  |
| `ring`                 | Focus rings                | `ring-ring`                 |

### Chart Colors

For data visualizations:

- `--chart-1` through `--chart-5`: Five distinct colors for charts
- Usage: `bg-chart-1`, `text-chart-2`, etc.

### Sidebar Colors (if using sidebar navigation)

- `--sidebar`, `--sidebar-foreground`
- `--sidebar-primary`, `--sidebar-primary-foreground`
- `--sidebar-accent`, `--sidebar-accent-foreground`
- `--sidebar-border`, `--sidebar-ring`

---

## Border Radius

The `--radius` variable controls the base border radius. All radius utilities scale from this base.

```typescript
"--radius": "10", // Base radius in pixels
```

**Tailwind mapping:**

- `rounded-sm` = `calc(var(--radius) * 0.5)` = 5px
- `rounded` / `rounded-md` = `var(--radius)` = 10px
- `rounded-lg` = `calc(var(--radius) * 1.5)` = 15px

**To change:** Update `--radius` in both `lightTheme` and `darkTheme`.

## Color Selection

**Select colors that reflect your app’s unique purpose and personality. The following are just example palettes—feel free to use your creativity and define your own color scheme:**

|   App Type    |  Example Colors      |         Mood          |
|:-------------:|:--------------------|:---------------------:|
|   Finance     | Navy, Green         | Trust, stability      |
|   Fitness     | Orange, Green       | Energy, vitality      |
|   Food        | Red, Orange         | Warmth, appetite      |
|   Social      | Pink, Purple        | Fun, connection       |
| Productivity  | Gray, Purple        | Focus, efficiency     |
| Entertainment | Purple, Pink        | Excitement            |
|     Kids      | Yellow, Cyan        | Playful               |


**Rule: Match the color to the app's mood**

---

## Creating a Custom Theme

### Example: Food App Theme (Warm Orange)

```typescript
// theme.ts

export const lightTheme = vars({
  '--radius': '12',

  '--background': '255 251 245', // warm white
  '--foreground': '67 20 7', // warm brown

  '--card': '255 255 255',
  '--card-foreground': '67 20 7',

  // Warm orange primary
  '--primary': '234 88 12', // orange-600
  '--primary-foreground': '255 255 255',

  // Light orange secondary
  '--secondary': '255 237 213', // orange-100
  '--secondary-foreground': '154 52 18', // orange-800

  '--muted': '254 243 232',
  '--muted-foreground': '120 80 60',

  '--accent': '255 237 213',
  '--accent-foreground': '154 52 18',

  '--destructive': '239 68 68',

  '--border': '253 230 210',
  '--input': '253 230 210',
  '--ring': '234 88 12',
});

export const darkTheme = vars({
  '--radius': '12',

  '--background': '28 18 12',
  '--foreground': '255 247 237',

  '--card': '45 30 20',
  '--card-foreground': '255 247 237',

  '--primary': '251 146 60', // orange-400
  '--primary-foreground': '28 18 12',

  '--secondary': '67 40 24',
  '--secondary-foreground': '255 247 237',

  '--muted': '67 40 24',
  '--muted-foreground': '180 140 110',

  '--accent': '67 40 24',
  '--accent-foreground': '255 247 237',

  '--destructive': '248 113 113',

  '--border': '67 40 24',
  '--input': '67 40 24',
  '--ring': '251 146 60',
});
```

### Add a Custom Font (e.g., Girassol)

> **⚠️ IMPORTANT: Font Restriction** - Only fonts available in the `fontList` array given below can be used. Never use any font that is not present in this list.

```ts
export const fontList = [
  'Inter',
  'Roboto',
  'JetBrains Mono',
  'Cedarville Cursive',
  'Girassol',

  // NEW
  'Poppins',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Source Sans 3',
  'Nunito',
  'Merriweather',
  'Playfair Display',
  'Ubuntu',
  'DM Sans',
  'Work Sans',
  'Oswald',
  'Inconsolata',
  'Fira Code',
  'PT Sans',
  'PT Serif',
  'Raleway',
  'Manrope',
  'Outfit',
  'Mulish',
];
```
To update the font in your project, follow these steps:
1. **Install the Expo Google Font package** by adding it to `package.json` under `dependencies`:

```json
"@expo-google-fonts/girassol": "^0.4.1"
```

2. **Load the font globally** (required for mobile) in `_layout.tsx` or `App.tsx` using `useFonts`. This step is mandatory for Expo / React Native mobile apps.

Example:

```tsx
import { useFonts, Girassol_400Regular } from '@expo-google-fonts/girassol';

const [fontsLoaded] = useFonts({
  Girassol_400Regular,
});

if (!fontsLoaded) return null;
```

3. **Register the font in Tailwind** by editing `tailwind.config.js` and adding an entry inside `theme.extend.fontFamily`:

```js
fontFamily: {
  // ...other fonts
  girassol: ['Girassol_400Regular'],
},
```

4. **Use the font in your components** via Tailwind classes, for example:

```tsx
<Text className="font-girassol text-xl">Hello with Girassol font</Text>
```

Once configured, `font-girassol` will be available alongside your other font utilities.

---

## Quick Reference

### Change Primary Color

1. Open `theme.ts`
2. Find `"--primary"` in both `lightTheme` and `darkTheme`
3. Update RGB values
4. Update `"--primary-foreground"` for text contrast

### Change Border Radius

1. Open `theme.ts`
2. Find `"--radius"` in both themes
3. Update value (e.g., `"8"` for 8px, `"16"` for 16px)

### Add a New Color Token

1. Add variable to `lightTheme` and `darkTheme` in `theme.ts`
2. Add color mapping in `tailwind.config.js` under `theme.extend.colors`
3. Add to safelist pattern if needed

---

## Troubleshooting

### Dark mode not working?

- Ensure `ThemeProvider` wraps your app in `_layout.tsx`
- Check `darkMode: 'class'` is set in `tailwind.config.js`
