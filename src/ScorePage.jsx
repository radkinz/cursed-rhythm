import React from "react";

function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
}

function getRank(accuracy) {
    if (accuracy >= 0.97) return { rank: "S", title: "PERFECT PUPPY", vibe: "legendary" };
    if (accuracy >= 0.92) return { rank: "A", title: "GOOD PUPPY", vibe: "great" };
    if (accuracy >= 0.85) return { rank: "B", title: "TRYING PUPPY", vibe: "ok" };
    if (accuracy >= 0.75) return { rank: "C", title: "DISTRACTED PUPPY", vibe: "rough" };
    return { rank: "D", title: "NEEDS TRAINING", vibe: "bad" };
}

export default function ScorePage({
    results,
    onRetry,
    onBack,
}) {
    // results can be whatever you track; these defaults keep it safe
    const score = results?.score ?? 0;
    const maxCombo = results?.maxCombo ?? 0;
    const perfect = results?.perfect ?? 0;
    const great = results?.great ?? 0;
    const good = results?.good ?? 0;
    const miss = results?.miss ?? 0;

    const totalHits = perfect + great + good + miss;
    const accuracy = totalHits > 0 ? (perfect + 0.75 * great + 0.4 * good) / totalHits : 0;
    const accPct = Math.round(clamp(accuracy, 0, 1) * 1000) / 10;

    const { rank, title, vibe } = getRank(accuracy);
    const rankImgSrc = `/scoreImgs/${rank}.png`;

    const messages = {
        legendary: "Okay wow...you're actually a PERFECT puppy. Ruff! ♡",
        great: "Good puppy. You listened. Proud of you. ♡",
        ok: "Trying puppy. You've got the spirit but need to tighten your timing.",
        rough: "Distracted puppy… eyes forward next time, okay?",
        bad: "Training incomplete. No treats yet. Try again. 🐾",
    };

    return (
        <div style={styles.page}>
            <div style={styles.bgGlow} aria-hidden="true" />

            <div style={styles.layout}>
                {/* LEFT: your existing card */}
                <div style={styles.card}>
                    <div style={styles.top}>
                        <div style={styles.rankBox}>
                            <div style={styles.rank}>{rank}</div>
                            <div style={styles.rankLabel}>{title}</div>
                        </div>

                        <div style={styles.summary}>
                            <div style={styles.score}>{score.toLocaleString()}</div>
                            <div style={styles.sub}>Accuracy: {accPct}% · Max Combo: {maxCombo}</div>
                        </div>
                    </div>

                    <div style={styles.message}>
                        {messages[vibe] || "Good puppy."}
                    </div>

                    <div style={styles.statsGrid}>
                        <div style={styles.stat}>
                            <div style={styles.statLabel}>PERFECT</div>
                            <div style={styles.statValue}>{perfect}</div>
                        </div>
                        <div style={styles.stat}>
                            <div style={styles.statLabel}>GREAT</div>
                            <div style={styles.statValue}>{great}</div>
                        </div>
                        <div style={styles.stat}>
                            <div style={styles.statLabel}>GOOD</div>
                            <div style={styles.statValue}>{good}</div>
                        </div>
                        <div style={styles.stat}>
                            <div style={styles.statLabel}>MISS</div>
                            <div style={styles.statValue}>{miss}</div>
                        </div>
                    </div>

                    <div style={styles.actions}>
                        <button style={styles.primary} onClick={onRetry}>
                            RETRY TRAINING
                        </button>
                        <button style={styles.secondary} onClick={onBack}>
                            BACK TO TITLE
                        </button>
                    </div>
                </div>

                {/* RIGHT: rank image */}
                <div style={styles.right}>
                    <img
                        src={rankImgSrc}
                        alt={`Rank ${rank}`}
                        style={styles.rankImage}
                        draggable={false}
                    />
                </div>
            </div>
        </div>

    );
}

const styles = {
    page: {
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 28px",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        background:
            "radial-gradient(1100px 800px at 15% 10%, rgba(255,154,223,0.22) 0%, rgba(20,16,40,0.96) 55%, rgba(7,6,17,1) 100%)",
        fontFamily:
            '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial',
    },
    layout: {
        width: "min(1100px, 96vw)",
        display: "grid",
        gridTemplateColumns: "minmax(420px, 1fr) minmax(320px, 1fr)",
        gap: 22,
        alignItems: "center",
        zIndex: 1,
    },

    right: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
    },

    rankImage: {
        maxWidth: "92%",
        maxHeight: "82vh",
        objectFit: "contain",
        filter: "drop-shadow(0 18px 55px rgba(0,0,0,0.65))",
    },

    bgGlow: {
        position: "absolute",
        inset: "-40%",
        background:
            "radial-gradient(closest-side at 70% 40%, rgba(255, 170, 230, 0.22), transparent 62%), radial-gradient(closest-side at 30% 70%, rgba(125, 249, 255, 0.14), transparent 66%)",
        filter: "blur(30px)",
        pointerEvents: "none",
    },
    card: {
        width: "100%",
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.32)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
        padding: 18,
        zIndex: 1,
    },
    top: {
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 14,
        alignItems: "center",
    },
    rankBox: {
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.14)",
        background:
            "linear-gradient(180deg, rgba(255,154,223,0.18), rgba(125,249,255,0.10))",
        padding: "14px 12px",
        textAlign: "center",
    },
    rank: {
        fontSize: 64,
        fontWeight: 900,
        lineHeight: 1.0,
        letterSpacing: 2,
        textShadow: "0 18px 70px rgba(0,0,0,0.55)",
    },
    rankLabel: {
        marginTop: 8,
        fontSize: 12,
        letterSpacing: 1.6,
        textTransform: "uppercase",
        opacity: 0.9,
    },
    summary: {
        textAlign: "left",
    },
    score: {
        fontSize: 44,
        fontWeight: 900,
        letterSpacing: 1,
    },
    sub: {
        marginTop: 4,
        fontSize: 14,
        opacity: 0.85,
    },
    message: {
        marginTop: 14,
        padding: "12px 12px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        fontSize: 14,
        lineHeight: 1.45,
        opacity: 0.95,
    },
    statsGrid: {
        marginTop: 14,
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 10,
    },
    stat: {
        padding: 10,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.06)",
        textAlign: "center",
    },
    statLabel: {
        fontSize: 12,
        letterSpacing: 1.2,
        opacity: 0.75,
    },
    statValue: {
        marginTop: 6,
        fontSize: 20,
        fontWeight: 900,
    },
    actions: {
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
    },
    primary: {
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.18)",
        background:
            "linear-gradient(90deg, rgba(255,154,223,0.36), rgba(125,249,255,0.22))",
        color: "#fff",
        fontSize: 14,
        fontWeight: 900,
        letterSpacing: 1.1,
        padding: "12px 12px",
        cursor: "pointer",
        textTransform: "uppercase",
    },
    secondary: {
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(0,0,0,0.18)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: 1.0,
        padding: "12px 12px",
        cursor: "pointer",
        textTransform: "uppercase",
        opacity: 0.9,
    },
    footer: {
        marginTop: 12,
        fontSize: 12,
        opacity: 0.7,
        textAlign: "center",
    },
    pink: { color: "#ff9adf", fontWeight: 800 },
};
