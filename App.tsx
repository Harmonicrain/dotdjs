import React, { useState } from 'react';
import GameScene from './ui/GameScene';

const App: React.FC = () => {
  const [gameKey, setGameKey] = useState(0);

  const handleReset = () => {
    setGameKey(prev => prev + 1);
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      <GameScene key={gameKey} onGameReset={handleReset} />
    </div>
  );
};

export default App;