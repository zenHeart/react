# React Diff Algorithm Complete Guide

## Overview

React's diff algorithm is the core of its reconciliation process, determining how to efficiently update the DOM when component state or props change. The algorithm uses a heuristic approach based on two assumptions:

1. **Two elements of different types will produce different trees**
2. **The developer can hint at which child elements may be stable across different renders with a `key` prop**

## Key Diff Strategies

### 1. Tree-Level Diffing

React first compares elements at the root level:

```javascript
// From ReactChildFiber.js - Element comparison
function updateElement(
  returnFiber: Fiber,
  current: Fiber | null,
  element: ReactElement,
  lanes: Lanes,
): Fiber {
  const elementType = element.type;
  
  if (current !== null) {
    if (
      current.elementType === elementType ||
      // Lazy types should reconcile their resolved type
      (typeof elementType === 'object' &&
        elementType !== null &&
        elementType.$$typeof === REACT_LAZY_TYPE &&
        resolveLazy(elementType) === current.type)
    ) {
      // Same type - reuse existing fiber
      const existing = useFiber(current, element.props);
      coerceRef(existing, element);
      existing.return = returnFiber;
      return existing;
    }
  }
  
  // Different type - create new fiber
  const created = createFiberFromElement(element, returnFiber.mode, lanes);
  coerceRef(created, element);
  created.return = returnFiber;
  return created;
}
```

**Tree-Level Diffing Rules:**
- **Different element types** → Destroy old tree, build new tree
- **Same element type** → Reuse existing fiber, update props
- **DOM elements** → Update attributes, reconcile children
- **Component elements** → Update props, re-render component

### 2. Key-Based Reconciliation

React uses keys to identify which items have changed, been added, or been removed:

```javascript
// From ReactChildFiber.js - Key-based reconciliation
function reconcileSingleElement(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  element: ReactElement,
  lanes: Lanes,
): Fiber {
  const key = element.key;
  let child = currentFirstChild;
  
  while (child !== null) {
    if (child.key === key) {
      // Found matching key
      if (child.elementType === element.type) {
        // Same type - reuse
        const existing = useFiber(child, element.props);
        existing.return = returnFiber;
        return existing;
      } else {
        // Different type - delete old, create new
        deleteRemainingChildren(returnFiber, child);
        break;
      }
    } else {
      // Key doesn't match - delete this child
      deleteChild(returnFiber, child);
    }
    child = child.sibling;
  }
  
  // Create new fiber
  const created = createFiberFromElement(element, returnFiber.mode, lanes);
  created.return = returnFiber;
  return created;
}
```

## Array Reconciliation Algorithm

### 1. Two-Phase Approach

React's array reconciliation uses a two-phase approach:

### 2. Iterator vs Array Reconciliation

React supports both array and iterable children through different reconciliation functions:

#### **reconcileChildrenArray** - Array-based Reconciliation

```javascript
// From ReactChildFiber.js - Array reconciliation
function reconcileChildrenArray(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: Array<any>,
  lanes: Lanes,
): Fiber | null {
  // Direct array access with index-based iteration
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    const newFiber = updateSlot(
      returnFiber,
      oldFiber,
      newChildren[newIdx], // Direct array access
      lanes,
    );
    // ... rest of logic
  }
}
```

**Key Characteristics:**
- **Direct array access** - Uses `newChildren[newIdx]` for O(1) access
- **Index-based iteration** - `for` loop with `newIdx < newChildren.length`
- **Length known** - Can check `newIdx === newChildren.length`
- **Memory efficient** - No iterator object creation

#### **reconcileChildrenIterator** - Iterator-based Reconciliation

```javascript
// From ReactChildFiber.js - Iterator reconciliation
function reconcileChildrenIterator(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: ?Iterator<mixed>,
  lanes: Lanes,
): Fiber | null {
  let step = newChildren.next();
  for (
    ;
    oldFiber !== null && !step.done;
    newIdx++, step = newChildren.next()
  ) {
    const newFiber = updateSlot(
      returnFiber,
      oldFiber,
      step.value, // Iterator value access
      lanes,
    );
    // ... rest of logic
  }
}
```

**Key Characteristics:**
- **Iterator protocol** - Uses `next()` and `step.done` for iteration
- **Lazy evaluation** - Values are only accessed when needed
- **Unknown length** - Must check `step.done` to determine end
- **Memory overhead** - Iterator object creation and state management

#### **reconcileChildrenIteratable** - Iterable Wrapper

```javascript
// From ReactChildFiber.js - Iterable wrapper
function reconcileChildrenIteratable(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildrenIterable: Iterable<mixed>,
  lanes: Lanes,
): Fiber | null {
  const iteratorFn = getIteratorFn(newChildrenIterable);
  const newChildren = iteratorFn.call(newChildrenIterable);
  
  // Validation and warnings for generators/maps
  if (__DEV__) {
    if (newChildren === newChildrenIterable) {
      // Warn about generators (mutable iterators)
      console.error('Using Iterators as children is unsupported...');
    } else if ((newChildrenIterable: any).entries === iteratorFn) {
      // Warn about Maps as children
      console.error('Using Maps as children is not supported...');
    }
  }
  
  return reconcileChildrenIterator(
    returnFiber,
    currentFirstChild,
    newChildren,
    lanes,
  );
}
```

**Key Characteristics:**
- **Iterable detection** - Uses `getIteratorFn()` to find iterator method
- **Validation** - Warns about problematic iterables (generators, maps)
- **Wrapper function** - Converts iterable to iterator for processing
- **Error handling** - Throws error for non-iterable objects

### 3. Performance Comparison

| Aspect | Array | Iterator |
|--------|-------|----------|
| **Access Pattern** | Direct indexing | Iterator protocol |
| **Memory Usage** | Low | Higher (iterator objects) |
| **Length Knowledge** | Known upfront | Unknown until iteration |
| **Lazy Evaluation** | No | Yes |
| **Validation** | None needed | Generator/Map warnings |
| **Performance** | Faster | Slower (protocol overhead) |

### 4. Use Cases and Trade-offs

#### **When to Use Arrays:**
```jsx
// Optimal for known, finite collections
const items = ['A', 'B', 'C'];
return (
  <ul>
    {items.map(item => <li key={item}>{item}</li>)}
  </ul>
);
```

#### **When to Use Iterables:**
```jsx
// For lazy evaluation or infinite sequences
function* generateItems() {
  yield 'A';
  yield 'B';
  yield 'C';
}

return (
  <ul>
    {generateItems().map(item => <li key={item}>{item}</li>)}
  </ul>
);
```

#### **Async Iterables (Advanced):**
```javascript
// From ReactChildFiber.js - Async iterable support
function reconcileChildrenAsyncIteratable(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildrenIterable: AsyncIterable<mixed>,
  lanes: Lanes,
): Fiber | null {
  const newChildren = newChildrenIterable[ASYNC_ITERATOR]();
  
  // Convert async iterator to sync-like iterator
  const iterator: Iterator<mixed> = ({
    next(): IteratorResult<mixed, void> {
      return unwrapThenable(newChildren.next());
    },
  }: any);
  
  return reconcileChildrenIterator(
    returnFiber,
    currentFirstChild,
    iterator,
    lanes,
  );
}
```

**Async Iterable Characteristics:**
- **Promise unwrapping** - `unwrapThenable()` handles async values
- **Suspense integration** - Can suspend during iteration
- **State preservation** - Iterator state maintained across renders
- **Complex reconciliation** - Requires special handling for async operations

### 5. Iterator Detection Logic

```javascript
// From ReactSymbols.js - Iterator detection
export function getIteratorFn(maybeIterable: ?any): ?() => ?Iterator<any> {
  if (maybeIterable === null || typeof maybeIterable !== 'object') {
    return null;
  }
  const maybeIterator =
    (MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL]) ||
    maybeIterable[FAUX_ITERATOR_SYMBOL];
  if (typeof maybeIterator === 'function') {
    return maybeIterator;
  }
  return null;
}
```

**Detection Strategy:**
1. **Symbol.iterator** - Primary method for iterables
2. **@@iterator** - Fallback for older environments
3. **Function check** - Ensures iterator method is callable
4. **Null safety** - Handles non-iterable objects gracefully

```javascript
// From ReactChildFiber.js - Array reconciliation
function reconcileChildrenArray(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  newChildren: Array<any>,
  lanes: Lanes,
): Fiber | null {
  let resultingFirstChild: Fiber | null = null;
  let previousNewFiber: Fiber | null = null;
  
  let oldFiber = currentFirstChild;
  let lastPlacedIndex = 0;
  let newIdx = 0;
  let nextOldFiber = null;
  
  // Phase 1: Traverse both lists simultaneously
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    if (oldFiber.index > newIdx) {
      nextOldFiber = oldFiber;
      oldFiber = null;
    } else {
      nextOldFiber = oldFiber.sibling;
    }
    
    const newFiber = updateSlot(
      returnFiber,
      oldFiber,
      newChildren[newIdx],
      lanes,
    );
    
    if (newFiber === null) {
      break;
    }
    
    if (shouldTrackSideEffects) {
      if (oldFiber && newFiber.alternate === null) {
        deleteChild(returnFiber, oldFiber);
      }
    }
    
    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    if (previousNewFiber === null) {
      resultingFirstChild = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }
    previousNewFiber = newFiber;
    oldFiber = nextOldFiber;
  }
  
  // Phase 2: Handle remaining children
  if (newIdx === newChildren.length) {
    // All new children processed - delete remaining old children
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }
  
  if (oldFiber === null) {
    // No more old children - create new children
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
      if (newFiber === null) continue;
      
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
    return resultingFirstChild;
  }
  
  // Phase 3: Use Map for complex cases
  const existingChildren = mapRemainingChildren(oldFiber);
  
  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = updateFromMap(
      existingChildren,
      returnFiber,
      newIdx,
      newChildren[newIdx],
      lanes,
    );
    
    if (newFiber !== null) {
      if (shouldTrackSideEffects) {
        if (newFiber.alternate !== null) {
          existingChildren.delete(
            newFiber.key === null ? newIdx : newFiber.key,
          );
        }
      }
      
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
    }
  }
  
  if (shouldTrackSideEffects) {
    existingChildren.forEach(child => deleteChild(returnFiber, child));
  }
  
  return resultingFirstChild;
}
```

### 2. Map-Based Reconciliation

For complex cases, React creates a Map of remaining children:

```javascript
// From ReactChildFiber.js - Map remaining children
function mapRemainingChildren(
  currentFirstChild: Fiber,
): Map<string | number, Fiber> {
  const existingChildren = new Map();
  let existingChild = currentFirstChild;
  
  while (existingChild !== null) {
    if (existingChild.key !== null) {
      existingChildren.set(existingChild.key, existingChild);
    } else {
      existingChildren.set(existingChild.index, existingChild);
    }
    existingChild = existingChild.sibling;
  }
  
  return existingChildren;
}
```

## Visual Examples

### 1. Simple Array Reconciliation

**Before:**
```jsx
<ul>
  <li key="A">A</li>
  <li key="B">B</li>
  <li key="C">C</li>
</ul>
```

**After:**
```jsx
<ul>
  <li key="A">A</li>
  <li key="D">D</li>
  <li key="B">B</li>
  <li key="C">C</li>
</ul>
```

**Diff Process:**
1. **Phase 1**: Compare A-A (match), B-D (different)
2. **Phase 2**: Create new fiber for D
3. **Phase 3**: Use Map to find B and C
4. **Result**: A stays, D inserted, B and C moved

### 2. Complex Array Reconciliation

**Before:**
```jsx
<ul>
  <li key="A">A</li>
  <li key="B">B</li>
  <li key="C">C</li>
  <li key="D">D</li>
</ul>
```

**After:**
```jsx
<ul>
  <li key="C">C</li>
  <li key="A">A</li>
  <li key="E">E</li>
  <li key="B">B</li>
</ul>
```

**Diff Process:**
1. **Phase 1**: Compare A-C (different), stop
2. **Phase 2**: Create Map of remaining children (B, C, D)
3. **Phase 3**: 
   - C: Found in Map, move to front
   - A: Found in Map, move to position 1
   - E: Not in Map, create new
   - B: Found in Map, move to position 3
   - D: Not used, delete

## Key Optimization Strategies

### 1. Early Termination

```javascript
// From ReactChildFiber.js - Early termination
if (newFiber === null) {
  // No match found - break out of loop
  if (oldFiber === null) {
    oldFiber = nextOldFiber;
  }
  break;
}
```

**Benefits:**
- Stops processing when no match is found
- Avoids unnecessary comparisons
- Reduces time complexity for simple cases

### 2. Place Child Optimization

```javascript
// From ReactChildFiber.js - Place child optimization
function placeChild(
  newFiber: Fiber,
  lastPlacedIndex: number,
  newIndex: number,
): number {
  newFiber.index = newIndex;
  if (!shouldTrackSideEffects) {
    return lastPlacedIndex;
  }
  
  const current = newFiber.alternate;
  if (current !== null) {
    const oldIndex = current.index;
    if (oldIndex < lastPlacedIndex) {
      // This is a move.
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    } else {
      // This item can stay in place.
      return oldIndex;
    }
  } else {
    // This is an insertion.
    newFiber.flags |= Placement;
    return lastPlacedIndex;
  }
}
```

**Optimization Logic:**
- **No movement needed** if `oldIndex >= lastPlacedIndex`
- **Movement needed** if `oldIndex < lastPlacedIndex`
- **Insertion** if no existing fiber

### 3. Side Effect Tracking

```javascript
// From ReactChildFiber.js - Side effect tracking
if (shouldTrackSideEffects) {
  if (oldFiber && newFiber.alternate === null) {
    // We matched the slot, but we didn't reuse the existing fiber
    deleteChild(returnFiber, oldFiber);
  }
}
```

**Benefits:**
- Only track side effects during updates (not initial render)
- Minimize DOM operations
- Optimize for common cases

## Performance Characteristics

### 1. Time Complexity

- **Best case**: O(n) - when children are in same order
- **Average case**: O(n) - with key-based optimization
- **Worst case**: O(n²) - when all children are reordered without keys

### 2. Space Complexity

- **O(n)** - Map for remaining children
- **O(n)** - Fiber tree structure
- **O(1)** - Temporary variables

### 3. Optimization Factors

```javascript
// Factors affecting performance:
1. Key usage - Proper keys improve performance significantly
2. Array size - Larger arrays benefit more from optimizations
3. Change patterns - Sequential changes are faster than random reordering
4. Component complexity - Simple components reconcile faster
```

## Key-Based Reconciliation Details

### 1. Key Matching Strategy

```javascript
// From ReactChildFiber.js - Key matching
function updateFromMap(
  existingChildren: Map<string | number, Fiber>,
  returnFiber: Fiber,
  newIdx: number,
  newChild: any,
  lanes: Lanes,
): Fiber | null {
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE: {
        const matchedFiber = existingChildren.get(
          newChild.key === null ? newIdx : newChild.key,
        ) || null;
        
        const updated = updateElement(
          returnFiber,
          matchedFiber,
          newChild,
          lanes,
        );
        return updated;
      }
    }
  }
  return null;
}
```

**Key Matching Rules:**
- **Explicit key**: Use `newChild.key`
- **Implicit key**: Use `newIdx` (array index)
- **Null key**: Treated as no key

### 2. Key Benefits

```javascript
// Without keys (poor performance):
// Before: [A, B, C, D]
// After:  [D, A, B, C]
// Result: All nodes recreated

// With keys (optimal performance):
// Before: [A, B, C, D]
// After:  [D, A, B, C] 
// Result: Only D moved, others reused
```

## Fragment Reconciliation

### 1. Fragment Handling

```javascript
// From ReactChildFiber.js - Fragment reconciliation
function updateFragment(
  returnFiber: Fiber,
  current: Fiber | null,
  fragment: ReactElement,
  lanes: Lanes,
  key: null | string,
): Fiber {
  if (current === null || current.tag !== Fragment) {
    const created = createFiberFromFragment(
      fragment.props.children,
      returnFiber.mode,
      lanes,
      key,
    );
    created.return = returnFiber;
    return created;
  } else {
    const existing = useFiber(current, fragment.props.children);
    existing.return = returnFiber;
    return existing;
  }
}
```

**Fragment Optimization:**
- **No DOM node** - Fragments don't create DOM elements
- **Children only** - Only reconcile children, not fragment itself
- **Key support** - Fragments can have keys for optimization

## Text Node Reconciliation

### 1. Text Node Handling

```javascript
// From ReactChildFiber.js - Text node reconciliation
function updateTextNode(
  returnFiber: Fiber,
  current: Fiber | null,
  textContent: string,
  lanes: Lanes,
): Fiber {
  if (current === null || current.tag !== HostText) {
    const created = createFiberFromText(textContent, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  } else {
    const existing = useFiber(current, textContent);
    existing.return = returnFiber;
    return existing;
  }
}
```

**Text Node Optimization:**
- **Simple comparison** - Just compare text content
- **No children** - Text nodes are leaf nodes
- **Fast updates** - Minimal DOM operations

## Portal Reconciliation

### 1. Portal Handling

```javascript
// From ReactChildFiber.js - Portal reconciliation
function updatePortal(
  returnFiber: Fiber,
  current: Fiber | null,
  portal: ReactPortal,
  lanes: Lanes,
): Fiber {
  if (
    current === null ||
    current.tag !== HostPortal ||
    current.stateNode.containerInfo !== portal.containerInfo ||
    current.stateNode.implementation !== portal.implementation
  ) {
    const created = createFiberFromPortal(portal, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  } else {
    const existing = useFiber(current, portal.children || {});
    existing.return = returnFiber;
    return existing;
  }
}
```

**Portal Optimization:**
- **Container check** - Compare portal containers
- **Implementation check** - Compare portal implementations
- **Children reconciliation** - Reconcile portal children

## Lazy Component Reconciliation

### 1. Lazy Component Handling

```javascript
// From ReactChildFiber.js - Lazy component reconciliation
case REACT_LAZY_TYPE: {
  const prevDebugInfo = pushDebugInfo(newChild._debugInfo);
  let resolvedChild;
  if (__DEV__) {
    resolvedChild = callLazyInitInDEV(newChild);
  } else {
    const payload = newChild._payload;
    const init = newChild._init;
    resolvedChild = init(payload);
  }
  const updated = updateSlot(
    returnFiber,
    oldFiber,
    resolvedChild,
    lanes,
  );
  currentDebugInfo = prevDebugInfo;
  return updated;
}
```

**Lazy Component Optimization:**
- **Resolve on demand** - Only resolve when needed
- **Cache resolved component** - Avoid repeated resolution
- **Fallback handling** - Show fallback while resolving

## Performance Best Practices

### 1. Key Usage

```jsx
// Good - Stable keys
{items.map(item => (
  <ListItem key={item.id} item={item} />
))}

// Bad - Unstable keys
{items.map((item, index) => (
  <ListItem key={index} item={item} />
))}
```

### 2. Component Structure

```jsx
// Good - Stable structure
function Parent({ children }) {
  return <div>{children}</div>;
}

// Bad - Dynamic structure
function Parent({ showHeader }) {
  return (
    <div>
      {showHeader && <Header />}
      <Content />
    </div>
  );
}
```

### 3. Memoization

```jsx
// Good - Memoized components
const MemoizedChild = React.memo(Child);

// Good - Memoized callbacks
const handleClick = useCallback(() => {
  // handler logic
}, [dependency]);
```

## Debugging Diff Issues

### 1. Common Problems

```javascript
// Problem: Missing keys
{items.map(item => <div>{item.name}</div>)}

// Solution: Add keys
{items.map(item => <div key={item.id}>{item.name}</div>)}
```

### 2. Performance Monitoring

```javascript
// React DevTools Profiler
// Shows reconciliation time and component updates

// React DevTools Components
// Shows fiber tree and reconciliation details
```

## Summary

React's diff algorithm is a sophisticated system that balances performance with correctness:

1. **Tree-level diffing** - Compare element types at root level
2. **Key-based reconciliation** - Use keys to identify stable elements
3. **Two-phase array reconciliation** - Optimize for common cases
4. **Map-based fallback** - Handle complex reordering scenarios
5. **Side effect tracking** - Minimize DOM operations
6. **Early termination** - Stop processing when no match found

The algorithm's success depends on:
- **Proper key usage** - Essential for optimal performance
- **Stable component structure** - Avoid unnecessary re-renders
- **Component memoization** - Prevent unnecessary reconciliation
- **Understanding trade-offs** - Balance performance vs. correctness

This diff algorithm enables React to efficiently update the DOM while maintaining a declarative programming model. 