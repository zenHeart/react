---
description: "React debugging and execution tracing patterns"
globs: analysis/*.md
---

# React Debugging and Tracing Patterns

## Key Breakpoint Locations

When debugging React, focus on these critical functions:

### Rendering Pipeline
- [performUnitOfWork](../packages/react-reconciler/src/ReactFiberWorkLoop.js#L2790) - Core work loop
- [beginWork](../packages/react-reconciler/src/ReactFiberBeginWork.js#L4109) - Component processing start
- [completeWork](../packages/react-reconciler/src/ReactFiberCompleteWork.js#L1064) - Component processing end
- [commitRoot](../packages/react-reconciler/src/ReactFiberWorkLoop.js#L3202) - DOM mutations

### Hook System
- [renderWithHooks](../packages/react-reconciler/src/ReactFiberHooks.js#L485) - Hook execution context
- [mountState](../packages/react-reconciler/src/ReactFiberHooks.js#L1920) - useState initialization
- [updateState](../packages/react-reconciler/src/ReactFiberHooks.js#L1926) - useState updates
- [dispatchSetState](../packages/react-reconciler/src/ReactFiberHooks.js#L3580) - State update trigger

### Scheduling
- [scheduleUpdateOnFiber](../packages/react-reconciler/src/ReactFiberWorkLoop.js#L885) - Update scheduling entry
- [ensureRootIsScheduled](../packages/react-reconciler/src/ReactFiberRootScheduler.js#L125) - Priority-based scheduling

## Tracing Strategies

1. **Follow the data flow**: Props → State → Virtual DOM → Real DOM
2. **Track fiber relationships**: parent → child → sibling navigation
3. **Monitor update queues**: Pending updates and priority lanes
4. **Observe double buffering**: current ↔ workInProgress tree swapping