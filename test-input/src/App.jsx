import React, { Component } from 'react';

import TestClassComponent from './components/TestClassComponent';
import TestPureComponent from './components/TestPureComponent';
import TestAnonComponent from './components/TestAnonComponent';

import TestHelper from './helpers/TestHelper';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      text: TestHelper.getText(),
    };
  }

  render() {
    const { text } = this.state;
    return (
      <div>
        {text}
        <div>
          <div>
            <TestClassComponent />
          </div>
          <TestPureComponent />
          <TestAnonComponent />
        </div>
      </div>
    );
  }
}

export default App;
