import { useEffect, useRef } from "react";
import Phaser from "phaser";

class PlayScene extends Phaser.Scene {
    //consts
    notes = [];
    noteSpeed = 400;
    chartIndex = 0;

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
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(width / 2, height / 2, width, height, 0x0b0b10);

        // Playfield geometry
        const lanes = 4;
        const laneWidth = Math.min(160, Math.floor(width * 0.16));
        const gap = 10;
        const totalWidth = lanes * laneWidth + (lanes - 1) * gap;
        const left = (width - totalWidth) / 2;
        const hitY = Math.floor(height * 0.82);

        // Lanes
        this.laneRects = [];
        for (let i = 0; i < lanes; i++) {
            const x = left + i * (laneWidth + gap) + laneWidth / 2;
            const rect = this.add.rectangle(x, height / 2, laneWidth, height, 0x151526).setAlpha(0.95);
            this.laneRects.push(rect);
        }

        // Lane separators (subtle)
        for (let i = 1; i < lanes; i++) {
            const sepX = left + i * (laneWidth + gap) - gap / 2;
            this.add.rectangle(sepX, height / 2, 2, height, 0x000000).setAlpha(0.25);
        }

        // Hit line
        this.add.rectangle(width / 2, hitY, totalWidth, 6, 0xffffff).setAlpha(0.6);

        // Key labels
        const keys = ["←", "↓", "↑", "→"];
        for (let i = 0; i < lanes; i++) {
            const x = left + i * (laneWidth + gap) + laneWidth / 2;
            this.add.text(x, hitY + 18, keys[i], {
                fontFamily: "system-ui",
                fontSize: "16px",
                color: "#d6d6ff",
            }).setOrigin(0.5, 0);
        }

        const data = this.cache.json.get("chart");
        this.chart = data
        this.chartIndex = 0;

        //song
        this.sound.pauseOnBlur = false;

        this.song = this.sound.add("song", { volume: 0.8 });
        this.startedAt = null;

        // Start on Space
        this.input.keyboard.once("keydown-SPACE", async () => {
            // Some browsers need a user gesture to unlock audio; Space counts.
            this.song.play();
            this.startedAt = this.time.now;
        });

        const arrowKeys = this.input.keyboard.createCursorKeys();

        const press = (idx) => {
            const r = this.laneRects[idx];
            if (!r) return;
            r.setFillStyle(0x2a2a55).setAlpha(1);
            this.time.delayedCall(60, () => r.setFillStyle(0x151526).setAlpha(0.95));
        };

        //song scoring
        this.hitY = Math.floor(height * 0.82);
        this.score = 0;
        this.combo = 0;

        this.scoreText = this.add.text(16, 40, "Score: 0\nCombo: 0", {
            fontFamily: "system-ui",
            fontSize: "16px",
            color: "#d6d6ff",
        });

        this.judgeText = this.add.text(16, 90, "", {
            fontFamily: "system-ui",
            fontSize: "18px",
            color: "#ffffff",
        });


        // Map: Left, Down, Up, Right
        arrowKeys.left.on("down", () => press(0));
        arrowKeys.down.on("down", () => press(1));
        arrowKeys.up.on("down", () => press(2));
        arrowKeys.right.on("down", () => press(3));

        // Test pattern: one note per lane
        // this.time.addEvent({
        //     delay: 400,
        //     repeat: 7,
        //     callback: () => {
        //         const lane = Phaser.Math.Between(0, 3);
        //         this.spawnNote(lane);
        //     },
        // });

        const cursors = this.input.keyboard.createCursorKeys();

        // Lanes: 0=Left, 1=Down, 2=Up, 3=Right
        cursors.left.on("down", () => this.tryHit(0));
        cursors.down.on("down", () => this.tryHit(1));
        cursors.up.on("down", () => this.tryHit(2));
        cursors.right.on("down", () => this.tryHit(3));


        this.scale.on("resize", () => this.scene.restart());
    }

    spawnNote(laneIndex) {
        const lane = this.laneRects[laneIndex];
        if (!lane) return;

        const keys = ["arrowL", "arrowD", "arrowU", "arrowR"];
        const key = keys[laneIndex];

        const x = lane.x;
        const y = -60;

        const note = this.add.image(x, y, key);
        note.setOrigin(0.5);

        // Scale image to fit lane nicely
        const targetWidth = lane.width * 0.9;
        const scale = targetWidth / note.width;
        note.setScale(scale);

        // (Optional) make hit-testing easier even if sprite is small
        // note.setDisplaySize(lane.width * 0.75, lane.width * 0.75);

        this.notes.push({ laneIndex, sprite: note });
    }


    tryHit(laneIndex) {
        if (!this.notes?.length) return;

        const perfectPx = 14;
        const greatPx = 26;
        const goodPx = 40;

        // Find the closest note in THIS lane (by distance to hit line)
        let best = null;
        let bestDist = Infinity;

        for (const n of this.notes) {
            if (n.laneIndex !== laneIndex) continue;
            const dist = Math.abs(n.sprite.y - this.hitY);
            if (dist < bestDist) {
                bestDist = dist;
                best = n;
            }
        }

        if (!best) return;

        let points = 0;
        let label = "";

        if (bestDist <= perfectPx) {
            points = 300;
            label = "Perfect";
        } else if (bestDist <= greatPx) {
            points = 150;
            label = "Great";
        } else if (bestDist <= goodPx) {
            points = 50;
            label = "Good";
        } else {
            // too far: treat as "no hit"
            return;
        }

        // Remove note
        best.sprite.destroy();
        this.notes = this.notes.filter((x) => x !== best);

        // Update score/combo
        this.combo += 1;
        this.score += points + Math.min(this.combo, 50); // small combo bonus

        this.scoreText.setText(`Score: ${this.score}\nCombo: ${this.combo}`);
        this.judgeText.setText(`${label}!`);
        this.time.delayedCall(120, () => this.judgeText.setText(""));
    }


    update(time, delta) {
        // 1) Move notes every frame (always)
        const dy = (this.noteSpeed * delta) / 1000;

        this.notes.forEach((n) => {
            n.sprite.y += dy;
        });

        // Cleanup
        this.notes = this.notes.filter((n) => {
            if (n.sprite.y > this.scale.height + 50) {
                n.sprite.destroy();
                return false;
            }
            return true;
        });

        // 2) Only spawn from chart if the song is playing
        if (!this.song.isPlaying) return;

        const songTime = this.song.seek; // seconds

        while (
            this.chartIndex < this.chart.length &&
            songTime >= this.chart[this.chartIndex].t
        ) {
            this.spawnNote(this.chart[this.chartIndex].lane);
            this.chartIndex++;
        }

        const missPx = 60;

        this.notes = this.notes.filter((n) => {
            if (n.sprite.y > this.hitY + missPx) {
                n.sprite.destroy();
                this.combo = 0;
                this.scoreText.setText(`Score: ${this.score}\nCombo: ${this.combo}`);
                this.judgeText.setText("Miss");
                this.time.delayedCall(120, () => this.judgeText.setText(""));
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
