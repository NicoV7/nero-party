import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import JoinParty from './pages/JoinParty';
import PartyRoom from './pages/PartyRoom';
import WinnerReveal from './pages/WinnerReveal';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join/:code" element={<JoinParty />} />
        <Route path="/party/:code" element={<PartyRoom />} />
        <Route path="/party/:code/results" element={<WinnerReveal />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
