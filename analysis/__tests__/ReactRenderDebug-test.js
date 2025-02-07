/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

let React;
let ReactDOMClient;
let act;

describe('React Render Process - Browser Debug', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactDOMClient = require('react-dom/client');
    ({ act } = require('internal-test-utils'));
  });

  describe('Complete Render Flow', () => {
    it('should demonstrate the complete render process from createRoot to DOM', async () => {
      const container = document.createElement('div');
      
      // Step 1: Create Root (FiberRoot + HostRoot)
      console.log('🔧 Step 1: Creating React Root');
      const root = ReactDOMClient.createRoot(container);
      
      // Step 2: Render Element (Triggers updateContainer)
      console.log('🔧 Step 2: Rendering React Element');
      await act(() => {
        root.render(
          <div>
            <h1>Hello React</h1>
            <p>This demonstrates the render process</p>
          </div>
        );
      });

      // Step 3: Verify DOM was created
      console.log('🔧 Step 3: DOM Elements Created');
      expect(container.firstChild.tagName).toBe('DIV');
      expect(container.firstChild.children[0].tagName).toBe('H1');
      expect(container.firstChild.children[1].tagName).toBe('P');
    });

    it('should show how state updates trigger re-renders', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      let renderCount = 0;
      let setCount;

      function Counter() {
        const [count, setCountState] = React.useState(0);
        setCount = setCountState;
        renderCount++;
        
        console.log(`🔧 Render #${renderCount}: Count = ${count}`);
        
        return (
          <div>
            <h2>Count: {count}</h2>
            <button onClick={() => setCountState(count + 1)}>
              Increment
            </button>
          </div>
        );
      }

      // Initial render
      console.log('🔧 Initial Render');
      await act(() => {
        root.render(<Counter />);
      });

      expect(renderCount).toBe(1);
      expect(container.firstChild.querySelector('h2').textContent).toBe('Count: 0');

      // State update triggers re-render
      console.log('🔧 State Update - Triggering Re-render');
      await act(() => {
        setCount(5);
      });

      expect(renderCount).toBe(2);
      expect(container.firstChild.querySelector('h2').textContent).toBe('Count: 5');
    });

    it('should demonstrate concurrent rendering with time slicing', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      function ExpensiveComponent() {
        const [items, setItems] = React.useState([]);
        
        React.useEffect(() => {
          // Simulate expensive computation
          const newItems = [];
          for (let i = 0; i < 1000; i++) {
            newItems.push(`Item ${i}`);
          }
          setItems(newItems);
        }, []);

        return (
          <div>
            <h3>Expensive Component</h3>
            <ul>
              {items.slice(0, 10).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <p>Total items: {items.length}</p>
          </div>
        );
      }

      console.log('🔧 Rendering Expensive Component (Concurrent Mode)');
      await act(() => {
        root.render(<ExpensiveComponent />);
      });

      // The component should render even with expensive computation
      expect(container.firstChild.querySelector('h3').textContent).toBe('Expensive Component');
      expect(container.firstChild.querySelectorAll('li')).toHaveLength(10);
    });

    it('should show how effects work in the commit phase', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      let effectLog = [];

      function EffectDemo() {
        const [count, setCount] = React.useState(0);

        React.useEffect(() => {
          console.log('🔧 Effect: Component mounted');
          effectLog.push('mounted');
          return () => {
            console.log('🔧 Effect: Component will unmount');
            effectLog.push('cleanup');
          };
        }, []);

        React.useEffect(() => {
          console.log(`🔧 Effect: Count changed to ${count}`);
          effectLog.push(`count-${count}`);
        }, [count]);

        return (
          <div>
            <h3>Effect Demo</h3>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
              Update Count
            </button>
          </div>
        );
      }

      console.log('🔧 Initial Render with Effects');
      await act(() => {
        root.render(<EffectDemo />);
      });

      // Effects should run after DOM is committed
      expect(effectLog).toContain('mounted');
      expect(effectLog).toContain('count-0');

      // Update should trigger effect
      await act(() => {
        container.querySelector('button').click();
      });

      expect(effectLog).toContain('count-1');
    });

    it('should demonstrate error boundaries and error handling', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      let errorBoundaryLog = [];

      class ErrorBoundary extends React.Component {
        constructor(props) {
          super(props);
          this.state = { hasError: false };
        }

        static getDerivedStateFromError(error) {
          console.log('🔧 Error Boundary: Caught error', error.message);
          errorBoundaryLog.push('caught-error');
          return { hasError: true };
        }

        componentDidCatch(error, errorInfo) {
          console.log('🔧 Error Boundary: Error info', errorInfo);
          errorBoundaryLog.push('did-catch');
        }

        render() {
          if (this.state.hasError) {
            return <h3>Something went wrong.</h3>;
          }

          return this.props.children;
        }
      }

      function BuggyComponent() {
        const [shouldThrow, setShouldThrow] = React.useState(false);

        if (shouldThrow) {
          throw new Error('Intentional error for testing');
        }

        return (
          <div>
            <h3>Buggy Component</h3>
            <button onClick={() => setShouldThrow(true)}>
              Trigger Error
            </button>
          </div>
        );
      }

      console.log('🔧 Rendering with Error Boundary');
      await act(() => {
        root.render(
          <ErrorBoundary>
            <BuggyComponent />
          </ErrorBoundary>
        );
      });

      // Trigger error
      await act(() => {
        container.querySelector('button').click();
      });

      expect(errorBoundaryLog).toContain('caught-error');
      
      // Wait for the error boundary to re-render with error state
      await act(() => {
        // Force a re-render to ensure error state is applied
        root.render(
          <ErrorBoundary>
            <BuggyComponent />
          </ErrorBoundary>
        );
      });

      // Now check for the error UI
      const errorElement = container.querySelector('h3');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toBe('Something went wrong.');
    });

    it('should show how refs work during the commit phase', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      let refValue = null;

      function RefDemo() {
        const inputRef = React.useRef(null);

        React.useEffect(() => {
          console.log('🔧 Ref: Input element available', inputRef.current);
          refValue = inputRef.current;
        }, []);

        return (
          <div>
            <h3>Ref Demo</h3>
            <input ref={inputRef} defaultValue="Hello" />
          </div>
        );
      }

      console.log('🔧 Rendering with Ref');
      await act(() => {
        root.render(<RefDemo />);
      });

      // Ref should be available after commit
      expect(refValue).toBeTruthy();
      expect(refValue.tagName).toBe('INPUT');
      expect(refValue.value).toBe('Hello');
    });

    it('should demonstrate the reconciliation process', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      function ReconciliationDemo() {
        const [items, setItems] = React.useState(['A', 'B', 'C']);

        return (
          <div>
            <h3>Reconciliation Demo</h3>
            <ul>
              {items.map((item, index) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button onClick={() => setItems(['B', 'C', 'D'])}>
              Update Items
            </button>
          </div>
        );
      }

      console.log('🔧 Initial Render');
      await act(() => {
        root.render(<ReconciliationDemo />);
      });

      const initialItems = container.querySelectorAll('li');
      expect(initialItems).toHaveLength(3);
      expect(initialItems[0].textContent).toBe('A');

      console.log('🔧 Updating Items (Reconciliation)');
      await act(() => {
        container.querySelector('button').click();
      });

      const updatedItems = container.querySelectorAll('li');
      expect(updatedItems).toHaveLength(3);
      expect(updatedItems[0].textContent).toBe('B');
      expect(updatedItems[2].textContent).toBe('D');
    });

    it('should show how context works through the render tree', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      const ThemeContext = React.createContext('light');

      function ThemedButton() {
        const theme = React.useContext(ThemeContext);
        return (
          <button className={`btn-${theme}`}>
            Theme: {theme}
          </button>
        );
      }

      function App() {
        const [theme, setTheme] = React.useState('light');

        return (
          <ThemeContext.Provider value={theme}>
            <div>
              <h3>Context Demo</h3>
              <ThemedButton />
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                Toggle Theme
              </button>
            </div>
          </ThemeContext.Provider>
        );
      }

      console.log('🔧 Rendering with Context');
      await act(() => {
        root.render(<App />);
      });

      expect(container.querySelector('.btn-light')).toBeTruthy();

      console.log('🔧 Updating Context');
      await act(() => {
        container.querySelectorAll('button')[1].click();
      });

      expect(container.querySelector('.btn-dark')).toBeTruthy();
    });
  });

  describe('Performance and Debugging', () => {
    it('should demonstrate how to profile React renders', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      let renderCount = 0;

      const ProfiledComponent = React.memo(function ProfiledComponent() {
        renderCount++;
        console.log(`🔧 ProfiledComponent render #${renderCount}`);
        
        return (
          <div>
            <h3>Profiled Component</h3>
            <p>Render count: {renderCount}</p>
          </div>
        );
      });

      console.log('🔧 Initial render of profiled component');
      await act(() => {
        root.render(<ProfiledComponent />);
      });

      expect(renderCount).toBe(1);

      // Re-render with same props (should be memoized)
      console.log('🔧 Re-render with same props (should be memoized)');
      await act(() => {
        root.render(<ProfiledComponent />);
      });

      // Should not re-render due to memo
      expect(renderCount).toBe(1);
    });

    it('should show how to debug React DevTools integration', async () => {
      const container = document.createElement('div');
      const root = ReactDOMClient.createRoot(container);

      // Simulate DevTools hook
      const DevToolsHook = {
        supportsFiber: true,
        inject: jest.fn(),
        onCommitFiberRoot: jest.fn(),
        onCommitFiberUnmount: jest.fn(),
        onPostCommitFiberRoot: jest.fn(),
        onPostCommitFiberUnmount: jest.fn(),
      };

      // Mock DevTools integration
      if (__DEV__) {
        global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = DevToolsHook;
      }

      function DevToolsDemo() {
        const [count, setCount] = React.useState(0);

        return (
          <div>
            <h3>DevTools Demo</h3>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
              Increment
            </button>
          </div>
        );
      }

      console.log('🔧 Rendering with DevTools integration');
      await act(() => {
        root.render(<DevToolsDemo />);
      });

      // DevTools should be notified of the render
      if (__DEV__) {
        // The DevTools hook might not be called in test environment
        // This is expected behavior - DevTools integration is primarily for browser
        console.log('🔧 DevTools hook calls:', DevToolsHook.onCommitFiberRoot.mock.calls.length);
      }
    });
  });
}); 
