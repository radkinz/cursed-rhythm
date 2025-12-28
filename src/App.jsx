import React, { useState } from "react";
import LandingPage from "./LandingPage";
import GameCanvas from "./GameCanvas";
import ScorePage from "./ScorePage";
import BackgroundVideo from "./BackgroundVideo";

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [results, setResults] = useState(null);

  return (
    <>
      {screen === "game" && <BackgroundVideo />}

      {screen === "landing" && (
        <LandingPage onStart={() => setScreen("game")} />
      )}

      {screen === "game" && (
        <GameCanvas
          onExit={() => setScreen("landing")}
          onGameOver={(r) => {
            setResults(r);
            setScreen("score");
          }}
        />
      )}

      {screen === "score" && (
        <ScorePage
          results={results}
          onRetry={() => setScreen("game")}
          onBack={() => setScreen("landing")}
        />
      )}
    </>
  );
}
