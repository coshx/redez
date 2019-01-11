import React from 'react';
import PropTypes from 'prop-types';

const TestAnonComponent = (props) => {
  const { text } = props;
  return (
    <div>
      {text}
    </div>
  );
};

TestAnonComponent.propTypes = {
  text: PropTypes.string,
};

TestAnonComponent.defaultProps = {
  text: 'Test',
};

export default TestAnonComponent;
