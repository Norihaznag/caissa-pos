# Layout Guide

This document provides instructions for creating layouts and screens in this Expo/NativeWind project.

## Core Principles

1. **Use Flexbox** - React Native uses flexbox for all layouts
2. **Use gap** - Prefer `gap-*` over margins between siblings
3. **Semantic colors** - Use theme colors (`bg-background`, `text-foreground`)
4. **Bottom padding** - Add `pb-32` to ScrollView content for floating tab bar
5. **SafeAreaView** - Always wrap screens in SafeAreaView

---

## Screen Structure Template

Every screen should follow this basic structure:

\`\`\`
<CodeProject>
\`\`\`tsx file="app/screen.tsx"
import React from 'react';
import { View, SafeAreaView, ScrollView } from 'react-native';
import { Heading, Text } from '../components/ui';

export default function MyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="pb-32">
        {/* Header */}
        <View className="p-6">
          <Heading level="h2">Screen Title</Heading>
        </View>

        {/* Content */}
        <View className="px-6 gap-4">
          {/* Your content here */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Key Points:
- `SafeAreaView` with `flex-1 bg-background` as root
- `ScrollView` with `contentContainerClassName="pb-32"` for tab bar clearance
- Header section with `p-6` padding
- Content section with `px-6` horizontal padding and `gap-4` between items

---


### Root Layout (`app/_layout.tsx`)

\`\`\`
<CodeProject>
\`\`\`tsx file="app/_layout.tsx"
import { Stack } from "expo-router";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BottomSheetProvider } from "@/components/ui";
import "@/global.css";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <BottomSheetProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </BottomSheetProvider>
    </ThemeProvider>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Tab Layout (`app/(tabs)/_layout.tsx`)

\`\`\`
<CodeProject>
\`\`\`tsx file="app/(tabs)/_layout.tsx"
import { Tabs } from 'expo-router';
import { Home, Search, User } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <Home className={focused ? 'text-primary' : 'text-muted-foreground'} size={24} />
          ),
        }}
      />
      {/* More tabs... */}
    </Tabs>
  );
}
\`\`\`
</CodeProject>
\`\`\`

---

## Common Layout Patterns

### 1. Header with Actions

\`\`\`
<CodeProject>
\`\`\`tsx file="components/Header.tsx"
<View className="p-6 flex-row justify-between items-center">
  <View>
    <Text variant="muted">Welcome back,</Text>
    <Heading level="h2">User Name</Heading>
  </View>
  <View className="flex-row items-center gap-4">
    <ThemeToggle />
    <TouchableOpacity>
      <Bell className="text-foreground" size={24} />
    </TouchableOpacity>
  </View>
</View>
\`\`\`
</CodeProject>
\`\`\`

### 2. Section with Title

\`\`\`
<CodeProject>
\`\`\`tsx file="components/Section.tsx"
<View className="mb-6">
  <Heading level="h3" className="px-6 mb-4">Section Title</Heading>
  {/* Section content */}
</View>
\`\`\`
</CodeProject>
\`\`\`

### 3. Horizontal Scrolling List

\`\`\`
<CodeProject>
\`\`\`tsx file="components/HorizontalList.tsx"
<FlatList
  data={items}
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerClassName="px-6 gap-4"
  renderItem={({ item }) => (
    <Card className="w-64">
      {/* Card content */}
    </Card>
  )}
/>
\`\`\`
</CodeProject>
\`\`\`

### 4. Grid Layout (2 columns)

\`\`\`
<CodeProject>
\`\`\`tsx file="components/Grid.tsx"
<View className="flex-row flex-wrap gap-4 px-6">
  {items.map((item) => (
    <View key={item.id} className="basis-[48%]">
      <Card>
        {/* Card content */}
      </Card>
    </View>
  ))}
</View>
\`\`\`
</CodeProject>
\`\`\`

**Grid Column Reference:**
| Columns | Basis Class |
|---------|-------------|
| 2 | `basis-[48%]` |
| 3 | `basis-[31%]` |
| 4 | `basis-[23%]` |

### 5. Stats Row (Equal Width Cards)

\`\`\`
<CodeProject>
\`\`\`tsx file="components/StatsRow.tsx"
<View className="px-6">
  <View className="flex-row gap-4">
    <Card className="flex-1">
      <CardContent className="items-center py-4">
        <Icon className="text-primary mb-2" size={24} />
        <Text className="font-bold text-xl">42</Text>
        <Text variant="muted" size="sm">Label</Text>
      </CardContent>
    </Card>
    {/* More cards with flex-1 */}
  </View>
</View>
\`\`\`
</CodeProject>
\`\`\`

### 6. Menu/Settings List

\`\`\`
<CodeProject>
\`\`\`tsx file="components/MenuList.tsx"
<View className="px-6 gap-2">
  <Heading level="h4" className="mb-2">Section</Heading>

  <TouchableOpacity>
    <Card>
      <CardContent className="flex-row items-center justify-between py-3">
        <Text>Menu Item</Text>
        <ChevronRight className="text-muted-foreground" size={20} />
      </CardContent>
    </Card>
  </TouchableOpacity>
  {/* More items */}
</View>
\`\`\`
</CodeProject>
\`\`\`

### 7. Profile/Centered Content

\`\`\`
<CodeProject>
\`\`\`tsx file="components/ProfileCard.tsx"
<View className="px-6 mb-6">
  <Card>
    <CardContent className="items-center py-6">
      <Avatar size="2xl" source={{ uri: user.avatar }} />
      <Heading level="h3" className="mt-4">{user.name}</Heading>
      <Text variant="muted" className="text-center mt-1">
        {user.bio}
      </Text>
    </CardContent>
  </Card>
</View>
\`\`\`
</CodeProject>
\`\`\`

### 8. Hero Section with Overlay Search

\`\`\`
<CodeProject>
\`\`\`tsx file="components/HeroSearch.tsx"
<View className="px-6 mb-8">
  <HeroImage
    source={{ uri: imageUrl }}
    title="Hero Title"
  />
  {/* Floating search bar */}
  <View className="mt-[-28px] mx-4">
    <Input
      variant="pill"
      placeholder="Search..."
      icon={<Search className="text-primary" size={20} />}
    />
  </View>
</View>
\`\`\`
</CodeProject>
\`\`\`

### 9. Loading State

\`\`\`
<CodeProject>
\`\`\`tsx file="components/LoadingState.tsx"
if (loading) {
  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center">
      <ActivityIndicator size="large" />
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### 10. Empty State

\`\`\`
<CodeProject>
\`\`\`tsx file="components/EmptyState.tsx"
<View className="flex-1 items-center justify-center p-6">
  <Icon className="text-muted-foreground mb-4" size={48} />
  <Heading level="h3" className="text-center">No Items</Heading>
  <Text variant="muted" className="text-center mt-2">
    You haven't added any items yet.
  </Text>
  <Button className="mt-6">Add First Item</Button>
</View>
\`\`\`
</CodeProject>
\`\`\`

---

## Flexbox Quick Reference

### Direction
| Class | Direction |
|-------|-----------|
| `flex-row` | Horizontal (default in web, but RN default is column) |
| `flex-col` | Vertical (React Native default) |
| `flex-row-reverse` | Horizontal reversed |
| `flex-col-reverse` | Vertical reversed |

### Alignment (Main Axis - justify)
| Class | Alignment |
|-------|-----------|
| `justify-start` | Start |
| `justify-center` | Center |
| `justify-end` | End |
| `justify-between` | Space between |
| `justify-around` | Space around |
| `justify-evenly` | Space evenly |

### Alignment (Cross Axis - items)
| Class | Alignment |
|-------|-----------|
| `items-start` | Start |
| `items-center` | Center |
| `items-end` | End |
| `items-stretch` | Stretch (default) |
| `items-baseline` | Baseline |

### Flex Sizing
| Class | Effect |
|-------|--------|
| `flex-1` | Grow to fill space |
| `flex-none` | Don't grow or shrink |
| `flex-grow` | Allow growing |
| `flex-shrink` | Allow shrinking |
| `basis-[x%]` | Set base size |

### Wrapping
| Class | Effect |
|-------|--------|
| `flex-wrap` | Allow wrapping |
| `flex-nowrap` | No wrapping (default) |

---

## Spacing Reference

### Padding & Margin Scale
| Size | Value | Common Usage |
|------|-------|--------------|
| `1` | 4px | Tiny spacing |
| `2` | 8px | Small spacing |
| `3` | 12px | Compact spacing |
| `4` | 16px | Default spacing |
| `5` | 20px | Medium spacing |
| `6` | 24px | Section padding |
| `8` | 32px | Large spacing |
| `10` | 40px | Extra large |
| `12` | 48px | Huge spacing |

### Standard Screen Padding
- **Horizontal:** `px-6` (24px)
- **Vertical sections:** `mb-6` or `mb-8`
- **Between items:** `gap-4` (16px)
- **Bottom for tab bar:** `pb-32` (128px)

---

## Responsive Considerations

React Native doesn't have CSS breakpoints. For responsive layouts:

### Use Dimensions API

\`\`\`
<CodeProject>
\`\`\`tsx file="utils/responsive.tsx"
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// Adjust columns based on width
const columns = isTablet ? 3 : 2;
const basisClass = isTablet ? 'basis-[31%]' : 'basis-[48%]';
\`\`\`
</CodeProject>
\`\`\`

### Use useWindowDimensions Hook

\`\`\`
<CodeProject>
\`\`\`tsx file="hooks/useResponsive.tsx"
import { useWindowDimensions } from 'react-native';

function MyComponent() {
  const { width, height } = useWindowDimensions();
  // Respond to dimension changes
}
\`\`\`
</CodeProject>
\`\`\`

---

## Common Mistakes to Avoid

### DON'T: Use CSS Grid
\`\`\`tsx
// ❌ Grid is not supported
<View className="grid grid-cols-2">
\`\`\`

### DO: Use Flexbox with wrap
\`\`\`tsx
// ✅ Use flex-row flex-wrap
<View className="flex-row flex-wrap gap-4">
  <View className="basis-[48%]">
\`\`\`

### DON'T: Use flex-1 with flex-wrap
\`\`\`tsx
// ❌ flex-1 doesn't work well with wrap
<View className="flex-row flex-wrap">
  <View className="flex-1">  // Won't work as expected
\`\`\`

### DO: Use basis-[x%] with wrap
\`\`\`tsx
// ✅ Use explicit basis
<View className="flex-row flex-wrap">
  <View className="basis-[48%]">
\`\`\`

### DON'T: Forget bottom padding for tab bar
\`\`\`tsx
// ❌ Content will be hidden behind tab bar
<ScrollView>
\`\`\`

### DO: Add pb-32 for floating tab bar
\`\`\`tsx
// ✅ Content clears the tab bar
<ScrollView contentContainerClassName="pb-32">
\`\`\`

### DON'T: Use hardcoded colors
\`\`\`tsx
// ❌ Won't adapt to theme
<View className="bg-white">
<Text className="text-gray-500">
\`\`\`

### DO: Use semantic colors
\`\`\`tsx
// ✅ Adapts to light/dark theme
<View className="bg-background">
<Text className="text-muted-foreground">
\`\`\`

### DON'T: Use margin for spacing between siblings
\`\`\`tsx
// ❌ Margin on each item is repetitive
<View>
  <Card className="mb-4">
  <Card className="mb-4">
  <Card className="mb-4">  // Last one doesn't need margin
\`\`\`

### DO: Use gap on parent
\`\`\`tsx
// ✅ Gap handles spacing cleanly
<View className="gap-4">
  <Card>
  <Card>
  <Card>
\`\`\`

---

## Screen Templates

### List Screen

\`\`\`
<CodeProject>
\`\`\`tsx file="app/list.tsx"
export default function ListScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadItems(); }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <FlatList
        data={items}
        contentContainerClassName="p-6 pb-32 gap-4"
        ListHeaderComponent={
          <Heading level="h2" className="mb-4">Items</Heading>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text variant="muted">No items found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>{/* Item content */}</Card>
        )}
      />
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Detail Screen

\`\`\`
<CodeProject>
\`\`\`tsx file="app/detail.tsx"
export default function DetailScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="pb-32">
        {/* Hero/Image */}
        <HeroImage source={{ uri: imageUrl }} height="h-72" />

        {/* Content */}
        <View className="p-6 gap-6">
          <View>
            <Heading level="h1">{title}</Heading>
            <Text variant="muted" className="mt-2">{subtitle}</Text>
          </View>

          <View className="gap-4">
            <Heading level="h3">Details</Heading>
            <Text>{description}</Text>
          </View>
        </View>

        {/* Fixed bottom action */}
        <View className="p-6">
          <Button fullWidth>Take Action</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`

### Form Screen

\`\`\`
<CodeProject>
\`\`\`tsx file="app/form.tsx"
export default function FormScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-6 pb-32">
        <Heading level="h2" className="mb-6">Form Title</Heading>

        <View className="gap-4">
          <View>
            <Text variant="label" className="mb-2">Field Label</Text>
            <Input placeholder="Enter value..." />
          </View>

          <View>
            <Text variant="label" className="mb-2">Another Field</Text>
            <Input placeholder="Enter value..." />
          </View>

          <Button fullWidth className="mt-4">Submit</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
\`\`\`
</CodeProject>
\`\`\`
