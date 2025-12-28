import React from "react";

// ✅ Update filenames to match what you put in /src/assets
import leftBoy from "./assets/anime_left.png";
import rightBoy from "./assets/anime_right.png";

export default function LandingPage({ variant, onStart }) {
    return (
        <div style={styles.page}>
            <div style={styles.bgGlow} aria-hidden="true" />

            {/* Side characters */}
            <img
                src={leftBoy}
                alt=""
                aria-hidden="true"
                style={{ ...styles.sideImg, ...styles.leftImg }}
            />
            <img
                src={rightBoy}
                alt=""
                aria-hidden="true"
                style={{ ...styles.sideImg, ...styles.rightImg }}
            />

            {/* Center content */}
            <div style={styles.centerWrap}>
                <h1 style={styles.title}>
                    PUPPY, <span style={styles.titleAccent}>PLAY!</span> <span style={styles.variantTitle}>{variant.title}</span>
                </h1>

                <p style={styles.subtitle}>
                 Training starts gentle, then pushes you harder. Be a good puppy. ♡
                </p>

                <button style={styles.cta} onClick={onStart}>
                    BEGIN TRAINING
                </button>

                <div style={styles.hint}>
                    Controls{" "}
                    <kbd style={styles.kbd}>←</kbd>
                    <kbd style={styles.kbd}>↓</kbd>
                    <kbd style={styles.kbd}>↑</kbd>
                    <kbd style={styles.kbd}>→</kbd>
                    {/* <span style={{ opacity: 0.65 }}> · </span>
                    <kbd style={styles.kbd}>Space</kbd> Pause */}
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 18px",
        color: "#fff",
        background:
            "radial-gradient(1100px 800px at 15% 10%, rgba(155,120,255,0.40) 0%, rgba(20,16,40,0.96) 55%, rgba(7,6,17,1) 100%)",
        fontFamily:
            '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial',
    },

    bgGlow: {
        position: "absolute",
        inset: "-40%",
        background:
            "radial-gradient(closest-side at 70% 40%, rgba(255, 170, 230, 0.26), transparent 62%), radial-gradient(closest-side at 30% 70%, rgba(125, 249, 255, 0.16), transparent 66%)",
        filter: "blur(30px)",
        pointerEvents: "none",
    },

    centerWrap: {
        zIndex: 2,
        width: "min(600px, 88vw)",
        textAlign: "center",
        padding: "22px 20px",
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.30)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
    },

    title: {
        margin: "0 0 10px",
        fontSize: 64,
        lineHeight: 1.0,
        letterSpacing: 3.0,
        fontWeight: 900,
        textShadow: "0 16px 70px rgba(0,0,0,0.55)",
    },

    titleAccent: {
        color: "#ff9adf",
        textShadow: "0 0 24px rgba(255,154,223,0.45)",
    },

    variantTitle: {
        fontSize: 32,
    },
      

    subtitle: {
        margin: "0 auto 18px",
        maxWidth: 560,
        fontSize: 16,
        lineHeight: 1.6,
        opacity: 0.92,
    },

    emph: {
        color: "#7df9ff",
        fontWeight: 800,
    },

    cta: {
        width: "100%",
        padding: "14px 16px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "linear-gradient(90deg, rgba(255,154,223,0.35), rgba(125,249,255,0.25))",
        color: "#fff",
        boxShadow: "0 0 32px rgba(255,154,223,0.25)",
        fontSize: 16,
        fontWeight: 900,
        letterSpacing: 1.2,
        cursor: "pointer",
        textTransform: "uppercase",
    },

    

    hint: {
        marginTop: 12,
        fontSize: 13,
        opacity: 0.85,
    },

    kbd: {
        display: "inline-block",
        padding: "3px 8px",
        margin: "0 2px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(0,0,0,0.25)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
    },

    // Side images: anchored to left/right, vertically centered
    sideImg: {
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        height: "min(82vh, 760px)",
        width: "auto",
        zIndex: 1,
        opacity: 0.95,
        filter: "drop-shadow(0 30px 60px rgba(0,0,0,0.55))",
        pointerEvents: "none",
        userSelect: "none",
    },

    leftImg: {
        left: "max(-40px, -2vw)", // slightly offscreen for style
    },

    rightImg: {
        right: "max(-120px, -6vw)",
        transform: "translateY(-50%) scale(0.95)",
    },
};
