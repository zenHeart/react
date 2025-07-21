# Fiber Tree & Effect List Relationship: Complete Visual Guide

## Overview

This document provides a comprehensive visual explanation of how React's fiber tree relates to effect lists, showing when and how effects are collected during the work loop, and the relationship between component structure and effect management.

## Component Tree to Fiber Tree Mapping

### 1. Component Structure

```javascript
// React Component Tree
function App() {
  useEffect(() => console.log('App effect'), []);
  
  return (
    <div>
      <Header />
      <Content />
      <Footer />
    </div>
  );
}

function Header() {
  useLayoutEffect(() => console.log('Header layout'), []);
  return <header>Header</header>;
}

function Content() {
  useEffect(() => console.log('Content effect'), []);
  useLayoutEffect(() => console.log('Content layout'), []);
  return <main>Content</main>;
}

function Footer() {
  useEffect(() => console.log('Footer effect'), []);
  return <footer>Footer</footer>;
}
```

### 2. Fiber Tree Structure

```
                    App Fiber
                   /    |    \
                  /     |     \
                 /      |      \
            Header   Content   Footer
            Fiber    Fiber     Fiber
```

**Fiber Tree Properties:**
- **App Fiber**: `updateQueue.lastEffect` → App's effect list
- **Header Fiber**: `updateQueue.lastEffect` → Header's effect list  
- **Content Fiber**: `updateQueue.lastEffect` → Content's effect list
- **Footer Fiber**: `updateQueue.lastEffect` → Footer's effect list

## Effect Collection Process

### 1. Work Loop Traversal

```javascript
// From ReactFiberWorkLoop.js - Simplified work loop
function performUnitOfWork(unitOfWork: Fiber): Fiber | null {
  // Process THIS specific fiber
  const current = unitOfWork.alternate;
  
  switch (unitOfWork.tag) {
    case FunctionComponent: {
      // This will collect effects for THIS fiber only
      next = replayFunctionComponent(
        current,
        unitOfWork,  // This specific fiber
        unitOfWork.pendingProps,
        Component,
        context,
        renderLanes,
      );
      break;
    }
  }
  
  return next;
}
```

**Work Loop Steps:**
1. **Begin work on App fiber** - Start processing App component
2. **Collect effects for App fiber** - Add App's useEffect to App's effect list
3. **Begin work on Header fiber** - Start processing Header component
4. **Collect effects for Header fiber** - Add Header's useLayoutEffect to Header's effect list
5. **Complete work on Header fiber** - Finalize Header's effect list
6. **Begin work on Content fiber** - Start processing Content component
7. **Collect effects for Content fiber** - Add Content's effects to Content's effect list
8. **Complete work on Content fiber** - Finalize Content's effect list
9. **Begin work on Footer fiber** - Start processing Footer component
10. **Collect effects for Footer fiber** - Add Footer's useEffect to Footer's effect list
11. **Complete work on Footer fiber** - Finalize Footer's effect list
12. **Complete work on App fiber** - Finalize App's effect list

### 2. Effect Collection Per Fiber

```javascript
// From ReactFiberHooks.js - Effect collection
function pushEffectImpl(effect: Effect): Effect {
  // Get THIS fiber's update queue
  let componentUpdateQueue: null | FunctionComponentUpdateQueue =
    (currentlyRenderingFiber.updateQueue: any);
  
  if (componentUpdateQueue === null) {
    // Create update queue for THIS fiber
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber.updateQueue = (componentUpdateQueue: any);
  }
  
  // Add effect to THIS fiber's list
  const lastEffect = componentUpdateQueue.lastEffect;
  
  if (lastEffect === null) {
    // First effect in THIS fiber's list - create circular list
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    // Add to existing circular list in THIS fiber
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    componentUpdateQueue.lastEffect = effect;
  }
  
  return effect;
}
```

## Visual Effect Collection Flow

### 1. Initial State (No Effects)

```
Fiber Tree:                    Effect Lists:
┌─────────────┐               ┌─────────────┐
│   App       │               │ App: null   │
│  Fiber      │               │ Header: null│
├─────────────┤               │ Content: null│
│  Header     │               │ Footer: null│
│  Fiber      │               └─────────────┘
├─────────────┤
│  Content    │
│  Fiber      │
├─────────────┤
│  Footer     │
│  Fiber      │
└─────────────┘
```

### 2. Step 1: Process App Fiber

```
Work Loop: Begin work on App fiber
↓
App Fiber: currentlyRenderingFiber = App
↓
Collect App's useEffect
↓
App.updateQueue = {
  lastEffect: appEffect1
}
appEffect1.next = appEffect1  // Circular list
```

**Visual State:**
```
Fiber Tree:                    Effect Lists:
┌─────────────┐               ┌─────────────┐
│   App       │◄─── Effects   │ App: [App Effect] │
│  Fiber      │               │ Header: null│
├─────────────┤               │ Content: null│
│  Header     │               │ Footer: null│
│  Fiber      │               └─────────────┘
├─────────────┤
│  Content    │
│  Fiber      │
├─────────────┤
│  Footer     │
│  Fiber      │
└─────────────┘
```

### 3. Step 2: Process Header Fiber

```
Work Loop: Begin work on Header fiber
↓
Header Fiber: currentlyRenderingFiber = Header
↓
Collect Header's useLayoutEffect
↓
Header.updateQueue = {
  lastEffect: headerEffect1
}
headerEffect1.next = headerEffect1  // Circular list
```

**Visual State:**
```
Fiber Tree:                    Effect Lists:
┌─────────────┐               ┌─────────────┐
│   App       │◄─── Effects   │ App: [App Effect] │
│  Fiber      │               │ Header: [Header Layout] │
├─────────────┤               │ Content: null│
│  Header     │◄─── Effects   │ Footer: null│
│  Fiber      │               └─────────────┘
├─────────────┤
│  Content    │
│  Fiber      │
├─────────────┤
│  Footer     │
│  Fiber      │
└─────────────┘
```

### 4. Step 3: Process Content Fiber

```
Work Loop: Begin work on Content fiber
↓
Content Fiber: currentlyRenderingFiber = Content
↓
Collect Content's useEffect
↓
Content.updateQueue = {
  lastEffect: contentEffect1
}
contentEffect1.next = contentEffect1  // Circular list
↓
Collect Content's useLayoutEffect
↓
Content.updateQueue = {
  lastEffect: contentEffect2
}
contentEffect1.next = contentEffect2  // First → Second
contentEffect2.next = contentEffect1  // Second → First
```

**Visual State:**
```
Fiber Tree:                    Effect Lists:
┌─────────────┐               ┌─────────────┐
│   App       │◄─── Effects   │ App: [App Effect] │
│  Fiber      │               │ Header: [Header Layout] │
├─────────────┤               │ Content: [Content Effect, Content Layout] │
│  Header     │◄─── Effects   │ Footer: null│
│  Fiber      │               └─────────────┘
├─────────────┤
│  Content    │◄─── Effects
│  Fiber      │
├─────────────┤
│  Footer     │
│  Fiber      │
└─────────────┘
```

### 5. Step 4: Process Footer Fiber

```
Work Loop: Begin work on Footer fiber
↓
Footer Fiber: currentlyRenderingFiber = Footer
↓
Collect Footer's useEffect
↓
Footer.updateQueue = {
  lastEffect: footerEffect1
}
footerEffect1.next = footerEffect1  // Circular list
```

**Final Visual State:**
```
Fiber Tree:                    Effect Lists:
┌─────────────┐               ┌─────────────┐
│   App       │◄─── Effects   │ App: [App Effect] │
│  Fiber      │               │ Header: [Header Layout] │
├─────────────┤               │ Content: [Content Effect, Content Layout] │
│  Header     │◄─── Effects   │ Footer: [Footer Effect] │
│  Fiber      │               └─────────────┘
├─────────────┤
│  Content    │◄─── Effects
│  Fiber      │
├─────────────┤
│  Footer     │◄─── Effects
│  Fiber      │
└─────────────┘
```

## Effect List Structure Details

### 1. Circular Linked List Formation

```javascript
// App Fiber Effect List
App.updateQueue = {
  lastEffect: appEffect1
}
// Circular: appEffect1.next = appEffect1

// Content Fiber Effect List (2 effects)
Content.updateQueue = {
  lastEffect: contentEffect2
}
// Circular: contentEffect1.next = contentEffect2
//          contentEffect2.next = contentEffect1
```

**Visual Representation:**
```
App Fiber Effect List:
┌─────────────────┐
│ appEffect1 ─────┘
└─────────────────┘

Content Fiber Effect List:
┌─────────────────┐
│ contentEffect1 ──┼──→ contentEffect2
└─────────────────┘     ↑
                        │
                        └─────────────┘
```

### 2. Effect Traversal During Commit

```javascript
// From ReactFiberCommitEffects.js - Effect execution
export function commitHookEffectListMount(
  flags: HookFlags,
  finishedWork: Fiber,  // Specific fiber being processed
) {
  // Get THIS specific fiber's update queue
  const updateQueue: FunctionComponentUpdateQueue | null =
    (finishedWork.updateQueue: any);
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  
  if (lastEffect !== null) {
    // Traverse THIS fiber's effect list
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    
    do {
      if ((effect.tag & flags) === flags) {
        // Execute effect for THIS fiber
        const create = effect.create;
        const destroy = create();
        effect.inst.destroy = destroy;
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}
```

## Effect Collection Triggers

### 1. When Effects Are Collected

```javascript
// From ReactFiberHooks.js - Effect mounting
function mountEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  
  // Mark THIS fiber as having effects
  currentlyRenderingFiber.flags |= fiberFlags;
  
  // Add effect to THIS fiber's list
  hook.memoizedState = pushSimpleEffect(
    HookHasEffect | hookFlags,
    createEffectInstance(),
    create,
    nextDeps,
  );
}
```

**Collection Triggers:**
1. **useEffect call** - Triggers passive effect collection
2. **useLayoutEffect call** - Triggers layout effect collection
3. **useInsertionEffect call** - Triggers insertion effect collection
4. **Component render** - Effects collected during component function execution

### 2. Effect Collection Conditions

```javascript
// From ReactFiberHooks.js - Effect updates
function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: HookFlags,
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const effect: Effect = hook.memoizedState;
  const inst = effect.inst;

  if (currentHook !== null) {
    if (nextDeps !== null) {
      const prevEffect: Effect = currentHook.memoizedState;
      const prevDeps = prevEffect.deps;
      
      // Check if dependencies changed
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // Dependencies unchanged - skip effect
        hook.memoizedState = pushSimpleEffect(
          hookFlags,
          inst,
          create,
          nextDeps,
        );
        return;
      }
    }
  }

  // Dependencies changed - mark for execution
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushSimpleEffect(
    HookHasEffect | hookFlags,
    inst,
    create,
    nextDeps,
  );
}
```

**Collection Conditions:**
1. **Dependencies changed** - Effect will be re-executed
2. **First render** - Effect will be executed
3. **Dependencies unchanged** - Effect skipped (not collected for execution)

## Fiber Tree to Effect List Relationship

### 1. One-to-One Mapping

```javascript
// Each fiber has exactly one effect list
fiber.updateQueue = {
  lastEffect: effect1  // Points to last effect in THIS fiber's list
}

// Effect list is circular linked list
effect1.next = effect2
effect2.next = effect3
effect3.next = effect1  // Back to first
```

### 2. Effect List Independence

```javascript
// App fiber's effect list
App.updateQueue = {
  lastEffect: appEffect1
}

// Header fiber's effect list (completely separate)
Header.updateQueue = {
  lastEffect: headerEffect1
}

// Content fiber's effect list (completely separate)
Content.updateQueue = {
  lastEffect: contentEffect2
}
```

**Key Points:**
- **No shared effects** - Each fiber has its own effect list
- **Independent execution** - Effects execute per fiber
- **Isolated cleanup** - Each fiber cleans up its own effects
- **Component boundaries** - Effects don't cross component boundaries

### 3. Effect List Lifecycle

```javascript
// 1. Initial state
fiber.updateQueue = null;

// 2. Effect collection (during render)
fiber.updateQueue = {
  lastEffect: effect1
};
effect1.next = effect1;  // Circular

// 3. More effects added
fiber.updateQueue.lastEffect = effect2;
effect1.next = effect2;
effect2.next = effect1;  // Still circular

// 4. Effect execution (during commit)
// Traverse this fiber's effect list
let effect = fiber.updateQueue.lastEffect.next;
do {
  // Execute effect
  effect = effect.next;
} while (effect !== fiber.updateQueue.lastEffect.next);

// 5. Cleanup
fiber.updateQueue = null;  // Clear after execution
```

## Work Loop Processing Flow

### 1. Depth-First Traversal

```javascript
// Work loop processes fibers in depth-first order
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: Fiber): void {
  // Begin work - collect effects for THIS fiber
  const next = beginWork(current, unitOfWork, renderLanes);
  
  if (next === null) {
    // Complete work - finalize THIS fiber's effect list
    completeUnitOfWork(unitOfWork);
  } else {
    // Continue with child
    workInProgress = next;
  }
}
```

**Traversal Order:**
1. **App** - Begin work, collect effects, process children
2. **Header** - Begin work, collect effects, complete work
3. **Content** - Begin work, collect effects, complete work
4. **Footer** - Begin work, collect effects, complete work
5. **App** - Complete work (after all children)

### 2. Effect Collection During Traversal

```javascript
// From ReactFiberWorkLoop.js - Complete work
function completeUnitOfWork(unitOfWork: Fiber): void {
  let completedWork: Fiber = unitOfWork;
  
  do {
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;
    
    // Complete work on THIS fiber
    completeWork(current, completedWork, renderLanes);
    
    // Propagate effect flags to parent
    if (returnFiber !== null) {
      returnFiber.subtreeFlags |= completedWork.subtreeFlags;
      returnFiber.flags |= completedWork.flags;
    }
    
    // Move to sibling or parent
    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }
    
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}
```

**Effect Flag Propagation:**
- **Fiber flags** - Mark individual fiber as having effects
- **Subtree flags** - Propagate effect flags up the tree
- **Parent awareness** - Parents know if children have effects

## Commit Phase Effect Execution

### 1. Phase-Specific Execution

```javascript
// From ReactFiberWorkLoop.js - Commit phases
function commitRoot(root: FiberRoot, finishedWork: Fiber) {
  // Phase 1: Before mutation effects
  commitBeforeMutationEffects(finishedWork);
  
  // Phase 2: Mutation effects (DOM changes)
  commitMutationEffects(finishedWork);
  
  // Phase 3: Layout effects
  commitLayoutEffects(finishedWork);
  
  // Phase 4: Passive effects (scheduled separately)
  schedulePassiveEffects(finishedWork);
}
```

### 2. Per-Fiber Effect Execution

```javascript
// From ReactFiberCommitEffects.js - Effect execution
export function commitPassiveMountEffects(
  finishedWork: Fiber,  // Specific fiber
  hookFlags: HookFlags,
) {
  // Execute effects for THIS specific fiber
  commitHookEffectListMount(HookPassive | HookHasEffect, finishedWork);
}

export function commitLayoutEffects(
  finishedWork: Fiber,  // Specific fiber
  hookFlags: HookFlags,
) {
  // Execute effects for THIS specific fiber
  commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);
}
```

**Execution Order:**
1. **Insertion effects** - Before DOM mutations
2. **Layout effects** - During DOM mutations
3. **Passive effects** - After DOM mutations

## Key Relationships Summary

### 1. Fiber Tree Structure
- **One fiber per component** - Each React component gets one fiber
- **Parent-child relationships** - Fibers maintain component tree structure
- **Sibling relationships** - Fibers know about siblings for traversal

### 2. Effect List Structure
- **One effect list per fiber** - Each fiber has its own effect list
- **Circular linked list** - Effects form circular linked list within each fiber
- **Independent lists** - No sharing between fiber effect lists

### 3. Collection Process
- **Per-fiber collection** - Effects collected during fiber processing
- **Work loop driven** - Collection happens during work loop traversal
- **Flag propagation** - Effect flags bubble up the fiber tree

### 4. Execution Process
- **Phase-specific** - Different effect types execute in different phases
- **Per-fiber execution** - Each fiber's effects executed separately
- **Order preservation** - Effects execute in component tree order

### 5. Benefits of This Architecture
- **Component isolation** - Effects don't interfere between components
- **Efficient traversal** - Only process fibers with effects
- **Memory efficiency** - No global effect list to maintain
- **Error isolation** - Effects don't cross component boundaries
- **Performance optimization** - Selective effect processing

This architecture ensures that React's effect system is both efficient and correct, with each component managing its own effects independently while maintaining proper execution order and cleanup. 