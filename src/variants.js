export const VARIANTS = {
    default: {
      id: "default",
      song: "./audio/song.mp3",
      chart: "./charts/chart.json",
      bgVideo: "HMJweJrTmqQ", // or youtube ID if you still use YouTube
      title: "",
      end: 230
    },
    ryan: {
      id: "ryan",
      song: "./audio/drunk.mp3",
      chart: "./charts/chart-drunk.json",
      bgVideo: "6fj5XaFCbFE",
      title: "(Ryan Mode)",
      end: 190
    },
  };
  
  export function getVariant(id) {
    return VARIANTS[id] ?? VARIANTS.default;
  }
  