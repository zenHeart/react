# React Render Process Debug Guide

## Overview

This guide explains how to debug React's render process to understand how it works in the browser. The key difference between the test environment and browser environment is:

- **Test Environment**: Uses JSDOM (simulated DOM) + Mock Scheduler
- **Browser Environment**: Uses real DOM + Real Scheduler + Browser APIs

## Key Differences: Test vs Browser

### 1. DOM Environment

**Test Environment:**
```javascript
// Uses JSDOM - simulated DOM
const container = document.createElement('div'); // JSDOM implementation
```

**Browser Environment:**
```javascript
// Uses real browser DOM
const container = document.getElementById('root'); // Real DOM element
```

### 2. Scheduler Implementation

**Test Environment:**
```javascript
// Uses mock scheduler with controlled timing
jest.mock('scheduler', () => require('scheduler/unstable_mock'));
Scheduler.unstable_advanceTime(100); // Manual time control
```

**Browser Environment:**
```javascript
// Uses real scheduler with browser timing
import { scheduleCallback } from 'scheduler';
scheduleCallback(NormalPriority, () => {
  // Real time slicing and yielding
});
```

### 3. Event Handling

**Test Environment:**
```javascript
// Simulated events
await act(() => {
  button.click(); // JSDOM simulated click
});
```

**Browser Environment:**
```javascript
// Real browser events
button.addEventListener('click', () => {
  // Real event handling with browser timing
});
```

## Debugging React Render Process

### 1. Understanding the Render Flow

The React render process follows this sequence:

```
1. createRoot() → FiberRoot + HostRoot
2. root.render() → updateContainer()
3. scheduleUpdateOnFiber() → Scheduler
4. performWorkOnRoot() → Work Loop
5. beginWork() → Component Processing
6. completeWork() → DOM Creation
7. commitRoot() → DOM Updates
```

### 2. Key Breakpoints for Debugging

#### A. Root Creation
```javascript
// packages/react-dom/src/client/ReactDOM.js
function createRoot(container, options) {
  // Set breakpoint here to see root creation
  const root = createFiberRoot(container, options);
  return root;
}
```

#### B. Update Scheduling
```javascript
// packages/react-reconciler/src/ReactFiberReconciler.js
function updateContainer(element, container, parentComponent, callback) {
  // Set breakpoint here to see update scheduling
  const lane = requestUpdateLane(current);
  updateContainerImpl(current, lane, element, container, parentComponent, callback);
}
```

#### C. Work Loop
```javascript
// packages/react-reconciler/src/ReactFiberWorkLoop.js
function performWorkOnRoot(root, lanes) {
  // Set breakpoint here to see work loop execution
  const exitStatus = renderRootSync(root, lanes);
}
```

#### D. Component Processing
```javascript
// packages/react-reconciler/src/ReactFiberBeginWork.js
function beginWork(current, workInProgress, renderLanes) {
  // Set breakpoint here to see component processing
  switch (workInProgress.tag) {
    case FunctionComponent:
      return updateFunctionComponent(current, workInProgress, Component, resolvedProps, renderLanes);
  }
}
```

#### E. DOM Creation
```javascript
// packages/react-reconciler/src/ReactFiberCompleteWork.js
function completeWork(current, workInProgress) {
  // Set breakpoint here to see DOM creation
  switch (workInProgress.tag) {
    case HostComponent:
      return completeWorkHostComponent(current, workInProgress);
  }
}
```

### 3. Debugging Tools

#### A. React DevTools
```javascript
// Enable DevTools integration
if (__DEV__) {
  global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    onCommitFiberRoot: (root) => {
      console.log('Root committed:', root);
    },
    onCommitFiberUnmount: (fiber) => {
      console.log('Fiber unmounted:', fiber);
    }
  };
}
```

#### B. Performance Profiling
```javascript
// Profile render performance
const startTime = performance.now();
root.render(<App />);
const endTime = performance.now();
console.log(`Render took ${endTime - startTime}ms`);
```

#### C. Fiber Tree Inspection
```javascript
// Inspect fiber tree structure
function inspectFiber(fiber) {
  console.log('Fiber:', {
    tag: fiber.tag,
    type: fiber.type,
    key: fiber.key,
    stateNode: fiber.stateNode,
    memoizedProps: fiber.memoizedProps,
    memoizedState: fiber.memoizedState
  });
  
  if (fiber.child) {
    inspectFiber(fiber.child);
  }
  if (fiber.sibling) {
    inspectFiber(fiber.sibling);
  }
}
```

### 4. Browser-Specific Debugging

#### A. Real DOM Inspection
```javascript
// Inspect real DOM changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    console.log('DOM mutation:', mutation);
  });
});

observer.observe(container, {
  childList: true,
  subtree: true,
  attributes: true
});
```

#### B. Browser Performance API
```javascript
// Measure browser performance
performance.mark('render-start');
root.render(<App />);
performance.mark('render-end');
performance.measure('render', 'render-start', 'render-end');
```

#### C. Real Event Handling
```javascript
// Debug real event handling
button.addEventListener('click', (event) => {
  console.log('Real click event:', event);
  // Set breakpoint here to see event flow
});
```

## Debugging Configuration

### 1. VS Code Launch Configuration

```json
{
  "name": "Debug React Render Process",
  "type": "node",
  "request": "launch",
  "runtimeExecutable": "yarn",
  "runtimeArgs": [
    "test",
    "--watch",
    "--inspect-brk",
    "ReactRenderDebug-test"
  ],
  "env": {
    "NODE_ENV": "development",
    "RELEASE_CHANNEL": "experimental"
  }
}
```

### 2. Browser Debugging

For real browser debugging:

1. **Use React DevTools**: Install browser extension
2. **Enable Source Maps**: Build with source maps enabled
3. **Use Browser DevTools**: Set breakpoints in React source
4. **Monitor Performance**: Use Performance tab in DevTools

### 3. Test vs Browser Differences

| Aspect | Test Environment | Browser Environment |
|--------|------------------|-------------------|
| DOM | JSDOM (simulated) | Real browser DOM |
| Timing | Mock scheduler | Real scheduler |
| Events | Simulated | Real browser events |
| Performance | Controlled | Real browser performance |
| Debugging | Node.js debugger | Browser DevTools |

## Key Concepts to Debug

### 1. Fiber Tree Structure
- **Fiber**: Work unit in React
- **Alternate**: Work-in-progress fiber
- **Child/Sibling**: Tree relationships
- **State Node**: Host instance (DOM element)

### 2. Render Phases
- **Render Phase**: Create work-in-progress tree
- **Commit Phase**: Apply changes to DOM
- **Layout Phase**: Measure and layout
- **Passive Effects**: Run effects

### 3. Priority System
- **Lanes**: Priority levels for updates
- **Scheduler**: Time slicing and yielding
- **Concurrent Features**: Interruptible rendering

## Debugging Tips

1. **Start with Simple Components**: Debug basic renders first
2. **Use Console Logs**: Add strategic console.log statements
3. **Inspect Fiber Tree**: Understand the data structure
4. **Monitor DOM Changes**: Watch real DOM mutations
5. **Profile Performance**: Use browser performance tools
6. **Compare Test vs Browser**: Understand the differences

## Common Debugging Scenarios

### 1. Component Not Rendering
- Check if component is in fiber tree
- Verify props and state
- Look for errors in render phase

### 2. State Updates Not Reflecting
- Check if update was scheduled
- Verify lane priority
- Look for batching issues

### 3. Effects Not Running
- Check if component committed
- Verify effect dependencies
- Look for cleanup issues

### 4. Performance Issues
- Profile render time
- Check for unnecessary re-renders
- Look for expensive computations

This debugging approach will help you understand how React works in the real browser environment, which is different from the test environment but follows the same core principles. 