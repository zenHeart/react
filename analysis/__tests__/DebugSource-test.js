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
let ReactDOM;
let findDOMNode;
let ReactDOMClient;
let ReactDOMServer;
let assertConsoleErrorDev;

let act;

describe('ReactDOM', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactDOM = require('react-dom');
    ReactDOMClient = require('react-dom/client');
    ReactDOMServer = require('react-dom/server');
    const { propertyMapConvert } = require('./utils');
    globalThis.debugTools = propertyMapConvert;
    findDOMNode =
      ReactDOM.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
        .findDOMNode;

    ({ act, assertConsoleErrorDev } = require('internal-test-utils'));
  });


  it('should allow children to be passed as an argument', async () => {

    const container = document.createElement('div');
    const root = ReactDOMClient.createRoot(container);
    function Counter() {
      const [count, setCount] = React.useState(0);

      const add = () => {
        setCount(count + 1);
      };
      return <button onClick={add}>Count: {count}</button>;
    }

    class App extends React.Component {
      state = { time: new Date().toLocaleTimeString() };

      render() {

        return (
          <div>
            <Counter /> {this.state.time}
          </div>
        );
      }
    }
    await act(() => {
      root.render(<App />);
    });

    const argNode = container.firstChild;
    expect(argNode.innerHTML).toContain('<button>Count: 0</button>');
  }, 10 * 3600e3);
});
