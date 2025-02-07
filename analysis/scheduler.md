# React Scheduler Deep Dive

## Table of Contents
1. [What is the React Scheduler?](#what-is-the-react-scheduler)
2. [Core Concepts](#core-concepts)
3. [Priority System](#priority-system)
4. [Task Scheduling Mechanism](#task-scheduling-mechanism)
5. [Min Heap Data Structure](#min-heap-data-structure)
6. [Time Slicing and Yielding](#time-slicing-and-yielding)
7. [Browser API Integration](#browser-api-integration)
8. [Basic Usage Examples](#basic-usage-examples)
9. [How React Uses Scheduler](#how-react-uses-scheduler)
10. [Advanced Concepts](#advanced-concepts)

## What is the React Scheduler?

The React Scheduler is a **task scheduling library** that allows React to coordinate work execution in a way that maintains good user experience. It's the foundation of React's concurrent features, enabling:

- **Time slicing**: Breaking work into small chunks
- **Priority-based scheduling**: High-priority work interrupts low-priority work
- **Yielding control**: Giving browser time for user interactions
- **Task cancellation**: Cancelling outdated work

### Key Files Overview

| File | Purpose | Link |
|------|---------|------|
| [Scheduler.js](../packages/scheduler/src/forks/Scheduler.js) | Main scheduler implementation | Core scheduling logic |
| [SchedulerPriorities.js](../packages/scheduler/src/SchedulerPriorities.js) | Priority level definitions | Priority constants |
| [SchedulerMinHeap.js](../packages/scheduler/src/SchedulerMinHeap.js) | Task queue data structure | Min heap implementation |
| [SchedulerFeatureFlags.js](../packages/scheduler/src/SchedulerFeatureFlags.js) | Configuration options | Timeout values & features |

## Core Concepts

### 1. Tasks
Every piece of work in the scheduler is represented as a **Task**:

```typescript
// From packages/scheduler/src/forks/Scheduler.js:43-51
export opaque type Task = {
  id: number,                    // Unique identifier
  callback: Callback | null,     // Function to execute
  priorityLevel: PriorityLevel,  // Task priority
  startTime: number,             // When task should start
  expirationTime: number,        // When task expires
  sortIndex: number,             // Heap sorting index
  isQueued?: boolean,           // Profiling flag
};
```

### 2. Two Queues System
The scheduler manages tasks using two separate queues:

- **`taskQueue`**: Tasks ready to execute immediately
- **`timerQueue`**: Delayed tasks waiting for their start time

```javascript
// From packages/scheduler/src/forks/Scheduler.js:75-76
var taskQueue: Array<Task> = [];
var timerQueue: Array<Task> = [];
```

### 3. Work Loop
The main execution happens in the work loop:

```javascript
// From packages/scheduler/src/forks/Scheduler.js:179-239
function workLoop(initialTime: number) {
  let currentTime = initialTime;
  advanceTimers(currentTime);           // Move ready delayed tasks
  currentTask = peek(taskQueue);        // Get highest priority task
  
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      break; // Yield to browser if task hasn't expired and time slice is up
    }
    
    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      // Execute the task
      const continuationCallback = callback(didUserCallbackTimeout);
      
      if (typeof continuationCallback === 'function') {
        // Task wants to continue, yield and schedule continuation
        currentTask.callback = continuationCallback;
        return true;
      } else {
        // Task completed, remove from queue
        pop(taskQueue);
      }
    }
    
    currentTask = peek(taskQueue);
  }
  
  return currentTask !== null; // Return whether more work exists
}
```

## Priority System

The scheduler uses 5 priority levels defined in [SchedulerPriorities.js](../packages/scheduler/src/SchedulerPriorities.js):

```javascript
// From packages/scheduler/src/SchedulerPriorities.js:13-18
export const NoPriority = 0;
export const ImmediatePriority = 1;      // -1ms timeout (immediate)
export const UserBlockingPriority = 2;   // 250ms timeout
export const NormalPriority = 3;         // 5000ms timeout  
export const LowPriority = 4;            // 10000ms timeout
export const IdlePriority = 5;           // Never expires
```

### Priority Timeout Mapping

```javascript
// From packages/scheduler/src/forks/Scheduler.js:342-362
function unstable_scheduleCallback(priorityLevel, callback, options) {
  var timeout;
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = -1; // Execute immediately
      break;
    case UserBlockingPriority:
      timeout = userBlockingPriorityTimeout; // 250ms
      break;
    case IdlePriority:
      timeout = maxSigned31BitInt; // Never expires
      break;
    case LowPriority:
      timeout = lowPriorityTimeout; // 10000ms
      break;
    case NormalPriority:
    default:
      timeout = normalPriorityTimeout; // 5000ms
      break;
  }
  
  var expirationTime = startTime + timeout;
  // ... create and schedule task
}
```

## Task Scheduling Mechanism

### 1. Scheduling a Task

The main entry point is `unstable_scheduleCallback`:

```javascript
// From packages/scheduler/src/forks/Scheduler.js:325-410
function unstable_scheduleCallback(
  priorityLevel: PriorityLevel,
  callback: Callback,
  options?: {delay: number}
): Task {
  var currentTime = getCurrentTime();
  
  // Handle delayed tasks
  var startTime;
  if (typeof options === 'object' && options !== null) {
    var delay = options.delay;
    startTime = delay > 0 ? currentTime + delay : currentTime;
  } else {
    startTime = currentTime;
  }
  
  // Calculate expiration time based on priority
  var expirationTime = startTime + timeout;
  
  // Create new task
  var newTask: Task = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  };
  
  if (startTime > currentTime) {
    // Delayed task - add to timer queue
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);
    
    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      // This is the earliest delayed task
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    // Immediate task - add to task queue
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);
    
    // Schedule execution if not already running
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true;
      requestHostCallback();
    }
  }
  
  return newTask;
}
```

### 2. Timer Management

Delayed tasks are managed through the timer system:

```javascript
// From packages/scheduler/src/forks/Scheduler.js:103-124
function advanceTimers(currentTime: number) {
  // Check for tasks that are no longer delayed
  let timer = peek(timerQueue);
  while (timer !== null) {
    if (timer.callback === null) {
      pop(timerQueue); // Remove cancelled tasks
    } else if (timer.startTime <= currentTime) {
      // Timer fired - move to task queue
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
    } else {
      return; // Remaining timers are still pending
    }
    timer = peek(timerQueue);
  }
}
```

## Min Heap Data Structure

The scheduler uses a **min heap** for efficient priority queue operations. Tasks are ordered by `sortIndex` (expiration time for ready tasks, start time for delayed tasks).

### Core Operations

```javascript
// From packages/scheduler/src/SchedulerMinHeap.js:15-35
export function push<T: Node>(heap: Heap<T>, node: T): void {
  const index = heap.length;
  heap.push(node);
  siftUp(heap, node, index); // Maintain heap property
}

export function peek<T: Node>(heap: Heap<T>): T | null {
  return heap.length === 0 ? null : heap[0]; // Always returns min element
}

export function pop<T: Node>(heap: Heap<T>): T | null {
  if (heap.length === 0) return null;
  
  const first = heap[0];
  const last = heap.pop();
  if (last !== first) {
    heap[0] = last;
    siftDown(heap, last, 0); // Maintain heap property
  }
  return first;
}
```

### Heap Ordering

```javascript
// From packages/scheduler/src/SchedulerMinHeap.js:93-96
function compare(a: Node, b: Node) {
  // Compare sort index first, then task id for stable ordering
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
```

## Time Slicing and Yielding

### Yielding Strategy

The scheduler yields control to the browser when:
1. The current task hasn't expired AND
2. The time slice is exhausted

```javascript
// From packages/scheduler/src/forks/Scheduler.js:450-470
function shouldYieldToHost(): boolean {
  if (enableRequestPaint && needsPaint) {
    return true; // Yield for paint requests
  }
  
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    return false; // Still within time slice
  }
  
  return true; // Time slice exhausted, yield
}
```

### Frame Rate Configuration

```javascript
// From packages/scheduler/src/SchedulerFeatureFlags.js:10
export const frameYieldMs = 5; // Default 5ms time slice
```

### Continuation Callbacks

Tasks can return continuation functions to resume work:

```javascript
// Example task that yields and continues
function expensiveTask(didTimeout) {
  let workDone = 0;
  const WORK_CHUNK = 1000;
  
  while (workDone < totalWork) {
    // Do a chunk of work
    doWork(WORK_CHUNK);
    workDone += WORK_CHUNK;
    
    // Check if we should yield
    if (!didTimeout && shouldYield()) {
      // Return continuation function
      return function(nextDidTimeout) {
        return expensiveTask(nextDidTimeout);
      };
    }
  }
  
  // Work completed, no continuation needed
  return null;
}
```

## Browser API Integration

The scheduler adapts to different environments:

### 1. MessageChannel (Preferred)
```javascript
// From packages/scheduler/src/forks/Scheduler.js:522-531
if (typeof MessageChannel !== 'undefined') {
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  
  schedulePerformWorkUntilDeadline = () => {
    port.postMessage(null); // Triggers async callback
  };
}
```

### 2. setImmediate (Node.js/IE)
```javascript
// From packages/scheduler/src/forks/Scheduler.js:514-521
if (typeof localSetImmediate === 'function') {
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate(performWorkUntilDeadline);
  };
}
```

### 3. setTimeout (Fallback)
```javascript
// From packages/scheduler/src/forks/Scheduler.js:532-537
schedulePerformWorkUntilDeadline = () => {
  localSetTimeout(performWorkUntilDeadline, 0);
};
```

## Basic Usage Examples

### 1. Simple Task Scheduling

```javascript
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_cancelCallback as cancelCallback
} from 'scheduler';

// Schedule a task
const task = scheduleCallback(NormalPriority, () => {
  console.log('Task executed!');
});

// Cancel if needed
cancelCallback(task);
```

### 2. Priority-Based Scheduling

```javascript
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_UserBlockingPriority as UserBlockingPriority,
  unstable_NormalPriority as NormalPriority,
  unstable_LowPriority as LowPriority,
  unstable_IdlePriority as IdlePriority
} from 'scheduler';

// High priority task (user interaction)
scheduleCallback(UserBlockingPriority, () => {
  console.log('User interaction handled');
});

// Low priority task (background work)
scheduleCallback(LowPriority, () => {
  console.log('Background work completed');
});

// Immediate task (urgent)
scheduleCallback(ImmediatePriority, () => {
  console.log('Urgent task executed');
});
```

### 3. Delayed Task Scheduling

```javascript
// Schedule a task to run after 1 second
scheduleCallback(
  NormalPriority,
  () => {
    console.log('Delayed task executed');
  },
  { delay: 1000 }
);
```

### 4. Interruptible Long Task

```javascript
function longRunningTask(didTimeout) {
  let progress = 0;
  const totalWork = 10000;
  
  // Do work in chunks
  while (progress < totalWork) {
    // Simulate work
    for (let i = 0; i < 100; i++) {
      progress++;
    }
    
    // Check if we should yield (only if not timed out)
    if (!didTimeout && shouldYield()) {
      // Return continuation to resume later
      return function(nextDidTimeout) {
        return longRunningTask(nextDidTimeout);
      };
    }
  }
  
  console.log('Long task completed');
  return null; // Task finished
}

// Schedule the interruptible task
scheduleCallback(NormalPriority, longRunningTask);
```

## How React Uses Scheduler

### 1. Work Loop Integration

React integrates with the scheduler in [ReactFiberRootScheduler.js](../packages/react-reconciler/src/ReactFiberRootScheduler.js):

```javascript
// From packages/react-reconciler/src/ReactFiberRootScheduler.js:493-507
const newCallbackNode = scheduleCallback(
  schedulerPriorityLevel,
  performWorkOnRootViaSchedulerTask.bind(null, root),
);

root.callbackPriority = newCallbackPriority;
root.callbackNode = newCallbackNode;
```

### 2. Priority Mapping

React maps its lane priorities to scheduler priorities:

```javascript
// From packages/react-reconciler/src/ReactFiberRootScheduler.js:478-493
switch (lanesToEventPriority(nextLanes)) {
  case DiscreteEventPriority:
  case ContinuousEventPriority:
    schedulerPriorityLevel = UserBlockingSchedulerPriority;
    break;
  case DefaultEventPriority:
    schedulerPriorityLevel = NormalSchedulerPriority;
    break;
  case IdleEventPriority:
    schedulerPriorityLevel = IdleSchedulerPriority;
    break;
  default:
    schedulerPriorityLevel = NormalSchedulerPriority;
    break;
}
```

### 3. Yielding Integration

React uses `shouldYield` to determine when to interrupt rendering:

```javascript
// React checks shouldYield during render
import { unstable_shouldYield as shouldYield } from 'scheduler';

function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

### 4. Time Slicing in Action

```javascript
// From packages/react-reconciler/src/ReactFiberWorkLoop.js
function performWorkOnRootViaSchedulerTask(root, didTimeout) {
  // React's main work function scheduled through scheduler
  const lanes = getNextLanes(root, workInProgressRootRenderLanes);
  
  if (lanes === NoLanes) {
    return null; // No work to do
  }
  
  const forceSync = didTimeout; // Use sync if scheduler says we timed out
  
  // Perform the actual React work
  const exitStatus = renderRootConcurrent(root, lanes);
  
  if (exitStatus === RootInProgress) {
    // More work to do, return continuation
    return performWorkOnRootViaSchedulerTask.bind(null, root);
  }
  
  // Work completed
  return null;
}
```

## Advanced Concepts

### 1. Task Cancellation

```javascript
// Tasks can be cancelled by setting callback to null
function unstable_cancelCallback(task: Task) {
  task.callback = null; // Scheduler will skip cancelled tasks
}
```

### 2. Priority Context

```javascript
// Execute code at a specific priority level
import { unstable_runWithPriority as runWithPriority } from 'scheduler';

runWithPriority(UserBlockingPriority, () => {
  // This code runs at UserBlocking priority
  scheduleCallback(NormalPriority, workCallback); // Inherits UserBlocking priority
});
```

### 3. Wrapped Callbacks

```javascript
// Preserve priority context across async boundaries
import { unstable_wrapCallback as wrapCallback } from 'scheduler';

const wrappedCallback = wrapCallback(() => {
  // This callback remembers the priority it was created with
});

setTimeout(wrappedCallback, 100); // Runs with preserved priority
```

### 4. Profiling Integration

When enabled, the scheduler tracks detailed performance metrics:

```javascript
// From packages/scheduler/src/SchedulerProfiling.js
export function markTaskStart(task, ms) {
  // Record task start time for profiling
}

export function markTaskCompleted(task, ms) {
  // Record task completion for profiling
}
```

## Key Takeaways

1. **Priority-Driven**: Higher priority tasks interrupt lower priority ones
2. **Time-Sliced**: Work is broken into small chunks to maintain responsiveness
3. **Adaptive**: Uses best available browser APIs for scheduling
4. **Cooperative**: Tasks can yield control and continue later
5. **Efficient**: Min heap ensures O(log n) priority queue operations
6. **Integrated**: React builds its concurrent features on top of this scheduler

The scheduler is the foundation that enables React's concurrent features like Suspense, transitions, and time slicing. Understanding it helps you understand how React maintains smooth user experiences even with heavy computational work. 



## docs
* [Add postTask browser scheduler implementation](https://github.com/facebook/react/pull/19479) how schedule work