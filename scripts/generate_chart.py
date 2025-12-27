import json
import random
from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class Note:
    hit: float    # seconds when note should be hit
    spawn: float  # seconds when note should spawn
    lane: int     # 0..3
    stage: int    # 1..6
    speed: float  # px/s used for this note


def pick_lane(
    rng: random.Random,
    prev_lane: Optional[int],
    *,
    no_jacks: bool,
    prefer_nearby: bool,
    jumpiness: float,
) -> int:
    candidates = [0, 1, 2, 3]
    if no_jacks and prev_lane is not None:
        candidates = [l for l in candidates if l != prev_lane]

    if prev_lane is None or not prefer_nearby:
        return rng.choice(candidates)

    # Bias closer lanes, but allow more jumps as jumpiness increases (0..1)
    weights = []
    for l in candidates:
        d = abs(l - prev_lane)
        base = 1.0 / (1.0 + d)                  # prefers nearby lanes
        w = (1.0 - jumpiness) * base + jumpiness * 1.0  # mix with uniform
        weights.append(w)

    return rng.choices(candidates, weights=weights, k=1)[0]


def generate_stage_notes(
    rng: random.Random,
    *,
    bpm: float,
    offset: float,
    stage_index: int,
    stage_start: float,
    stage_end: float,
    grid_beats: float,
    density: float,
    max_gap_beats: float,
    speed: float,
    spawn_y: float,
    hit_y: float,
    no_jacks: bool,
    prefer_nearby: bool,
    jumpiness: float,
) -> List[Note]:
    """
    Generates notes for a single stage in the time window [stage_start, stage_end]
    using a beat grid and max-gap constraint.

    Chart output is time-based and includes per-note speed so your Phaser update()
    can stay synced even when speed changes across stages.
    """
    spb = 60.0 / bpm

    # Convert stage time window to beats (relative to offset)
    start_beat = max(0.0, (stage_start - offset) / spb)
    end_beat = max(0.0, (stage_end - offset) / spb)

    # Snap start to the next grid line
    b = (start_beat // grid_beats) * grid_beats
    if b < start_beat:
        b += grid_beats

    travel_time = (hit_y - spawn_y) / speed  # seconds to fall from spawn_y to hit_y

    notes: List[Note] = []
    prev_lane: Optional[int] = None
    gap_beats = max_gap_beats  # encourage an early note

    while b <= end_beat:
        should_place = (rng.random() < density) or (gap_beats >= max_gap_beats)

        if should_place:
            lane = pick_lane(
                rng,
                prev_lane,
                no_jacks=no_jacks,
                prefer_nearby=prefer_nearby,
                jumpiness=jumpiness,
            )

            hit_t = offset + b * spb
            spawn_t = hit_t - travel_time

            # Ensure hit is inside stage window and spawn isn't before song start
            if stage_start <= hit_t <= stage_end and spawn_t >= 0.0:
                notes.append(Note(
                    hit=hit_t,
                    spawn=spawn_t,
                    lane=lane,
                    stage=stage_index,
                    speed=speed,
                ))
                prev_lane = lane
                gap_beats = 0.0
            else:
                gap_beats += grid_beats
        else:
            gap_beats += grid_beats

        b += grid_beats

    return notes


def main():
    rng = random.Random(42)

    # --- Song constants (given) ---
    bpm = 75.0
    duration_seconds = 231.0
    offset = 0.20  # tweak this if hits feel globally early/late

    # --- Popup / inter-stage gap planning ---
    # IMPORTANT: set this to be >= your popup animation total time (in seconds).
    POPUP_GAP = 2.0

    # --- Phaser geometry assumptions ---
    # spawnY should match your Phaser this.spawnY
    spawn_y = -60.0

    # hit_y must match your Phaser hitY in pixels for perfect visual sync.
    # If your canvas is ~720px tall and hitY is ~0.82*height, 600 is a common ballpark.
    # Best: set hit_y to your actual hitY (print it once in Phaser).
    hit_y = 600.0

    # --- Raw stage boundaries (conceptual) ---
    raw_stages = [
        (0.0, 35.0),
        (35.0, 70.0),
        (70.0, 105.0),
        (105.0, 145.0),
        (145.0, 190.0),
        (190.0, 231.0),
    ]

    # --- Convert to playable windows (this is the key!) ---
    # We shrink each stage so there is a clean POPUP_GAP with no notes on screen.
    stages = []
    for i, (raw_start, raw_end) in enumerate(raw_stages, start=1):
        play_start = raw_start + (POPUP_GAP if i > 1 else 0.0)
        play_end = raw_end - (POPUP_GAP if i < len(raw_stages) else 0.0)

        # Safety: don't allow negative/invalid windows
        play_start = max(0.0, play_start)
        play_end = min(duration_seconds, play_end)

        if play_end <= play_start:
            raise ValueError(f"Stage {i} has no playable time after applying POPUP_GAP. Reduce POPUP_GAP.")

        stages.append({
            "stage": i,
            "start": play_start,
            "end": play_end,
        })

    # --- Difficulty ramp (6 stages) ---
    # grid_beats: 1.0 quarters, 0.5 eighths, 0.25 sixteenths
    # density: probability per grid slot
    # max_gap_beats: forces a note if too much silence
    # speed: px/s for this stage (must match your Phaser movement formula)
    # jumpiness: 0 easy (nearby lanes), 1 hard (uniform random)
    params = [
        dict(grid_beats=1.0,  density=0.70, max_gap_beats=2.0,  speed=320.0, jumpiness=0.05),
        dict(grid_beats=0.5,  density=0.45, max_gap_beats=2.0,  speed=360.0, jumpiness=0.10),
        dict(grid_beats=0.5,  density=0.55, max_gap_beats=1.5,  speed=400.0, jumpiness=0.18),
        dict(grid_beats=0.5,  density=0.65, max_gap_beats=1.0,  speed=440.0, jumpiness=0.25),
        dict(grid_beats=0.25, density=0.38, max_gap_beats=1.0,  speed=480.0, jumpiness=0.35),
        dict(grid_beats=0.25, density=0.48, max_gap_beats=0.75, speed=520.0, jumpiness=0.45),
    ]

    all_notes: List[Note] = []
    for s in stages:
        p = params[s["stage"] - 1]
        all_notes.extend(generate_stage_notes(
            rng,
            bpm=bpm,
            offset=offset,
            stage_index=s["stage"],
            stage_start=s["start"],
            stage_end=s["end"],
            grid_beats=p["grid_beats"],
            density=p["density"],
            max_gap_beats=p["max_gap_beats"],
            speed=p["speed"],
            spawn_y=spawn_y,
            hit_y=hit_y,
            no_jacks=True,
            prefer_nearby=True,
            jumpiness=p["jumpiness"],
        ))

    # Sort by spawn time for in-game spawning
    all_notes.sort(key=lambda n: n.spawn)

    out: List[Dict] = [
        {
            "spawn": round(n.spawn, 4),
            "hit": round(n.hit, 4),
            "lane": n.lane,
            "stage": n.stage,
            "speed": round(n.speed, 2),
        }
        for n in all_notes
        if 0.0 <= n.hit <= duration_seconds
    ]

    with open("chart.json", "w") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(out)} notes to chart.json")
    print(f"Popup gap: {POPUP_GAP}s (no notes in those transition windows)")
    print("Playable stage windows:")
    for s in stages:
        print(f"  Stage {s['stage']}: {s['start']:.2f}s -> {s['end']:.2f}s")


if __name__ == "__main__":
    main()
