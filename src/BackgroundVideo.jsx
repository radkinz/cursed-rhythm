import React from "react";

export default function BackgroundVideo(videoSrc) {
    //const VIDEO_ID = "HMJweJrTmqQ";
    console.log(videoSrc, "HERE")
    return (
      <div style={styles.wrap}>
        <iframe
          src={`https://www.youtube.com/embed/${videoSrc.videoSrc}?autoplay=1&mute=1&loop=1&playlist=${videoSrc.videoSrc}&controls=0&showinfo=0&modestbranding=1&playsinline=1`}
          frameBorder="0"
          allow="autoplay; fullscreen"
          allowFullScreen
          style={styles.video}
        />
      </div>
    );
  }
  

const styles = {
  wrap: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none", // VERY IMPORTANT
    overflow: "hidden",
    background: "#000",
  },
  video: {
    width: "120vw",
    height: "120vh",
    objectFit: "cover",
    position: "absolute",
    top: "-10vh",
    left: "-10vw",
    opacity: 0.4,              // tune this
    filter: "blur(2px) saturate(1.1)",
  },
};
