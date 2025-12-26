import json
import random
from dataclasses import dataclass
from typing import List, Dict, Optional, Literal


@dataclass
class Note:
    t: float   # seconds from song start
    lane: int  # 0..3 (Left, Down, Up, Right)


def beats_to_seconds(beat: float, bpm: float, offset: float) -> float:
    return offset + beat * (60.0 / bpm)


def generate_for_duration(
    bpm: float,
    offset: float,
    duration_seconds: float,
    grid: Literal["1/4", "1/8", "1/16"] = "1/8",
    density: float = 0.35,
    seed: int = 42,
    no_jacks: bool = True,
    prefer_nearby: bool = True,
    max_gap_beats: float = 2.0,
) -> List[Note]:
    """
    Generates a simple chart across the full song with a max-gap constraint.

    grid:
      - "1/4"  => quarter notes (easy)
      - "1/8"  => eighth notes (medium)
      - "1/16" => sixteenth notes (hard)

    density:
      probability of placing a note at each grid slot (0..1). Lower = easier.

    max_gap_beats:
      guarantees you never go more than this many beats without a note.
      (At 75 BPM: 1 beat = 0.8s, so 2 beats = 1.6s max silence.)

    no_jacks:
      avoids placing the same lane twice in a row (reduces difficulty).

    prefer_nearby:
      biases lane choice toward neighboring lanes (reduces big jumps).
    """
    rng = random.Random(seed)

    step_beats = {"1/4": 1.0, "1/8": 0.5, "1/16": 0.25}[grid]
    total_beats = max(0.0, (duration_seconds - offset) * bpm / 60.0)

    notes: List[Note] = []
    prev_lane: Optional[int] = None

    # Track how many beats since last note was placed.
    # Start at max to encourage an early note near the beginning.
    gap_beats = max_gap_beats

    beat = 0.0
    while beat <= total_beats:
        should_place = (rng.random() < density) or (gap_beats >= max_gap_beats)

        if should_place:
            candidates = [0, 1, 2, 3]

            if no_jacks and prev_lane is not None:
                candidates = [l for l in candidates if l != prev_lane]

            if prefer_nearby and prev_lane is not None:
                # Higher weight for lanes closer to previous lane
                weights = [1.0 / (1.0 + abs(l - prev_lane)) for l in candidates]
                lane = rng.choices(candidates, weights=weights, k=1)[0]
            else:
                lane = rng.choice(candidates)

            t = beats_to_seconds(beat, bpm, offset)
            notes.append(Note(t=t, lane=lane))

            prev_lane = lane
            gap_beats = 0.0
        else:
            gap_beats += step_beats

        beat += step_beats

    # Already in increasing time, but safe to sort.
    notes.sort(key=lambda n: n.t)
    return notes


def main():
    # Song info (given)
    bpm = 75.0
    duration_seconds = 231.0  # 3:51
    offset = 0.20             # adjust if notes feel early/late

    # Difficulty knobs (start easy and consistent)
    grid: Literal["1/4", "1/8", "1/16"] = "1/8"
    density = 0.35
    max_gap_beats = 2.0       # never more than 2 beats without a note (~1.6s at 75 BPM)

    # Pattern constraints
    no_jacks = True
    prefer_nearby = True

    notes = generate_for_duration(
        bpm=bpm,
        offset=offset,
        duration_seconds=duration_seconds,
        grid=grid,
        density=density,
        seed=42,
        no_jacks=no_jacks,
        prefer_nearby=prefer_nearby,
        max_gap_beats=max_gap_beats,
    )

    out: List[Dict] = [{"t": round(n.t, 4), "lane": n.lane} for n in notes]

    with open("chart.json", "w") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(out)} notes to chart.json")
    print(
        "Settings:",
        f"bpm={bpm}, duration={duration_seconds}s, offset={offset}, grid={grid}, "
        f"density={density}, max_gap_beats={max_gap_beats}, "
        f"no_jacks={no_jacks}, prefer_nearby={prefer_nearby}"
    )


if __name__ == "__main__":
    main()
