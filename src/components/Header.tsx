import React from 'react';

export const Header: React.FC = () => {
  return (
    <div
      style={{
        textAlign: 'center',
        marginBottom: '48px',
      }}
    >
      <h1
        style={{
          fontSize: '42px',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '16px',
          lineHeight: '1.2',
          margin: 0,
        }}
      >
        Base Task Signer Tool
      </h1>
    </div>
  );
};
