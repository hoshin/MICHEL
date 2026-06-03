import { Routes, Route } from "react-router-dom";
import ConfigurationCenter from "./ConfigurationCenter.jsx";
import GameScene from "./GameScene.jsx";
import "./ConfigurationCenter.css";
import ScoreScene from "./ScoreScene.jsx";
import SoloScoreScene from "./SoloScoreScene.jsx";
import TeamScore from "./TeamScore.jsx";
import CurrentMap from "./CurrentMap.jsx";
import TeamBan from "./TeamBan.jsx";
import TournamentLogo from "./TournamentLogo.jsx";

function App() {
  return (
    <Routes>
      <Route path="/configuration-center" element={<ConfigurationCenter />} />
      <Route path="/game-scene" element={<GameScene />} />
      <Route path="/score-scene" element={<ScoreScene />} />
      <Route path="/team-1-score" element={<TeamScore team={1} />} />
      <Route path="/team-2-score" element={<TeamScore team={2} />} />
      <Route path="/current-map" element={<CurrentMap />} />
      <Route path="/team-1-ban" element={<TeamBan team={1} />} />
      <Route path="/team-2-ban" element={<TeamBan team={2} />} />
      <Route path="/solo-score-scene" element={<SoloScoreScene />} />
      <Route path="/tournament-logo" element={<TournamentLogo />} />
      {/*<Route path="/team-1-ban-input" element={<TeamBanInput team={1} handler={noop}/>}></Route>*/}
      {/*<Route path="/team-2-ban-input" element={<TeamBanInput team={2} handler={noop}/>}></Route>*/}
      <Route path="*" element={<ConfigurationCenter />} />
    </Routes>
  );
}

export default App;
