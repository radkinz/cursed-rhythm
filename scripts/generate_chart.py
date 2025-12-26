import json
import random
from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class Note:
    t: float     # seconds from song start
    lane: int    # 0..3

def beats_to_seconds(beat: float, bpm: float, offset: float) -> float:
    spb = 60.0 / bpm
    return offset + beat * spb

def generate_basic(
    bpm: float,
    offset: float,
    beats: List[float],
    lanes: Optional[List[int]] = None,
    seed: int = 0
) -> List[Note]:
    """
    beats: list of beat positions (e.g., [0, 0.5, 1.0, 1.5, ...])
    lanes: optional lane sequence same length as beats; if None, random lanes.
    """
    rng = random.Random(seed)
    notes: List[Note] = []
    for i, b in enumerate(beats):
        lane = lanes[i] if lanes is not None else rng.randrange(0, 4)
        notes.append(Note(t=beats_to_seconds(b, bpm, offset), lane=lane))
    return notes

def main():
    # --- tweak these ---
    bpm = 140.0
    offset = 0.20  # seconds (calibration: song start -> first downbeat)
    length_beats = 64

    # Example pattern: 8th notes for 16 bars of 4/4 at 140 bpm
    # (8th notes = every 0.5 beats)
    beats = [i * 0.5 for i in range(int(length_beats / 0.5))]

    # Optional: scripted lane pattern (repeatable)
    # lanes = [0,1,2,3] * (len(beats)//4)  # simple cycle
    lanes = None  # random lanes instead

    notes = generate_basic(bpm=bpm, offset=offset, beats=beats, lanes=lanes, seed=42)

    # Sort (just in case) and export
    out: List[Dict] = [{"t": round(n.t, 4), "lane": n.lane} for n in sorted(notes, key=lambda x: x.t)]
    with open("chart.json", "w") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(out)} notes to chart.json")

if __name__ == "__main__":
    main()
