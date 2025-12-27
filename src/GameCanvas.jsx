import { useEffect, useRef } from "react";
import Phaser from "phaser";

class PlayScene extends Phaser.Scene {
  constructor() {
    super("play");
  }

  preload() {
    this.load.audio("song", "audio/song.mp3");
    this.load.json("chart", "charts/chart.json");

    this.load.image("arrowL", "sprites/arrow_left.png");
    this.load.image("arrowD", "sprites/arrow_down.png");
    this.load.image("arrowU", "sprites/arrow_up.png");
    this.load.image("arrowR", "sprites/arrow_right.png");
  }

  create() {
    // ---- Reset all runtime state (important for restarts/hot reloads) ----
    this.notes = [];
    this.chart = [];
    this.chartIndex = 0;

    this.score = 0;
    this.combo = 0;

    this.stageIndex = 0;
    this.stageActive = true;
    this.spawningEnabled = true;

    // ---- Geometry ----
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b10);

    const lanes = 4;
    const laneWidth = Math.min(160, Math.floor(width * 0.16));
    const gap = 10;
    const totalWidth = lanes * laneWidth + (lanes - 1) * gap;
    const left = (width - totalWidth) / 2;

    this.hitY = Math.floor(height * 0.82);
    this.spawnY = -60; // must match Python generator spawn_y

    this.lanesCenterX = left + totalWidth / 2;

    // ---- 6 stages for 231s ----
    this.stages = [
      {
        name: "Stage 1",
        start: 0,
        end: 35,
        params: { perfectS: 0.080, greatS: 0.140, goodS: 0.220 },
        message: "Stage 1: tutorial mode. Try not to trip.",
      },
      {
        name: "Stage 2",
        start: 35,
        end: 70,
        params: { perfectS: 0.070, greatS: 0.130, goodS: 0.200 },
        message: "Stage 2: okay, you can tap. Congrats.",
      },
      {
        name: "Stage 3",
        start: 70,
        end: 105,
        params: { perfectS: 0.060, greatS: 0.120, goodS: 0.180 },
        message: "Stage 3: keep it together.",
      },
      {
        name: "Stage 4",
        start: 105,
        end: 145,
        params: { perfectS: 0.055, greatS: 0.110, goodS: 0.170 },
        message: "Stage 4: now we’re cooking. (badly.)",
      },
      {
        name: "Stage 5",
        start: 145,
        end: 190,
        params: { perfectS: 0.050, greatS: 0.100, goodS: 0.160 },
        message: "Stage 5: focus. Or perish.",
      },
      {
        name: "Stage 6",
        start: 190,
        end: 231,
        params: { perfectS: 0.045, greatS: 0.090, goodS: 0.145 },
        message: "Stage 6: final. Don’t blink.",
      },
    ];

    this.applyStage(0);

    // ---- Popup (center screen) ----
    this.popup = this.add.container(width / 2, height / 2).setDepth(2000).setAlpha(0);

    const popupBg = this.add
      .rectangle(0, 0, 520, 140, 0x000000, 0.75)
      .setStrokeStyle(3, 0xffffff, 0.25);

    this.popupTitle = this.add
      .text(0, -30, "", {
        fontFamily: "system-ui",
        fontSize: "24px",
        fontStyle: "900",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.popupBody = this.add
      .text(0, 20, "", {
        fontFamily: "system-ui",
        fontSize: "16px",
        color: "#d6d6ff",
        wordWrap: { width: 480 },
      })
      .setOrigin(0.5);

    this.popup.add([popupBg, this.popupTitle, this.popupBody]);

    // Keep popup centered on resize (DON'T restart the scene)
    this.scale.on("resize", (gameSize) => {
      this.popup.setPosition(gameSize.width / 2, gameSize.height / 2);
    });

    // ---- Lanes ----
    this.laneRects = [];
    for (let i = 0; i < lanes; i++) {
      const x = left + i * (laneWidth + gap) + laneWidth / 2;
      const rect = this.add.rectangle(x, height / 2, laneWidth, height, 0x151526).setAlpha(0.95);
      this.laneRects.push(rect);
    }

    // Separators
    for (let i = 1; i < lanes; i++) {
      const sepX = left + i * (laneWidth + gap) - gap / 2;
      this.add.rectangle(sepX, height / 2, 2, height, 0x000000).setAlpha(0.25);
    }

    // Hit line
    this.add.rectangle(width / 2, this.hitY, totalWidth, 6, 0xffffff).setAlpha(0.6);

    // Key labels
    const keys = ["←", "↓", "↑", "→"];
    for (let i = 0; i < lanes; i++) {
      const x = left + i * (laneWidth + gap) + laneWidth / 2;
      this.add
        .text(x, this.hitY + 18, keys[i], {
          fontFamily: "system-ui",
          fontSize: "16px",
          color: "#d6d6ff",
        })
        .setOrigin(0.5, 0);
    }

    // ---- Per-lane judgement texts under hit line ----
    this.laneJudgeTexts = [];
    const judgeYOffset = 46;
    for (let i = 0; i < lanes; i++) {
      const x = this.laneRects[i].x;
      const y = this.hitY + judgeYOffset;
      const t = this.add
        .text(x, y, "", {
          fontFamily: "system-ui",
          fontSize: "20px",
          fontStyle: "900",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setDepth(1000);

      this.laneJudgeTexts.push(t);
    }

    // ---- Score UI ----
    this.scoreText = this.add
      .text(16, 16, "Score: 0\nCombo: 0", {
        fontFamily: "system-ui",
        fontSize: "16px",
        color: "#d6d6ff",
      })
      .setDepth(1500);

    // ---- Load chart ----
    const data = this.cache.json.get("chart");
    this.chart = Array.isArray(data) ? data : [];
    this.chartIndex = 0;

    // Quick sanity log (remove later)
    // console.log("chart[0]", this.chart?.[0]);

    // ---- Audio ----
    this.sound.pauseOnBlur = false;
    this.song = this.sound.add("song", { volume: 0.8 });

    // Start on Space
    this.input.keyboard.once("keydown-SPACE", () => {
      this.song.play();
    });

    // Arrow keys -> lanes
    const arrowKeys = this.input.keyboard.createCursorKeys();
    arrowKeys.left.on("down", () => this.tryHit(0));
    arrowKeys.down.on("down", () => this.tryHit(1));
    arrowKeys.up.on("down", () => this.tryHit(2));
    arrowKeys.right.on("down", () => this.tryHit(3));

    // Optional: show Stage 1 popup right away
    this.showStagePopup("Stage 1", this.stages[0].message, () => {});
  }

  applyStage(i) {
    const s = this.stages[i];
    this.currentStage = s;

    // time-based windows (stable across different speeds)
    this.perfectS = s.params.perfectS;
    this.greatS = s.params.greatS;
    this.goodS = s.params.goodS;
  }

  beginStageTransition() {
    this.stageActive = false;
    this.spawningEnabled = false;

    const nextIndex = this.stageIndex + 1;

    if (nextIndex >= this.stages.length) {
      this.showStagePopup("Finished", "You beat it. That’s unfortunate.", () => {});
      return;
    }

    const msg = this.stages[nextIndex].message;

    this.showStagePopup(`Stage ${nextIndex + 1}`, msg, () => {
      this.stageIndex = nextIndex;
      this.applyStage(this.stageIndex);

      this.stageActive = true;
      this.spawningEnabled = true;
    });
  }

  showStagePopup(title, message, onDone) {
    this.popupTitle.setText(title);
    this.popupBody.setText(message);

    this.popup.setAlpha(0);
    this.popup.setScale(0.95);

    this.tweens.killTweensOf(this.popup);

    this.tweens.add({
      targets: this.popup,
      alpha: 1,
      scale: 1.0,
      duration: 220,
      ease: "Quad.out",
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: this.popup,
            alpha: 0,
            scale: 0.98,
            duration: 220,
            ease: "Quad.in",
            onComplete: () => onDone?.(),
          });
        });
      },
    });
  }

  showJudgement(laneIndex, label) {
    const colors = {
      PERFECT: "#7df9ff",
      GREAT: "#5cff7d",
      GOOD: "#ffe066",
      MISS: "#ff5c5c",
    };

    const t = this.laneJudgeTexts?.[laneIndex];
    if (!t) return;

    t.setDepth(1000);
    t.setText(label);
    t.setColor(colors[label] || "#ffffff");
    t.setAlpha(1);
    t.setScale(0.9);

    this.tweens.killTweensOf(t);

    this.tweens.add({
      targets: t,
      scale: 1.12,
      alpha: 0,
      duration: 220,
      ease: "Quad.out",
    });
  }

  spawnNoteFromChart(noteData) {
    const laneIndex = noteData.lane;
    const lane = this.laneRects[laneIndex];
    if (!lane) return;

    const key = ["arrowL", "arrowD", "arrowU", "arrowR"][laneIndex];
    const x = lane.x;
    const y = this.spawnY;

    const sprite = this.add.image(x, y, key).setOrigin(0.5);
    sprite.setDepth(10);

    const targetWidth = lane.width * 0.9;
    sprite.setScale(targetWidth / sprite.width);

    this.notes.push({
      laneIndex,
      sprite,
      spawn: noteData.spawn,
      hit: noteData.hit,
      speed: noteData.speed,
    });
  }

  tryHit(laneIndex) {
    if (!this.stageActive) return;
    if (!this.song || !this.song.isPlaying) return;

    const songTime = this.song.seek;

    // Find closest note in lane by time error
    let best = null;
    let bestErr = Infinity;

    for (const n of this.notes) {
      if (n.laneIndex !== laneIndex) continue;
      const err = Math.abs(songTime - n.hit);
      if (err < bestErr) {
        bestErr = err;
        best = n;
      }
    }

    if (!best) return;

    // Out of window -> ignore (or you can show MISS on press if you want)
    if (bestErr > this.goodS) return;

    let points = 0;
    let label = "GOOD";

    if (bestErr <= this.perfectS) {
      points = 300;
      label = "PERFECT";
    } else if (bestErr <= this.greatS) {
      points = 150;
      label = "GREAT";
    } else {
      points = 50;
      label = "GOOD";
    }

    this.showJudgement(laneIndex, label);

    best.sprite.destroy();
    this.notes = this.notes.filter((x) => x !== best);

    this.combo += 1;
    this.score += points + Math.min(this.combo, 50);

    this.scoreText.setText(`Score: ${this.score}\nCombo: ${this.combo}`);
  }

  update() {
    if (!this.song || !this.song.isPlaying) return;

    const songTime = this.song.seek;

    // Stage transitions
    if (this.currentStage && songTime >= this.currentStage.end && this.stageActive) {
      this.beginStageTransition();
    }

    // Spawn notes by spawn time
    if (this.spawningEnabled && this.chart && this.chart.length > 0) {
      while (this.chartIndex < this.chart.length && songTime >= this.chart[this.chartIndex].spawn) {
        const nd = this.chart[this.chartIndex];
        this.spawnNoteFromChart(nd);
        this.chartIndex++;
      }
    }

    // Move notes (time-synced)
    for (const n of this.notes) {
      n.sprite.y = this.spawnY + (songTime - n.spawn) * n.speed;
    }

    // Miss detection
    const missPx = 60;

    this.notes = this.notes.filter((n) => {
      if (n.sprite.y > this.hitY + missPx) {
        n.sprite.destroy();
        this.combo = 0;
        this.scoreText.setText(`Score: ${this.score}\nCombo: ${this.combo}`);
        this.showJudgement(n.laneIndex, "MISS");
        return false;
      }
      return true;
    });
  }
}

export default function GameCanvas() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: "100%",
      height: "100%",
      backgroundColor: "#0b0b10",
      scene: [PlayScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    />
  );
}
