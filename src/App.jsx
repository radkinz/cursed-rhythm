import React, { useState } from "react";
import { HashRouter, Routes, Route, useParams, Navigate } from "react-router-dom";

import LandingPage from "./LandingPage";
import GameCanvas from "./GameCanvas";
import ScorePage from "./ScorePage";
import BackgroundVideo from "./BackgroundVideo";

import { getVariant } from "./variants";

function AppShell() {
  const { variantId } = useParams();
  const variant = getVariant(variantId || "default");

  const [screen, setScreen] = useState("landing");
  const [results, setResults] = useState(null);

  return (
    <>
      {screen === "game" && (
        <BackgroundVideo videoSrc={variant.bgVideo} />
      )}

      {screen === "landing" && (
        <LandingPage
          variant={variant}
          onStart={() => setScreen("game")}
        />
      )}

      {screen === "game" && (
        <GameCanvas
          variant={variant}
          onExit={() => setScreen("landing")}
          onGameOver={(r) => {
            setResults(r);
            setScreen("score");
          }}
        />
      )}

      {screen === "score" && (
        <ScorePage
          variant={variant}
          results={results}
          onRetry={() => setScreen("game")}
          onBack={() => setScreen("landing")}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/:variantId" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
