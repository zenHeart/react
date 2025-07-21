# How React Scheduler Makes Render Phase Stoppable and Restartable

## Overview

React's scheduler implements a sophisticated system that allows the render phase to be interrupted and resumed, preventing long-running tasks from blocking the main thread. This is the foundation of React's concurrent features.

## Key Mechanisms

### 1. Time Slicing with `shouldYieldToHost()`

The core mechanism that enables stoppable rendering is the `shouldYieldToHost()` function:

```javascript
// From packages/scheduler/src/forks/Scheduler.js lines 447-460
function shouldYieldToHost(): boolean {
  if (!enableAlwaysYieldScheduler && enableRequestPaint && needsPaint) {
    // Yield now.
    return true;
  }
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    // The main thread has only been blocked for a really short amount of time;
    // smaller than a single frame. Don't yield yet.
    return false;
  }
  // Yield now.
  return true;
}
```

**Key Points:**
- **Frame-based timing** - Yields after a certain time interval (typically 5ms)
- **Paint requests** - Yields immediately if browser needs to paint
- **Configurable intervals** - Different priorities have different time slices

### 2. Work Loop with Yield Points

The work loop processes one fiber at a time and checks for yield conditions:

```javascript
// From ReactFiberWorkLoop.js - simplified work loop
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
  
  if (workInProgress !== null) {
    // Work was interrupted, return continuation
    return workLoopConcurrent;
  }
  
  // Work completed
  return null;
}
```

**Yield Conditions:**
1. **Time slice expired** - `shouldYieldToHost()` returns true
2. **Higher priority work** - New urgent updates arrive
3. **Browser needs control** - Paint, user events, etc.

### 3. Fiber State Preservation

When work is interrupted, React preserves the fiber state:

```javascript
// From ReactFiberWorkLoop.js lines 1800-1820
function unwindInterruptedWork(
  current: Fiber | null,
  interruptedWork: Fiber,
  lanes: Lanes,
) {
  // Save the current state of the interrupted fiber
  interruptedWork.lanes = lanes;
  interruptedWork.childLanes = NoLanes;
  
  // Mark as interrupted but not complete
  interruptedWork.flags |= Incomplete;
  
  // Preserve the work-in-progress tree
  workInProgress = interruptedWork;
}
```

**State Preservation:**
- **Fiber tree structure** - Complete work-in-progress tree
- **Progress markers** - Which fibers were completed
- **Lane information** - Priority and scheduling data
- **Flags** - Incomplete, Suspended, etc.

## When Scheduler Stops Fiber Render

### 1. Time Slice Expiration

```javascript
// From ReactFiberWorkLoop.js lines 1040-1050
const shouldTimeSlice =
  (!forceSync &&
    !includesBlockingLane(lanes) &&
    !includesExpiredLane(root, lanes)) ||
  checkIfRootIsPrerendering(root, lanes);

if (shouldTimeSlice) {
  // Use concurrent work loop with time slicing
  exitStatus = renderRootConcurrent(root, lanes);
} else {
  // Use sync work loop (no time slicing)
  exitStatus = renderRootSync(root, lanes, true);
}
```

**Conditions for Time Slicing:**
- **Non-blocking lanes** - Normal priority updates
- **Non-expired work** - Work hasn't been starved too long
- **Prerendering mode** - Always use concurrent rendering

### 2. Priority Interruption

```javascript
// From ReactFiberWorkLoop.js lines 741-787
export function requestUpdateLane(fiber: Fiber): Lane {
  const mode = fiber.mode;
  if (mode & ConcurrentMode) {
    // Concurrent mode - use priority-based lanes
    return requestEventTime() === NoTimestamp
      ? SyncLane
      : getEventPriority(createEventTime());
  } else {
    // Legacy mode - always sync
    return SyncLane;
  }
}
```

**Priority Levels:**
- **Immediate** - Sync lane, no interruption
- **User Blocking** - High priority, can interrupt normal work
- **Normal** - Default priority, can be interrupted
- **Low** - Low priority, interrupted by higher priorities
- **Idle** - Lowest priority, only runs when idle

### 3. Browser Event Cooperation

```javascript
// From packages/scheduler/src/forks/Scheduler.js lines 193-226
function flushWork(initialTime: number) {
  if (isHostCallbackScheduled) {
    // If a host callback was scheduled, we need to yield to the host.
    return true;
  }
  
  let currentTime = initialTime;
  let currentTask = peek(taskQueue);
  
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime) {
      // This task hasn't expired yet.
      break;
    }
    
    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      const continuationCallback = callback(didUserCallbackTimeout);
      
      if (typeof continuationCallback === 'function') {
        // Task yielded, schedule continuation
        currentTask.callback = continuationCallback;
        return true;
      }
    }
    
    pop(taskQueue);
    currentTask = peek(taskQueue);
  }
  
  return false;
}
```

## How React Recovers Stopped Fiber Render

### 1. Continuation Function Pattern

```javascript
// From ReactFiberWorkLoop.js lines 512-600
function performWorkOnRootViaSchedulerTask(
  root: FiberRoot,
  didTimeout: boolean,
): RenderTaskFn | null {
  // ... work processing ...
  
  // Enter the work loop
  performWorkOnRoot(root, lanes, forceSync);
  
  // Check if we need to schedule a continuation
  scheduleTaskForRootDuringMicrotask(root, now());
  if (root.callbackNode != null && root.callbackNode === originalCallbackNode) {
    // Return continuation function
    return performWorkOnRootViaSchedulerTask.bind(null, root);
  }
  return null;
}
```

**Continuation Mechanism:**
1. **Return continuation function** - Scheduler gets a function to resume
2. **Preserve context** - Root, lanes, and state are captured
3. **Schedule resumption** - Scheduler calls continuation when ready

### 2. Fiber Tree State Recovery

```javascript
// From ReactFiberWorkLoop.js lines 1830-1850
function prepareFreshStack(root: FiberRoot, lanes: Lanes): Fiber {
  // Reset work-in-progress
  workInProgressRoot = root;
  workInProgressRootRenderLanes = lanes;
  
  // Create or reuse work-in-progress tree
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  
  // Restore interrupted work if any
  if (root.interruptedWork !== null) {
    workInProgress = root.interruptedWork;
    root.interruptedWork = null;
  }
  
  return workInProgress;
}
```

**Recovery Process:**
1. **Restore work-in-progress** - Resume from interrupted fiber
2. **Preserve progress** - Completed fibers remain completed
3. **Continue traversal** - Start from where we left off

### 3. Lane Priority Management

```javascript
// From ReactFiberLane.js
export function getNextLanes(
  root: FiberRoot,
  wipLanes: Lanes,
  rootHasPendingCommit: boolean,
): Lanes {
  // Determine which lanes to work on next
  const pendingLanes = root.pendingLanes;
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;
  
  // Prioritize lanes based on urgency
  const nextLanes = getHighestPriorityLanes(pendingLanes & ~suspendedLanes);
  
  return nextLanes;
}
```

## What Happens After Stop

### 1. Commit Phase Continues

```javascript
// From ReactFiberWorkLoop.js lines 1400-1420
function commitRootWhenReady(
  root: FiberRoot,
  finishedWork: Fiber,
  // ... other parameters
) {
  // Commit can still proceed even if render was interrupted
  if (finishedWork !== null) {
    commitRoot(root, finishedWork);
  }
  
  // Schedule remaining work for later
  if (root.pendingLanes !== NoLanes) {
    ensureRootIsScheduled(root);
  }
}
```

**Commit Behavior:**
- **Completed work commits** - Finished fibers are committed to DOM
- **Interrupted work preserved** - Unfinished work stays in queue
- **Effects run** - `flushPendingEffects` executes for completed work

### 2. Effect Execution

```javascript
// From ReactFiberWorkLoop.js lines 4040-4060
export function flushPendingEffects(wasDelayedCommit?: boolean): boolean {
  if (pendingEffectsStatus === NO_PENDING_EFFECTS) {
    return false;
  }
  
  // Execute effects for completed work
  const root = pendingEffectsRoot;
  const lanes = pendingEffectsLanes;
  
  commitPassiveMountEffects(root, lanes);
  commitLayoutEffects(root, lanes);
  
  return true;
}
```

**Effect Timing:**
- **Passive effects** - `useEffect` runs after commit
- **Layout effects** - `useLayoutEffect` runs during commit
- **Cleanup functions** - Run before new effects

### 3. Work Rescheduling

```javascript
// From ReactFiberRootScheduler.js lines 383-450
function scheduleTaskForRootDuringMicrotask(
  root: FiberRoot,
  currentTime: number,
): Lane {
  // Determine next lanes to work on
  const nextLanes = getNextLanes(root, workInProgressRootRenderLanes, rootHasPendingCommit);
  
  if (nextLanes === NoLanes) {
    // No more work
    return NoLane;
  }
  
  // Schedule continuation task
  const schedulerPriorityLevel = lanesToEventPriority(nextLanes);
  const newCallbackNode = scheduleCallback(
    schedulerPriorityLevel,
    performWorkOnRootViaSchedulerTask.bind(null, root),
  );
  
  return nextLanes;
}
```

## Long Task Handling

### 1. Chunking Strategy

```javascript
// From ReactFiberWorkLoop.js - simplified
function performUnitOfWork(unitOfWork: Fiber): void {
  // Process one fiber at a time
  const current = unitOfWork.alternate;
  
  // Begin work phase
  let next = beginWork(current, unitOfWork, renderLanes);
  
  if (next === null) {
    // Complete work phase
    completeUnitOfWork(unitOfWork);
  } else {
    // Continue with child
    workInProgress = next;
  }
}
```

**Chunking Benefits:**
- **Granular control** - Can yield after each fiber
- **Progress preservation** - Completed fibers stay done
- **Resume capability** - Continue from any fiber

### 2. Expiration Handling

```javascript
// From ReactFiberLane.js
export function markStarvedLanesAsExpired(
  root: FiberRoot,
  currentTime: number,
): void {
  const pendingLanes = root.pendingLanes;
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;
  
  // Mark lanes as expired if they've been waiting too long
  const expiredLanes = pendingLanes & ~suspendedLanes & ~pingedLanes;
  
  root.expiredLanes |= expiredLanes;
}
```

**Expiration Logic:**
- **Time-based expiration** - Lanes expire after certain time
- **Priority-based expiration** - Higher priority lanes expire faster
- **Force sync rendering** - Expired lanes render synchronously

## Complete Work Flow

### 1. Initial Render Start

```javascript
// From ReactFiberRootScheduler.js lines 258-350
function processRootScheduleInMicrotask() {
  let root = firstScheduledRoot;
  while (root !== null) {
    const nextLanes = scheduleTaskForRootDuringMicrotask(root, currentTime);
    
    if (nextLanes === NoLane) {
      // Remove completed root
      removeRootFromSchedule(root);
    } else {
      // Keep root in schedule
      root = root.next;
    }
  }
}
```

### 2. Work Processing Loop

```javascript
// From ReactFiberWorkLoop.js lines 1020-1080
function performWorkOnRoot(
  root: FiberRoot,
  lanes: Lanes,
  forceSync: boolean,
): void {
  // Determine if should use time slicing
  const shouldTimeSlice = !forceSync && !includesBlockingLane(lanes);
  
  if (shouldTimeSlice) {
    // Concurrent rendering with time slicing
    const exitStatus = renderRootConcurrent(root, lanes);
    
    if (exitStatus === RootInProgress) {
      // Work was interrupted, will resume later
      return;
    }
  } else {
    // Synchronous rendering (no interruption)
    renderRootSync(root, lanes, true);
  }
  
  // Commit completed work
  commitRoot(root, finishedWork);
}
```

### 3. Interruption and Resume

```javascript
// From ReactFiberWorkLoop.js lines 1800-1850
function unwindInterruptedWork(
  current: Fiber | null,
  interruptedWork: Fiber,
  lanes: Lanes,
) {
  // Save interrupted work state
  interruptedWork.lanes = lanes;
  interruptedWork.childLanes = NoLanes;
  interruptedWork.flags |= Incomplete;
  
  // Unwind to root
  let returnFiber = interruptedWork.return;
  while (returnFiber !== null) {
    returnFiber.childLanes |= lanes;
    returnFiber.flags |= ChildLanes;
    returnFiber = returnFiber.return;
  }
  
  // Resume from interrupted fiber
  workInProgress = interruptedWork;
}
```

## Key Benefits

### 1. Responsive UI
- **No blocking** - Main thread never blocked for long
- **Immediate response** - User interactions handled promptly
- **Smooth animations** - Browser can paint between work chunks

### 2. Priority Management
- **Urgent updates** - High priority work interrupts low priority
- **Graceful degradation** - Less important work can be delayed
- **Resource efficiency** - Work is done when resources are available

### 3. Error Recovery
- **Isolated failures** - Errors don't crash entire render
- **Resume capability** - Can continue from any point
- **State preservation** - Progress is never lost

## Summary

React's scheduler makes the render phase stoppable and restartable through:

1. **Time slicing** - Breaking work into small chunks
2. **Yield points** - Checking if should yield after each fiber
3. **State preservation** - Saving work-in-progress tree
4. **Continuation functions** - Returning functions to resume work
5. **Priority management** - Interrupting lower priority work
6. **Expiration handling** - Forcing sync rendering for starved work

This system enables React's concurrent features while maintaining responsiveness and preventing long tasks from blocking the main thread. 