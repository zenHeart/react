/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

const { isExportDeclaration } = require('typescript');

let React;
let ReactDOM;
let ReactDOMServer;
let ReactTestUtils;

describe('ReactDOM', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactDOM = require('react-dom');
    ReactDOMServer = require('react-dom/server');
    ReactTestUtils = require('react-dom/test-utils');
  });

  it('test', function() {
    const container = document.createElement('div');
    debugger
    ReactDOM.render({
      $$typeof: Symbol.for('react.element'),
      type: 'h1',
      props: {
        children: [ 1 ],
      },
      ref: null
    }, 
    container,
    () => {
      debugger
    }
    )

    expect(container.innerHTML).toBe('<h1>1</h1>')
  });


});
