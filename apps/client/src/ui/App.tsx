import { useAppStore } from '../state/store';
import { GameView } from './GameView';
import { MainMenu } from './MainMenu';

export function App() {
  const screen = useAppStore((s) => s.screen);
  const request = useAppStore((s) => s.request);
  return (
    <div className="app">
      {screen === 'menu' || !request ? <MainMenu /> : <GameView key={request.id} request={request} />}
      <div className="grain" aria-hidden />
    </div>
  );
}
