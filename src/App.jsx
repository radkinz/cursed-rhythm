import React, { useState } from "react";
import LandingPage from "./LandingPage";
import GameCanvas from "./GameCanvas";

export default function App() {
  const [screen, setScreen] = useState("landing");

  return screen === "landing" ? (
    <LandingPage onStart={() => setScreen("game")} />
  ) : (
    <GameCanvas onExit={() => setScreen("landing")} />
  );
}
