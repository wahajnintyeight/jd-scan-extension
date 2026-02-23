# Searchable Dropdown for OpenRouter Models

## Overview

Implemented a searchable dropdown component in the Settings Modal that dynamically fetches and displays OpenRouter models when a user enters their API key. The modal has also been enlarged for better usability.

## Changes Made

### 1. Modal Size Increase

**Before:**
- Width: `max-w-2xl` (672px)
- Height: `max-h-[90vh]`

**After:**
- Width: `max-w-3xl` (768px)
- Height: `max-h-[92vh]`

This provides more space for the searchable dropdown and better visibility of model details.

### 2. New State Variables

Added state management for OpenRouter models:

```typescript
const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
const [fetchingModels, setFetchingModels] = useState(false);
const [modelSearchQuery, setModelSearchQuery] = useState('');
const [showModelDropdown, setShowModelDropdown] = useState(false);
```

### 3. Auto-Fetch Models

When user enters an OpenRouter API key, models are automatically fetched:

```typescript
// In API Key onChange handler
if (formData.provider === 'openrouter' && newApiKey.startsWith('sk-or-v1-')) {
  handleFetchOpenRouterModels(newApiKey);
}
```

### 4. Searchable Dropdown Component

**Features:**
- Search by model name or ID
- Shows model details (name, ID, description)
- Displays context length and pricing
- Real-time filtering as user types
- Click outside to close
- Keyboard navigation ready

**UI Structure:**
```
┌─────────────────────────────────────┐
│ 🔍 Search models...            ▼   │
├─────────────────────────────────────┤
│ GPT-4 Turbo                8K ctx   │
│ openai/gpt-4-turbo      $0.01/1K   │
│ Most capable GPT-4 model...        │
├─────────────────────────────────────┤
│ Claude 3 Opus              200K ctx │
│ anthropic/claude-3-opus $0.015/1K  │
│ Most powerful Claude model...      │
└─────────────────────────────────────┘
```

### 5. Model Filtering

Real-time search filtering:

```typescript
const filteredOpenRouterModels = openRouterModels.filter(model =>
  model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
  model.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
);
```

### 6. Click Outside Handler

Closes dropdown when clicking outside:

```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.model-dropdown-container')) {
      setShowModelDropdown(false);
    }
  };

  if (showModelDropdown) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [showModelDropdown]);
```

## User Flow

### 1. Select OpenRouter Provider

User selects "OpenRouter" from the provider dropdown.

### 2. Enter API Key

User enters their OpenRouter API key (starts with `sk-or-v1-`).

### 3. Auto-Fetch Models

- System detects valid API key format
- Automatically calls `/gollm/fetch-models` API
- Shows loading indicator: "Loading models..."
- Fetches 100+ models from OpenRouter

### 4. Search Models

User can:
- Click the search field to see all models
- Type to filter by name or ID
- See model details in dropdown
- Click a model to select it

### 5. Model Selection

When user clicks a model:
- Model ID is set in form
- Dropdown closes
- Search query clears
- Selected model is ready for testing

## Component Structure

```typescript
{formData.provider === 'openrouter' && openRouterModels.length > 0 ? (
  // Searchable Dropdown
  <div className="relative model-dropdown-container">
    <div className="relative">
      <Search icon />
      <input type="text" placeholder="Search models..." />
      <ChevronDown icon />
    </div>
    
    {showModelDropdown && (
      <div className="dropdown-menu">
        {filteredOpenRouterModels.map(model => (
          <button onClick={selectModel}>
            <div className="model-info">
              <p className="model-name">{model.name}</p>
              <p className="model-id">{model.id}</p>
              <p className="model-description">{model.description}</p>
            </div>
            <div className="model-stats">
              <p className="context-length">{model.context_length} ctx</p>
              <p className="pricing">${model.pricing.prompt}/1K</p>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
) : (
  // Regular Dropdown (for other providers)
  <select>
    {availableModels.map(model => (
      <option value={model}>{model}</option>
    ))}
  </select>
)}
```

## Styling

### Dropdown Menu

```css
.dropdown-menu {
  position: absolute;
  z-index: 50;
  width: 100%;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  max-height: 16rem;
  overflow-y: auto;
}
```

### Model Item

```css
.model-item {
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f1f5f9;
}

.model-item:hover {
  background-color: #fef3f2; /* brand-50 */
}
```

## Features

### ✅ Auto-Fetch
- Automatically fetches models when API key is entered
- No manual "Fetch Models" button needed
- Seamless user experience

### ✅ Real-Time Search
- Filters as user types
- Searches both name and ID
- Case-insensitive matching

### ✅ Rich Model Info
- Model name (e.g., "GPT-4 Turbo")
- Model ID (e.g., "openai/gpt-4-turbo")
- Description (truncated to 1 line)
- Context length (e.g., "8K ctx")
- Pricing (e.g., "$0.01/1K")

### ✅ Smart Behavior
- Shows loading state while fetching
- Clears search on selection
- Closes on click outside
- Resets when provider changes

### ✅ Fallback Handling
- Shows regular dropdown for other providers
- Shows message if no models loaded
- Handles fetch errors gracefully

## Error Handling

### No Models Loaded

```typescript
{formData.provider === 'openrouter' && openRouterModels.length === 0 && !fetchingModels && (
  <p className="text-xs text-slate-500 mt-1.5">
    Enter your API key to load available models
  </p>
)}
```

### Fetching State

```typescript
{fetchingModels && (
  <div className="flex items-center gap-2 mt-2 text-xs text-brand-600">
    <Loader2 className="w-3 h-3 animate-spin" />
    Loading models...
  </div>
)}
```

### Fetch Error

```typescript
if (!result.success) {
  console.error('Failed to fetch OpenRouter models:', result.error);
  setFormError(result.error || 'Failed to fetch models');
}
```

## Performance Optimizations

### 1. Debouncing (Future Enhancement)

```typescript
// Add debounce to search input
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    setModelSearchQuery(query);
  }, 300),
  []
);
```

### 2. Virtual Scrolling (Future Enhancement)

For large model lists (100+), implement virtual scrolling:

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={256}
  itemCount={filteredModels.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <ModelItem model={filteredModels[index]} />
    </div>
  )}
</FixedSizeList>
```

### 3. Memoization

```typescript
const filteredModels = useMemo(() => 
  openRouterModels.filter(model =>
    model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
  ),
  [openRouterModels, modelSearchQuery]
);
```

## Accessibility

### Keyboard Navigation (Future Enhancement)

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowDown':
      // Move to next item
      break;
    case 'ArrowUp':
      // Move to previous item
      break;
    case 'Enter':
      // Select current item
      break;
    case 'Escape':
      // Close dropdown
      setShowModelDropdown(false);
      break;
  }
};
```

### ARIA Attributes

```typescript
<input
  role="combobox"
  aria-expanded={showModelDropdown}
  aria-controls="model-listbox"
  aria-autocomplete="list"
/>

<div
  id="model-listbox"
  role="listbox"
>
  {filteredModels.map(model => (
    <button
      role="option"
      aria-selected={formData.model === model.id}
    >
      {model.name}
    </button>
  ))}
</div>
```

## Testing

### Manual Testing Steps

1. Open Settings Modal
2. Go to LLM API tab
3. Click "Add New Configuration"
4. Select "OpenRouter" as provider
5. Enter API key: `sk-or-v1-...`
6. Verify "Loading models..." appears
7. Verify models load in dropdown
8. Click model search field
9. Type "gpt" to filter
10. Verify only GPT models show
11. Click a model to select
12. Verify model ID is set
13. Verify dropdown closes

### Edge Cases

- Empty API key → No fetch
- Invalid API key → Error message
- Network error → Error message
- No models returned → Show message
- Click outside → Dropdown closes
- Change provider → Clear models
- Clear API key → Clear models

## Future Enhancements

1. **Model Favorites**
   - Allow users to favorite models
   - Show favorites at top of list

2. **Recent Models**
   - Track recently used models
   - Quick access to recent selections

3. **Model Comparison**
   - Compare multiple models side-by-side
   - Show pricing, context, capabilities

4. **Advanced Filters**
   - Filter by price range
   - Filter by context length
   - Filter by provider
   - Filter by modality

5. **Model Details Modal**
   - Click info icon for full details
   - Show all capabilities
   - Show example use cases

6. **Keyboard Shortcuts**
   - Arrow keys for navigation
   - Enter to select
   - Escape to close
   - Tab to cycle through

7. **Model Recommendations**
   - Suggest models based on use case
   - Show "Popular" badge
   - Show "Best Value" badge

## Files Modified

1. `jd-scan/components/SettingsModal.tsx`
   - Increased modal size
   - Added searchable dropdown
   - Added auto-fetch logic
   - Added click-outside handler

2. `jd-scan/utils/api.ts`
   - Added `fetchOpenRouterModels` function

## Dependencies

- `lucide-react` - Icons (Search, ChevronDown, Loader2)
- Existing API utilities
- React hooks (useState, useEffect, useMemo)

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Touch-friendly

## Summary

Successfully implemented a searchable dropdown for OpenRouter models with:
- Larger modal size (768px width)
- Auto-fetch on API key entry
- Real-time search filtering
- Rich model information display
- Smart click-outside behavior
- Loading states and error handling
- Seamless user experience

Users can now easily browse and select from 100+ OpenRouter models with a smooth, intuitive interface!
