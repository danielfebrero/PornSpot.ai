# Permission System

This document explains how to use the role and permission system based on user plans.

## Overview

The permission system provides fine-grained access control based on:

- **User Plans**: free, starter, unlimited, pro
- **User Roles**: user, admin, moderator
- **Feature-specific permissions**: generation limits, content privacy, etc.

## Quick Start

### 1. Wrap your app with PermissionsProvider

```tsx
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { createUserWithPlan } from "@/lib/userUtils";

function App() {
  const user = createUserWithPlan(currentUser); // Convert API user to permission-compatible format

  return (
    <PermissionsProvider user={user}>
      <YourAppContent />
    </PermissionsProvider>
  );
}
```

### 2. Use permission hooks in components

```tsx
import { usePermissions } from "@/contexts/PermissionsContext";

function GenerateButton() {
  const { canGenerateImages, canGenerateImagesCount } = usePermissions();

  const { allowed, remaining } = canGenerateImagesCount(1);

  return (
    <Button disabled={!allowed}>
      Generate Image {!allowed && `(${remaining} remaining)`}
    </Button>
  );
}
```

### 3. Use PermissionGate for conditional rendering

```tsx
import { PermissionGate } from "@/components/PermissionComponents";

function AdvancedFeatures() {
  return (
    <PermissionGate feature="generation" action="bulk" showUpgrade={true}>
      <BulkGenerationUI />
    </PermissionGate>
  );
}
```

## Plan Definitions

### Free Plan

- 1 image per day
- 5 bonus images on signup
-

### Starter Plan ($10/month, $100/year)

- 300 images per month

### Unlimited Plan ($20/month, $200/year)

- Unlimited image generation

### Pro Plan ($50/month, $500/year)

- Unlimited image generation
- Private content creation
- LoRA models
- Negative prompts
- Bulk generation
- Custom image size

## Core Components

### PermissionsProvider

Provides permission context to the entire app.

```tsx
<PermissionsProvider user={userWithPlan}>
  <App />
</PermissionsProvider>
```

### usePermissions Hook

Main hook for checking permissions.

```tsx
const {
  canGenerateImages,
  canGenerateImagesCount,
  canUseBulkGeneration,
  canUseLoRAModels,
  canCreatePrivateContent,
  getCurrentPlan,
  hasPermission,
} = usePermissions();
```

### useUserPermissions Hook

Extended hook with utility functions.

```tsx
const {
  checkGenerationLimits,
  canUpgradeToUnlimited,
  getUpgradeRecommendation,
  getPlanFeatures,
  formatUsageText,
} = useUserPermissions();
```

## UI Components

### PermissionGate

Conditionally renders content based on permissions.

```tsx
<PermissionGate
  feature="generation"
  action="lora"
  showUpgrade={true}
  fallback={<UpgradePrompt />}
>
  <LoRAControls />
</PermissionGate>
```

### UsageLimitsDisplay

Shows current usage and limits.

```tsx
<UsageLimitsDisplay />
```

### GenerationLimitWarning

Shows warnings when approaching limits.

```tsx
<GenerationLimitWarning />
```

### FeatureAvailability

Shows feature availability for current plan.

```tsx
<FeatureAvailability feature="bulk-generation" />
<FeatureAvailability feature="lora-models" />
<FeatureAvailability feature="negative-prompt" />
<FeatureAvailability feature="private-content" />
```

## Permission Checking Patterns

### Basic Permission Check

```tsx
if (canGenerateImages()) {
  // Show generation UI
}
```

### Count-based Permission Check

```tsx
const { allowed, remaining } = canGenerateImagesCount(5);

if (allowed) {
  // Allow bulk generation
} else {
  // Show limit reached message
}
```

### Feature-specific Permission Check

```tsx
if (hasPermission({ feature: "generation", action: "bulk" })) {
  // Show bulk generation options
}

if (hasPermission({ feature: "generation", action: "negative-prompt" })) {
  // Show negative prompt input
}
```

### Role-based Permission Check

```tsx
if (canAccessAdmin()) {
  // Show admin interface
}
```

## Integration with Existing Code

### Extending User Types

The system works with your existing `User` type:

````tsx
// Your existing User type stays the same
interface User {
  userId: string;
  email: string;
  // ... other fields
}

### API Integration

Update your user API to include plan and usage information:

```tsx
// Backend should return:
{
  userId: "123",
  email: "user@example.com",
  plan: "unlimited",
  role: "user",
  subscriptionStatus: "active",
  usageStats: {
    imagesGeneratedThisMonth: 150,
    imagesGeneratedToday: 5,
    storageUsedGB: 2.3
  }
}
````

### Layout Integration

Add the PermissionsProvider to your root layout:

```tsx
export default function RootLayout({ children }) {
  return (
    <UserProvider>
      <PermissionsProvider user={userWithPermissions}>
        <Header />
        <main>{children}</main>
      </PermissionsProvider>
    </UserProvider>
  );
}
```

## Demo Page

Visit `/demo-permissions` to see the permission system in action with different user plans.

## Best Practices

1. **Always check permissions before rendering UI**

   ```tsx
   {
     canUseBulkGeneration() && <BulkGenerationButton />;
   }
   ```

2. **Show upgrade prompts for unavailable features**

   ```tsx
   <PermissionGate showUpgrade={true} feature="generation" action="bulk">
     <BulkFeature />
   </PermissionGate>
   ```

3. **Display usage limits to users**

   ```tsx
   <UsageLimitsDisplay />
   <GenerationLimitWarning />
   ```

4. **Use descriptive permission contexts**

   ```tsx
   hasPermission({ feature: "generation", action: "private" });
   hasPermission({ feature: "admin", action: "manage-users" });
   ```

5. **Handle edge cases gracefully**
   ```tsx
   const { allowed, remaining } = canGenerateImagesCount(count);
   if (!allowed) {
     showError(`Only ${remaining} generations remaining`);
     return;
   }
   ```

## Testing

The system includes mock user utilities for testing:

```tsx
import { createMockUser } from "@/lib/userUtils";

// Test with different plans
const freeUser = createMockUser("free");
const proUser = createMockUser("pro");

// Test with custom overrides
const testUser = createMockUser("unlimited", {
  usageStats: { imagesGeneratedThisMonth: 999 },
});
```
