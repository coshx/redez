import React, { Component } from 'react';

class TestClassComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {
      text: 'This is a class',
    };
  }

  render() {
    const { text } = this.state;
    return (
      <div>
        Test
        {text}
      </div>
    );
  }
}

export default TestClassComponent;
