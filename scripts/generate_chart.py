import json
import random
from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class Note:
    hit: float    # seconds when note should be hit
    spawn: float  # seconds when note should spawn (so it reaches hitY at hit time)
    lane: int     # 0..3
    stage: int    # 1..6
    speed: float  # px/s used for this note


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def pick_lane(rng: random.Random, prev_lane: Optional[int], prefer_nearby: bool, no_jacks: bool, jumpiness: float) -> int:
    candidates = [0, 1, 2, 3]
    if no_jacks and prev_lane is not None:
        candidates = [l for l in candidates if l != prev_lane]

    if prev_lane is None or not prefer_nearby:
        return rng.choice(candidates)

    # Bias closer lanes, but allow jumps with "jumpiness"
    weights = []
    for l in candidates:
        d = abs(l - prev_lane)
        base = 1.0 / (1.0 + d)          # favors close
        w = (1.0 - jumpiness) * base + jumpiness * 1.0  # mix with uniform
        weights.append(w)

    return rng.choices(candidates, weights=weights, k=1)[0]


def generate_stage_notes(
    rng: random.Random,
    bpm: float,
    offset: float,
    stage_index: int,
    stage_start: float,
    stage_end: float,
    *,
    grid_beats: float,       # 1.0 = quarters, 0.5 = eighths, 0.25 = sixteenths
    density: float,          # probability per slot
    max_gap_beats: float,    # force a note if gap too large
    speed: float,            # px/s
    spawn_y: float,          # px
    hit_y: float,            # px
    no_jacks: bool,
    prefer_nearby: bool,
    jumpiness: float,        # 0 easy (close), 1 hard (uniform)
) -> List[Note]:
    spb = 60.0 / bpm

    # Convert stage time range into beats, aligned to grid
    # We generate "hit times" on a beat grid.
    start_beat = (stage_start - offset) / spb
    end_beat = (stage_end - offset) / spb
    start_beat = max(0.0, start_beat)
    end_beat = max(0.0, end_beat)

    # Snap to grid
    b = (start_beat // grid_beats) * grid_beats
    if b < start_beat:
        b += grid_beats

    travel_time = (hit_y - spawn_y) / speed  # seconds needed to fall into hit line

    notes: List[Note] = []
    prev_lane: Optional[int] = None
    gap_beats = max_gap_beats

    while b <= end_beat:
        should_place = (rng.random() < density) or (gap_beats >= max_gap_beats)

        if should_place:
            lane = pick_lane(rng, prev_lane, prefer_nearby, no_jacks, jumpiness)

            hit_t = offset + b * spb
            spawn_t = hit_t - travel_time

            # don't spawn before song start
            if spawn_t >= 0.0 and hit_t >= stage_start and hit_t <= stage_end:
                notes.append(Note(
                    hit=hit_t,
                    spawn=spawn_t,
                    lane=lane,
                    stage=stage_index,
                    speed=speed
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

    # Song constants
    bpm = 75.0
    duration_seconds = 231.0
    offset = 0.20  # tune this if everything feels globally early/late

    # IMPORTANT: match these to your Phaser layout values
    # If you don't know them exactly, start with these and adjust:
    spawn_y = -60.0
    hit_y = 600.0   # <-- change to your actual hitY in pixels if you want perfect sync

    # 6 stages (time in seconds)
    stages = [
        dict(start=0.0,   end=35.0,  msg="Stage 1: tutorial mode. Try not to trip."),
        dict(start=35.0,  end=70.0,  msg="Stage 2: okay, you can tap."),
        dict(start=70.0,  end=105.0, msg="Stage 3: I regret believing in you."),
        dict(start=105.0, end=145.0, msg="Stage 4: hands? shaking? good."),
        dict(start=145.0, end=190.0, msg="Stage 5: focus. or perish."),
        dict(start=190.0, end=231.0, msg="Stage 6: final. prove it."),
    ]

    # Difficulty ramp per stage
    # grid_beats: 1.0 quarters, 0.5 eighths, 0.25 sixteenths
    params = [
        dict(grid_beats=1.0, density=0.70, max_gap_beats=2.0, speed=320.0, jumpiness=0.05),
        dict(grid_beats=0.5, density=0.45, max_gap_beats=2.0, speed=360.0, jumpiness=0.10),
        dict(grid_beats=0.5, density=0.55, max_gap_beats=1.5, speed=400.0, jumpiness=0.18),
        dict(grid_beats=0.5, density=0.65, max_gap_beats=1.0, speed=440.0, jumpiness=0.25),
        dict(grid_beats=0.25, density=0.38, max_gap_beats=1.0, speed=480.0, jumpiness=0.35),
        dict(grid_beats=0.25, density=0.48, max_gap_beats=0.75, speed=520.0, jumpiness=0.45),
    ]

    all_notes: List[Note] = []
    for i, st in enumerate(stages, start=1):
        p = params[i - 1]
        all_notes.extend(generate_stage_notes(
            rng=rng,
            bpm=bpm,
            offset=offset,
            stage_index=i,
            stage_start=st["start"],
            stage_end=st["end"],
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

    # Sort by spawn time (since the game will spawn by spawn)
    all_notes.sort(key=lambda n: n.spawn)

    out: List[Dict] = [
        {"spawn": round(n.spawn, 4), "hit": round(n.hit, 4), "lane": n.lane, "stage": n.stage, "speed": round(n.speed, 2)}
        for n in all_notes
        if 0.0 <= n.hit <= duration_seconds
    ]

    with open("chart.json", "w") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(out)} notes to chart.json")


if __name__ == "__main__":
    main()
