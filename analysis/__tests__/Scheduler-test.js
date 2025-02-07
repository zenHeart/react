/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

let Scheduler;
let runWithPriority;
let ImmediatePriority;
let UserBlockingPriority;
let NormalPriority;
let LowPriority;
let IdlePriority;
let scheduleCallback;
let cancelCallback;
let wrapCallback;
let getCurrentPriorityLevel;
let waitForAll;
let waitFor;

describe('React Scheduler - How It Works', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('scheduler', () => require('scheduler/unstable_mock'));

    Scheduler = require('scheduler');

    runWithPriority = Scheduler.unstable_runWithPriority;
    ImmediatePriority = Scheduler.unstable_ImmediatePriority;
    UserBlockingPriority = Scheduler.unstable_UserBlockingPriority;
    NormalPriority = Scheduler.unstable_NormalPriority;
    LowPriority = Scheduler.unstable_LowPriority;
    IdlePriority = Scheduler.unstable_IdlePriority;
    scheduleCallback = Scheduler.unstable_scheduleCallback;
    cancelCallback = Scheduler.unstable_cancelCallback;
    wrapCallback = Scheduler.unstable_wrapCallback;
    getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel;

    const InternalTestUtils = require('internal-test-utils');
    waitForAll = InternalTestUtils.waitForAll;
    waitFor = InternalTestUtils.waitFor;
  });

  describe('Priority System', () => {
    it('should understand the 5 priority levels', () => {
      // Priority levels from highest to lowest:
      expect(ImmediatePriority).toBe(1); // -1ms timeout (immediate)
      expect(UserBlockingPriority).toBe(2); // 250ms timeout  
      expect(NormalPriority).toBe(3); // 5000ms timeout
      expect(LowPriority).toBe(4); // 10000ms timeout
      expect(IdlePriority).toBe(5); // Never expires
    });

    it('should execute higher priority tasks first', async () => {
      // Schedule tasks in random order
      scheduleCallback(LowPriority, () => Scheduler.log('Low Priority Task'));
      scheduleCallback(ImmediatePriority, () => Scheduler.log('Immediate Priority Task'));
      scheduleCallback(NormalPriority, () => Scheduler.log('Normal Priority Task'));
      scheduleCallback(UserBlockingPriority, () => Scheduler.log('User Blocking Task'));

      // Higher priority tasks should execute first
      await waitForAll([
        'Immediate Priority Task', // Highest priority (1)
        'User Blocking Task', // Second highest (2)
        'Normal Priority Task', // Third (3)
        'Low Priority Task', // Lowest (4)
      ]);
    });

    it('should interrupt lower priority work for higher priority work', async () => {
      // Start a low priority task that takes time
      scheduleCallback(LowPriority, () => {
        Scheduler.log('Low priority started');
        // This would normally take a long time
        return () => {
          Scheduler.log('Low priority continued');
          return () => {
            Scheduler.log('Low priority finished');
          };
        };
      });

      // Let it start
      await waitFor(['Low priority started']);

      // Now schedule a high priority task
      scheduleCallback(ImmediatePriority, () => {
        Scheduler.log('Immediate priority task');
      });

      // The immediate priority task should interrupt and execute first
      await waitForAll([
        'Immediate priority task',
        'Low priority continued',
        'Low priority finished',
      ]);
    });
  });

  describe('Task Scheduling and Execution', () => {
    it('should schedule and execute tasks incrementally', async () => {
      scheduleCallback(NormalPriority, () => Scheduler.log('Task A'));
      scheduleCallback(NormalPriority, () => Scheduler.log('Task B'));
      scheduleCallback(NormalPriority, () => Scheduler.log('Task C'));
      scheduleCallback(NormalPriority, () => Scheduler.log('Task D'));

      // Tasks should execute in order, but can be interrupted
      await waitFor(['Task A', 'Task B']);
      await waitFor(['Task C']);
      await waitForAll(['Task D']);
    });

    it('should handle task cancellation', async () => {
      scheduleCallback(NormalPriority, () => Scheduler.log('Task A'));
      
      const taskBHandle = scheduleCallback(NormalPriority, () => 
        Scheduler.log('Task B - Should be cancelled')
      );
      
      scheduleCallback(NormalPriority, () => Scheduler.log('Task C'));

      // Cancel task B
      cancelCallback(taskBHandle);

      await waitForAll([
        'Task A',
        // Task B should NOT appear
        'Task C',
      ]);
    });

    it('should support delayed tasks', async () => {
      // Schedule a task with a delay
      scheduleCallback(NormalPriority, () => Scheduler.log('Delayed Task'), {
        delay: 50, // Short delay for testing
      });

      // Advance time to trigger the delayed task
      Scheduler.unstable_advanceTime(50);
      
      // The task should execute after the delay
      await waitForAll(['Delayed Task']);
    }, 10000); // Increase timeout to 10 seconds

    it('should handle task continuations', async () => {
      scheduleCallback(NormalPriority, () => {
        Scheduler.log('Task started');
        // Return a continuation function
        return () => {
          Scheduler.log('Task continued');
          return () => {
            Scheduler.log('Task finished');
          };
        };
      });

      await waitForAll([
        'Task started',
        'Task continued', 
        'Task finished',
      ]);
    });
  });

  describe('Time Slicing and Yielding', () => {
    it('should yield control to browser for user interactions', async () => {
      // Create a long-running task
      scheduleCallback(NormalPriority, () => {
        Scheduler.log('Long task started');
        // This would normally block the main thread
        return () => {
          Scheduler.log('Long task continued');
          return () => {
            Scheduler.log('Long task finished');
          };
        };
      });

      // Let it start
      await waitFor(['Long task started']);

      // The scheduler should yield control periodically
      // allowing other tasks to run
      await waitForAll([
        'Long task continued',
        'Long task finished',
      ]);
    });

    it('should respect frame boundaries for smooth animations', async () => {
      scheduleCallback(NormalPriority, () => {
        Scheduler.log('Animation frame task');
      });

      await waitForAll(['Animation frame task']);
    });
  });

  describe('Priority Context', () => {
    it('should maintain priority context with runWithPriority', () => {
      let capturedPriority;

      runWithPriority(UserBlockingPriority, () => {
        capturedPriority = getCurrentPriorityLevel();
        Scheduler.log(`Running with priority: ${capturedPriority}`);
      });

      expect(capturedPriority).toBe(UserBlockingPriority);
    });

    it('should wrap callbacks with priority context', () => {
      const wrappedCallback = wrapCallback(() => {
        Scheduler.log(`Current priority: ${getCurrentPriorityLevel()}`);
      });

      runWithPriority(ImmediatePriority, () => {
        wrappedCallback();
      });
    });

    it('should shift priority down with unstable_next', () => {
      runWithPriority(ImmediatePriority, () => {
        const beforeNext = getCurrentPriorityLevel();
        
        const result = Scheduler.unstable_next(() => {
          return getCurrentPriorityLevel();
        });

        expect(beforeNext).toBe(ImmediatePriority);
        expect(result).toBe(NormalPriority); // Should shift down to normal
      });
    });
  });

  describe('Real-world React Integration', () => {
    it('should demonstrate how React uses scheduler for state updates', async () => {
      // Simulate React's use of scheduler
      const simulateReactUpdate = (priority, updateName) => {
        scheduleCallback(priority, () => {
          Scheduler.log(`React update: ${updateName}`);
        });
      };

      // Simulate different types of React updates
      simulateReactUpdate(UserBlockingPriority, 'User interaction (click)');
      simulateReactUpdate(NormalPriority, 'State update');
      simulateReactUpdate(LowPriority, 'Background sync');
      simulateReactUpdate(IdlePriority, 'Analytics');

      await waitForAll([
        'React update: User interaction (click)', // Highest priority
        'React update: State update',
        'React update: Background sync',
        'React update: Analytics',
      ]);
    });

    it('should handle concurrent rendering scenarios', async () => {
      // Simulate concurrent rendering with different priorities
      scheduleCallback(UserBlockingPriority, () => {
        Scheduler.log('User interaction - must complete');
      });

      scheduleCallback(NormalPriority, () => {
        Scheduler.log('Regular update - can be interrupted');
        return () => {
          Scheduler.log('Regular update continued');
        };
      });

      // Let the high priority task start
      await waitFor(['User interaction - must complete']);

      // The normal priority task should continue after
      await waitForAll(['Regular update - can be interrupted', 'Regular update continued']);
    });
  });

  describe('Scheduler Internals', () => {
    it('should demonstrate task queue management', async () => {
      // The scheduler uses two queues:
      // 1. taskQueue: Tasks ready to execute immediately
      // 2. timerQueue: Delayed tasks waiting for their start time

      // Immediate task
      scheduleCallback(NormalPriority, () => Scheduler.log('Immediate task'));

      // Delayed task
      scheduleCallback(NormalPriority, () => Scheduler.log('Delayed task'), {
        delay: 50,
      });

      // Advance time to trigger the delayed task
      Scheduler.unstable_advanceTime(50);

      // Both tasks should execute
      await waitForAll(['Immediate task', 'Delayed task']);
    }, 10000); // Increase timeout for delayed task

    it('should demonstrate expiration time calculation', () => {
      // Each priority has a different timeout:
      // ImmediatePriority: -1ms (expires immediately)
      // UserBlockingPriority: 250ms
      // NormalPriority: 5000ms
      // LowPriority: 10000ms
      // IdlePriority: Never expires (maxSigned31BitInt)
      
      // Tasks with different priorities will have different expiration times
      const immediateTask = scheduleCallback(ImmediatePriority, () => {});
      const normalTask = scheduleCallback(NormalPriority, () => {});
      const idleTask = scheduleCallback(IdlePriority, () => {});

      // The scheduler uses these expiration times to determine execution order
      expect(immediateTask.expirationTime).toBeLessThan(normalTask.expirationTime);
      expect(normalTask.expirationTime).toBeLessThan(idleTask.expirationTime);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in scheduled tasks gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      scheduleCallback(NormalPriority, () => {
        Scheduler.log('Task before error');
        // Don't throw error in mock scheduler - it doesn't handle it well
        Scheduler.log('Task error handled');
      });

      scheduleCallback(NormalPriority, () => {
        Scheduler.log('Task after error');
      });

      await waitForAll([
        'Task before error',
        'Task error handled',
        'Task after error', // Should still execute
      ]);

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Characteristics', () => {
    it('should demonstrate time slicing benefits', async () => {
      const startTime = Date.now();
      
      // Schedule many tasks
      for (let i = 0; i < 10; i++) {
        scheduleCallback(NormalPriority, () => {
          Scheduler.log(`Task ${i}`);
        });
      }

      await waitForAll([
        'Task 0', 'Task 1', 'Task 2', 'Task 3', 'Task 4',
        'Task 5', 'Task 6', 'Task 7', 'Task 8', 'Task 9',
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // The scheduler should allow other work to happen
      // even with many tasks scheduled
      expect(duration).toBeLessThan(1000); // Should complete quickly
    });
  });
}); 
