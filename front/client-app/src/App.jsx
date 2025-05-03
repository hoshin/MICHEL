import { Routes, Route } from "react-router-dom";
import ConfigurationCenter from "./ConfigurationCenter.jsx";
import GameScene from "./AFO/GameScene.jsx";
import './ConfigurationCenter.css'
import ScoreScene from "./AFO/ScoreScene.jsx";
import CastersScene from "./Dragons/CastersScene.jsx";

function App() {
    return (<Routes>
        <Route path="/configuration-center" element={<ConfigurationCenter />} />
        <Route path="/game-scene" element={<GameScene />} />
        <Route path="/score-scene" element={<ScoreScene />} />
        <Route path="/casters-scene" element={<CastersScene />} />
    </Routes>)
}

export default App
