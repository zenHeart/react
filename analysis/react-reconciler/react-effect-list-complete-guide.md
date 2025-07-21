# React Effect List Complete Guide: Collection and Structure

## Overview

React's work loop collects render effects (like `useEffect`, `useLayoutEffect`, DOM mutations) into **per-fiber circular linked lists** during the render phase. Each fiber maintains its own effect list, which is then traversed during the commit phase to execute effects in the correct order.

## Key Data Structures

### 1. Effect Object Structure

```javascript
// From ReactFiberHooks.js - Effect type definition
type Effect = {
  tag: HookFlags,           // Effect type (Passive, Layout, etc.)
  create: () => (() => void) | void,  // Effect creation function
  destroy: (() => void) | void,       // Cleanup function
  deps: Array<mixed> | null,          // Dependencies array
  next: Effect | null,                // Next effect in linked list
  inst: EffectInstance,               // Effect instance
};
```

### 2. Fiber Structure with Effect Lists

```javascript
// From ReactFiber.js lines 160-170
function FiberNode(tag, pendingProps, key, mode) {
  // ... other fields
  
  // Each fiber has its own updateQueue for effects
  this.updateQueue = null;
  this.memoizedState = null;
  
  // Effects
  this.flags = NoFlags;
  this.subtreeFlags = NoFlags;
  this.deletions = null;
  
  // ... other fields
}
```

### 3. Update Queue Structure

```javascript
// From ReactFiberHooks.js lines 242-248
export type FunctionComponentUpdateQueue = {
  lastEffect: Effect | null,  // Points to last effect in THIS fiber's list
  events: Array<EventFunctionPayload<any, any, any>> | null,
  stores: Array<StoreConsistencyCheck<any>> | null,
  memoCache: MemoCache | null,
};
```

**Important:** Each fiber has its own `updateQueue.lastEffect` that points to the last effect in **this specific fiber's** circular linked list.

## Per-Fiber Effect List Architecture

### 1. Each Fiber Has Its Own Effect List

```javascript
// Example component tree with separate effect lists
function App() {
  return (
    <div>
      <Header />      // Fiber 1 - has its own effect list
      <Content />     // Fiber 2 - has its own effect list
      <Footer />      // Fiber 3 - has its own effect list
    </div>
  );
}

function Header() {
  useEffect(() => console.log('Header effect'), []);  // Added to Header fiber's list
  return <header>Header</header>;
}

function Content() {
  useEffect(() => console.log('Content effect'), []); // Added to Content fiber's list
  return <main>Content</main>;
}

function Footer() {
  useEffect(() => console.log('Footer effect'), []);  // Added to Footer fiber's list
  return <footer>Footer</footer>;
}
```

**Effect List Distribution:**
```javascript
// Each fiber has its own effect list:

// Header Fiber
headerFiber.updateQueue = {
  lastEffect: headerEffect,  // Points to Header's effect
};

// Content Fiber  
contentFiber.updateQueue = {
  lastEffect: contentEffect, // Points to Content's effect
};

// Footer Fiber
footerFiber.updateQueue = {
  lastEffect: footerEffect,  // Points to Footer's effect
};

// Each effect list is independent and circular:
// Header: headerEffect.next = headerEffect
// Content: contentEffect.next = contentEffect  
// Footer: footerEffect.next = footerEffect
```

## Effect Collection Process

### 1. Effect Creation During Render

```javascript
// From ReactFiberHooks.js lines 2580-2590
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

**Key Points:**
- **Per-fiber collection** - Each fiber has its own `updateQueue`
- **Circular linked list** - `lastEffect.next` points to first effect
- **Append to end** - New effects are added after `lastEffect`
- **Maintain circularity** - New effect points to first effect

### 2. Effect Collection During Work Loop

```javascript
// From ReactFiberWorkLoop.js lines 2849-2950
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
        workInProgressRootRenderLanes,
      );
      break;
    }
    // ... other cases
  }
  
  return next;
}
```

**Work Loop Process:**
1. **Begin work** - Process each fiber in depth-first order
2. **Collect effects** - Effects are added to current fiber's update queue
3. **Complete work** - Effects are linked into circular list
4. **Bubble up** - Effect flags are propagated to parent fibers

### 3. Effect Flag Propagation

```javascript
// From ReactFiberHooks.js lines 2610-2630
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

**Flag Propagation:**
- **Fiber flags** - Mark fiber as having effects
- **Subtree flags** - Propagate effect flags up the tree
- **Effect types** - Different flags for different effect types

## Circular Linked List Structure

### 1. Circular Linked List Formation

```javascript
// Initial state (no effects)
fiber.updateQueue = null;

// First effect added to this fiber
effect1.next = effect1;  // Points to itself
fiber.updateQueue = { lastEffect: effect1 };

// Second effect added to this fiber
effect1.next = effect2;  // First points to second
effect2.next = effect1;  // Second points back to first
fiber.updateQueue.lastEffect = effect2;

// Third effect added to this fiber
effect2.next = effect3;  // Second points to third
effect3.next = effect1;  // Third points to first
fiber.updateQueue.lastEffect = effect3;
```

**Visual Representation:**
```
Effect1 ←→ Effect2 ←→ Effect3
  ↑                      ↓
  └──────────────────────┘
```

### 2. Effect Traversal During Commit

```javascript
// From ReactFiberCommitEffects.js lines 147-150
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

**Traversal Process:**
1. **Start from first** - `firstEffect = lastEffect.next`
2. **Process each effect** - Check if effect matches flags
3. **Execute if needed** - Run effect creation function
4. **Continue until complete** - Stop when back to first effect

## Effect Collection in Different Phases

### 1. Render Phase Collection

```javascript
// From ReactFiberHooks.js - Effect mounting
function mountEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  mountEffectImpl(
    MountPassiveDevEffect | PassiveEffect | PassiveStaticEffect,
    HookPassive,
    create,
    deps,
  );
}

function mountLayoutEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null,
): void {
  mountEffectImpl(
    MountLayoutDevEffect | LayoutEffect,
    HookLayout,
    create,
    deps,
  );
}
```

**Effect Types Collected:**
- **Passive effects** - `useEffect` (run after commit)
- **Layout effects** - `useLayoutEffect` (run during commit)
- **Insertion effects** - `useInsertionEffect` (run before DOM mutations)

### 2. Commit Phase Execution

```javascript
// From ReactFiberCommitEffects.js - Effect execution phases
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

## Effect Cleanup and Updates

### 1. Effect Cleanup

```javascript
// From ReactFiberCommitEffects.js lines 248-300
export function commitHookEffectListUnmount(
  flags: HookFlags,
  finishedWork: Fiber,
  nearestMountedAncestor: Fiber | null,
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
        // Execute cleanup for THIS fiber
        const destroy = effect.inst.destroy;
        if (typeof destroy === 'function') {
          destroy();
        }
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}
```

**Cleanup Process:**
1. **Traverse effects** - Go through circular linked list
2. **Check flags** - Only execute matching effect types
3. **Run cleanup** - Execute destroy function
4. **Clear references** - Remove effect references

### 2. Effect Updates

```javascript
// From ReactFiberHooks.js lines 2640-2680
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

**Update Logic:**
1. **Compare dependencies** - Check if deps array changed
2. **Skip if unchanged** - Don't re-execute if deps same
3. **Mark for execution** - Add `HookHasEffect` flag if deps changed
4. **Add to list** - Include in effect linked list

## Complete Work Flow

### 1. Effect Collection During Render

```javascript
// Simplified work loop with per-fiber effect collection
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

### 2. Effect List Finalization

```javascript
// From ReactFiberWorkLoop.js lines 3100-3120
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

### 3. Effect Execution During Commit

```javascript
// From ReactFiberWorkLoop.js lines 1400-1420
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

## Work Loop Processing Per Fiber

### 1. Fiber-by-Fiber Processing

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

### 2. Effect Collection During Work Loop

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

**Key Points:**
- `currentlyRenderingFiber` refers to the current fiber being processed
- Effects are added to the current fiber's list only
- Each fiber's flags are set independently

## Commit Phase Per Fiber

### 1. Fiber-Specific Effect Execution

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

### 2. Tree Traversal During Commit

```javascript
// From ReactFiberWorkLoop.js - Commit phase
function commitRoot(root: FiberRoot, finishedWork: Fiber) {
  // Traverse the entire tree, processing each fiber's effects
  commitBeforeMutationEffects(finishedWork);
  commitMutationEffects(finishedWork);
  commitLayoutEffects(finishedWork);
  schedulePassiveEffects(finishedWork);
}

function commitBeforeMutationEffects(finishedWork: Fiber) {
  // Recursively process each fiber's effects
  let nextEffect = finishedWork.firstEffect;
  
  while (nextEffect !== null) {
    const current = nextEffect.alternate;
    
    // Process THIS fiber's effects
    commitBeforeMutationEffectsOnFiber(current, nextEffect);
    
    nextEffect = nextEffect.nextEffect;
  }
}
```

## Effect List Independence

### 1. Separate Effect Lists

```javascript
// Example: Multiple components with effects
function Parent() {
  useEffect(() => console.log('Parent effect'), []);  // Parent fiber's list
  
  return (
    <div>
      <Child1 />  // Child1 fiber's list
      <Child2 />  // Child2 fiber's list
    </div>
  );
}

function Child1() {
  useEffect(() => console.log('Child1 effect'), []); // Child1 fiber's list
  return <div>Child1</div>;
}

function Child2() {
  useEffect(() => console.log('Child2 effect'), []); // Child2 fiber's list
  return <div>Child2</div>;
}

// Result: 3 separate effect lists
// Parent fiber: [Parent effect]
// Child1 fiber: [Child1 effect]  
// Child2 fiber: [Child2 effect]
```

### 2. Effect List Lifecycle

```javascript
// Each fiber's effect list lifecycle:

// 1. Creation
fiber.updateQueue = null;  // Initially empty

// 2. Effect Collection (during render)
fiber.updateQueue = {
  lastEffect: effect1  // First effect
};
effect1.next = effect1;  // Circular

// 3. More Effects Added
fiber.updateQueue.lastEffect = effect2;
effect1.next = effect2;
effect2.next = effect1;  // Still circular

// 4. Effect Execution (during commit)
// Traverse this fiber's effect list
let effect = fiber.updateQueue.lastEffect.next;
do {
  // Execute effect
  effect = effect.next;
} while (effect !== fiber.updateQueue.lastEffect.next);

// 5. Cleanup
fiber.updateQueue = null;  // Clear after execution
```

## Key Benefits of Per-Fiber Effect Lists

### 1. Efficient Traversal
- **Circular list** - Easy to traverse all effects
- **O(n) traversal** - Linear time complexity
- **No array allocation** - Memory efficient

### 2. Effect Type Filtering
- **Flag-based filtering** - Only execute relevant effects
- **Phase-specific execution** - Different phases for different effects
- **Conditional execution** - Skip effects based on dependencies

### 3. Cleanup Management
- **Automatic cleanup** - Destroy functions called automatically
- **Order preservation** - Cleanup in reverse order of creation
- **Memory leak prevention** - Ensures cleanup even on errors

### 4. Update Optimization
- **Dependency comparison** - Skip effects with unchanged deps
- **Flag propagation** - Efficient tree-wide effect detection
- **Selective execution** - Only run effects that need to run

### 5. Isolation
- **Component isolation** - Each component's effects are independent
- **Error boundaries** - Effects don't interfere with other components
- **Cleanup isolation** - Each component cleans up its own effects

### 6. Performance
- **Selective execution** - Only process fibers with effects
- **Efficient traversal** - Process effects in component order
- **Memory efficiency** - No global effect list to maintain

### 7. Correctness
- **Proper ordering** - Effects execute in component tree order
- **Dependency management** - Each component manages its own effect dependencies
- **Lifecycle alignment** - Effects align with component lifecycle

## Summary

React's work loop collects render effects into **per-fiber circular linked lists** through:

1. **Per-fiber effect lists** - Each fiber has its own `updateQueue.lastEffect`
2. **Effect creation** - Effects added to current fiber's update queue during render
3. **Circular list formation** - Each fiber maintains its own circular linked list
4. **Flag propagation** - Effect flags bubble up the fiber tree
5. **Phase-specific execution** - Effects executed in specific commit phases
6. **Cleanup management** - Automatic cleanup with proper ordering
7. **Independent processing** - Each fiber's effects processed separately

This per-fiber effect list architecture provides:

- **Component isolation** - Effects are scoped to individual components
- **Independent execution** - Each fiber's effects are processed separately
- **Proper lifecycle management** - Effects align with component lifecycle
- **Performance optimization** - Only process fibers that have effects
- **Error isolation** - Effects don't interfere with other components

This architecture is fundamental to React's component model and ensures proper effect management in complex component trees. 