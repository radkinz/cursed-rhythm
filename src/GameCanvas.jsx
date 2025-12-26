import { useEffect, useRef } from "react";
import Phaser from "phaser";

class PlayScene extends Phaser.Scene {
    constructor() {
        super("play");
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

        // Small debug label
        this.add.text(16, 16, "Lanes + hit line", {
            fontFamily: "system-ui",
            fontSize: "14px",
            color: "#d6d6ff",
        });

        const arrowKeys = this.input.keyboard.createCursorKeys();

        const press = (idx) => {
        const r = this.laneRects[idx];
        if (!r) return;
        r.setFillStyle(0x2a2a55).setAlpha(1);
        this.time.delayedCall(60, () => r.setFillStyle(0x151526).setAlpha(0.95));
        };

        // Map: Left, Down, Up, Right
        arrowKeys.left.on("down", () => press(0));
        arrowKeys.down.on("down", () => press(1));
        arrowKeys.up.on("down", () => press(2));
        arrowKeys.right.on("down", () => press(3));


        this.scale.on("resize", () => this.scene.restart());
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
