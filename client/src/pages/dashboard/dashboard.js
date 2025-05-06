import React from 'react';

const Placeholder = ({ title }) => {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{title} Page</h1>
      <p style={styles.text}>This page is under construction. Please check back later.</p>
    </div>
  );
};

const styles = {
  container: {
    padding: '80px 20px',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif',
    color: '#555'
  },
  title: {
    fontSize: '36px',
    marginBottom: '20px',
  },
  text: {
    fontSize: '18px',
  }
};

export default Placeholder;