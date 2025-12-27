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

        this.held = [false, false, false, false];

        const keys = this.input.keyboard.createCursorKeys();
        keys.left.on("down", () => { this.held[0] = true; this.tryHit(0); });
        keys.left.on("up", () => { this.held[0] = false; this.releaseHold(0); });

        keys.down.on("down", () => { this.held[1] = true; this.tryHit(1); });
        keys.down.on("up", () => { this.held[1] = false; this.releaseHold(1); });

        keys.up.on("down", () => { this.held[2] = true; this.tryHit(2); });
        keys.up.on("up", () => { this.held[2] = false; this.releaseHold(2); });

        keys.right.on("down", () => { this.held[3] = true; this.tryHit(3); });
        keys.right.on("up", () => { this.held[3] = false; this.releaseHold(3); });

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
        const keysLabels = ["←", "↓", "↑", "→"];
        for (let i = 0; i < lanes; i++) {
            const x = left + i * (laneWidth + gap) + laneWidth / 2;
            this.add
                .text(x, this.hitY + 18, keysLabels[i], {
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
        this.showStagePopup("Stage 1", this.stages[0].message, () => { });
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
            this.showStagePopup("Finished", "You beat it. That’s unfortunate.", () => { });
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

        const type = noteData.type ?? "tap";
        const hit = noteData.hit;
        const end = noteData.end ?? hit;
        const speed = noteData.speed;

        const key = ["arrowL", "arrowD", "arrowU", "arrowR"][laneIndex];
        const x = lane.x;
        const y = this.spawnY;

        // Arrow head
        const sprite = this.add.image(x, y, key).setOrigin(0.5);
        sprite.setDepth(20);

        const targetWidth = lane.width * 0.9;
        sprite.setScale(targetWidth / sprite.width);

        // Optional: keep arrow crisp
        // sprite.setPipeline("Light2D"); // ignore if not using lights

        let tail = null;

        // Hold tail (white rectangle behind the arrow)
        if (type === "hold" && end > hit) {
            const holdLenSec = end - hit;

            // Tail length in pixels: duration * speed
            const tailHeight = Math.max(14, holdLenSec * speed);

            // Tail width: thinner than arrow
            const tailWidth = lane.width * 0.22;

            // Create rectangle; origin 0.5,1 makes y be the bottom of the rect
            tail = this.add.rectangle(x, y, tailWidth, tailHeight, 0xffffff, 1);
            tail.setOrigin(0.5, 1);
            tail.setDepth(10);

            // Slight transparency looks nicer
            tail.setAlpha(0.9);
        }

        this.notes.push({
            laneIndex,
            sprite,
            tail,          // NEW
            spawn: noteData.spawn,
            hit,
            end,
            speed,
            type,
            holding: false,
        });
    }


    tryHit(laneIndex) {
        if (!this.stageActive) return;
        if (!this.song || !this.song.isPlaying) return;

        const songTime = this.song.seek;



        // Find closest note in this lane by time-to-hit
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

        // Too far from hit window → ignore
        if (bestErr > this.goodS) return;

        // ─────────────────────────────
        // TAP NOTE
        // ─────────────────────────────
        if (best.type === "tap") {
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
            this.notes = this.notes.filter(n => n !== best);

            this.combo += 1;
            this.score += points + Math.min(this.combo, 50);
            this.scoreText.setText(`Score: ${this.score}\nCombo: ${this.combo}`);
            return;
        }

        // ─────────────────────────────
        // HOLD NOTE (start only)
        // ─────────────────────────────
        if (best.type === "hold") {
            // Prevent double-starting the same hold
            if (best.holding) return;

            best.holding = true;
            best.holdStartedAt = songTime;

            // Small reward for starting a hold
            this.combo += 1;
            this.score += 50;

            this.showJudgement(laneIndex, "HOLD");
            this.scoreText.setText(`Score: ${this.score}\nCombo: ${this.combo}`);
        }
    }


    update(time, delta) {
        // Only run gameplay when the song is playing
        if (!this.song || !this.song.isPlaying) return;

        const songTime = this.song.seek;

        // 0) Stage transition
        if (this.currentStage && songTime >= this.currentStage.end && this.stageActive) {
            this.beginStageTransition();
        }

        // 1) Spawn notes by spawn time (tap + hold)
        // Chart entries should be: { spawn, hit, end?, lane, stage, speed, type }
        if (this.spawningEnabled && this.chart && this.chart.length > 0) {
            while (this.chartIndex < this.chart.length && songTime >= this.chart[this.chartIndex].spawn) {
                const nd = this.chart[this.chartIndex];
                this.spawnNoteFromChart(nd);
                this.chartIndex++;
            }
        }

        // 2) Move notes (time-synced)
        for (const n of this.notes) {
            const y = this.spawnY + (songTime - n.spawn) * n.speed;

            // Move head
            n.sprite.y = y;

            // Move tail
            if (n.tail) {
                n.tail.y = y;

                // Drain tail while holding (visual feedback)
                if (n.holding) {
                    const remaining = Math.max(0, n.end - songTime);      // seconds left
                    const remainingPx = Math.max(8, remaining * n.speed); // pixels left
                    n.tail.height = remainingPx;
                }
            }
        }



        // 3) HOLD resolution (complete / early release)
        // Requires: this.held[laneIndex] updated on keydown/keyup
        const HOLD_RELEASE_GRACE = 0.05; // 50ms

        for (const n of this.notes) {
            if (n.type !== "hold" || !n.holding) continue;

            // Don't fail it immediately the same frame it starts
            if ((songTime - n.hit) < HOLD_RELEASE_GRACE) continue;

            // Released early -> fail
            if (!this.held[n.laneIndex] && songTime < n.end) {
                n.holding = false;
                n._holdFailed = true;

                this.combo = 0;
                this.showJudgement(n.laneIndex, "MISS");
                this.scoreText.setText(`Score: ${this.score}\nCombo: ${this.combo}`);

                // Optional: destroy immediately on fail
                n.sprite.destroy();
                n.tail?.destroy();
                n._done = true;
            }

            // Completed successfully
            if (songTime >= n.end && this.held[n.laneIndex]) {
                n._done = true;

                this.score += 250 + Math.min(this.combo, 50);
                this.showJudgement(n.laneIndex, "GREAT");

                n.sprite.destroy();
                n.tail?.destroy();
            }
        }


        // 4) Miss detection + cleanup
        // Tap notes miss when they pass hit line.
        // Hold notes miss if you never started them and they pass hit line.
        const missPx = 60;

        this.notes = this.notes.filter((n) => {
            // Remove completed holds
            if (n._done) return false;

            // Un-started holds behave like taps for miss purposes
            const passed = n.sprite.y > this.hitY + missPx;

            if (passed) {
                // If it's a hold currently being held, don't auto-miss it here
                if (n.type === "hold" && n.holding) return true;

                // If hold already failed, skip double-missing
                if (!(n.type === "hold" && n._holdFailed)) {
                    this.combo = 0;
                    this.showJudgement(n.laneIndex, "MISS");
                    this.scoreText.setText(`Score: ${this.score}\nCombo: ${this.combo}`);
                }

                n.sprite.destroy();
                n.tail?.destroy();
                return false;
            }
            return true;


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
