import React from "react";

export default function BackgroundVideo() {
    const VIDEO_ID = "HMJweJrTmqQ";
  
    return (
      <div style={styles.wrap}>
        <iframe
          src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}&controls=0&showinfo=0&modestbranding=1&playsinline=1`}
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
