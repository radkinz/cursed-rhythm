import json
import random
from dataclasses import dataclass
from typing import List, Dict, Optional

#constants
HOLD_PROB = 0.12        # 12% of notes are holds
HOLD_MIN_BEATS = 1.0   # minimum hold length
HOLD_MAX_BEATS = 3.0   # maximum hold length

@dataclass
class Note:
    hit: float
    spawn: float
    lane: int
    stage: int
    speed: float
    type: str        # "tap" or "hold"
    end: float       # end hit time (== hit for taps)

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

    weights = []
    for l in candidates:
        d = abs(l - prev_lane)
        base = 1.0 / (1.0 + d)  # nearer lanes heavier
        w = (1.0 - jumpiness) * base + jumpiness * 1.0  # blend with uniform
        weights.append(w)

    return rng.choices(candidates, weights=weights, k=1)[0]


def generate_stage_notes(
    rng: random.Random,
    *,
    bpm: float,
    offset: float,
    stage_index: int,
    hit_start: float,
    hit_end: float,
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
    spb = 60.0 / bpm

    start_beat = max(0.0, (hit_start - offset) / spb)
    end_beat = max(0.0, (hit_end - offset) / spb)

    b = (start_beat // grid_beats) * grid_beats
    if b < start_beat:
        b += grid_beats

    travel_time = (hit_y - spawn_y) / speed

    notes: List[Note] = []
    prev_lane: Optional[int] = None
    gap_beats = max_gap_beats  # encourage early note

    while b <= end_beat:
        should_place = (rng.random() < density) or (gap_beats >= max_gap_beats)

        if should_place:
            lane = pick_lane(
                rng, prev_lane,
                no_jacks=no_jacks,
                prefer_nearby=prefer_nearby,
                jumpiness=jumpiness,
            )

            hit_t = offset + b * spb
            spawn_t = hit_t - travel_time

            if hit_start <= hit_t <= hit_end and spawn_t >= 0.0:
                # Decide tap vs hold
                is_hold = rng.random() < HOLD_PROB
                hold_beats = rng.uniform(HOLD_MIN_BEATS, HOLD_MAX_BEATS) if is_hold else 0.0
                end_hit_t = hit_t + hold_beats * spb

                # Clamp hold end so it doesn't cross stage end
                end_hit_t = min(end_hit_t, hit_end)

                # Recompute spawn based on *start* hit
                spawn_t = hit_t - travel_time

                if hit_start <= hit_t <= hit_end and spawn_t >= 0.0:
                    notes.append(Note(
                        hit=hit_t,
                        spawn=spawn_t,
                        lane=lane,
                        stage=stage_index,
                        speed=speed,
                        # NEW FIELDS
                        type="hold" if is_hold and end_hit_t > hit_t else "tap",
                        end=end_hit_t if is_hold and end_hit_t > hit_t else hit_t,
                    ))
                    prev_lane = lane
                    gap_beats = 0.0

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

    # --- Song constants ---
    bpm = 75.0
    duration_seconds = 231.0
    offset = 0.20

    # --- Match Phaser geometry ---
    spawn_y = -60.0
    hit_y = 600.0   # IMPORTANT: set this to your Phaser hitY for perfect visual sync

    # --- Popup timing (must match your showStagePopup total on-screen time) ---
    popup_seconds = 1.4

    # --- Miss window in pixels in your Phaser code ---
    miss_px = 60.0

    # Raw conceptual stage boundaries (where popup triggers)
    boundaries = [0.0, 35.0, 70.0, 105.0, 145.0, 190.0, 231.0]  # 6 stages

    # Difficulty ramp per stage
    params = [
        dict(grid_beats=1.0,  density=0.70, max_gap_beats=2.0,  speed=320.0, jumpiness=0.05),
        dict(grid_beats=0.5,  density=0.45, max_gap_beats=2.0,  speed=360.0, jumpiness=0.10),
        dict(grid_beats=0.5,  density=0.55, max_gap_beats=1.5,  speed=400.0, jumpiness=0.18),
        dict(grid_beats=0.5,  density=0.65, max_gap_beats=1.0,  speed=440.0, jumpiness=0.25),
        dict(grid_beats=0.25, density=0.38, max_gap_beats=1.0,  speed=480.0, jumpiness=0.35),
        dict(grid_beats=0.25, density=0.48, max_gap_beats=0.75, speed=520.0, jumpiness=0.45),
    ]

    all_notes: List[Note] = []

    # Build per-stage HIT windows that guarantee:
    # - no SPAWNS during popup
    # - last note clears hit line before popup
    for stage_idx in range(1, 7):
        start_boundary = boundaries[stage_idx - 1]
        end_boundary = boundaries[stage_idx]
        p = params[stage_idx - 1]
        speed = p["speed"]

        travel_time = (hit_y - spawn_y) / speed
        clear_time = miss_px / speed  # time after hit until it passes hitY+missPx

        # Notes should STOP early enough that they're gone by popup start at end_boundary
        hit_end = end_boundary - clear_time

        # Notes should START late enough that their SPAWN occurs after popup ends.
        # For stages after the first, popup happens at start_boundary.
        if stage_idx == 1:
            hit_start = start_boundary
        else:
            hit_start = start_boundary + popup_seconds + travel_time

        # Also: avoid generating hits during the popup window after end_boundary (except last stage)
        if stage_idx < 6:
            # This isn't strictly necessary if you compute next stage start correctly,
            # but it prevents edge cases near boundaries.
            hit_end = min(hit_end, end_boundary - 0.01)

        # Clamp to song duration
        hit_start = max(0.0, hit_start)
        hit_end = min(duration_seconds, hit_end)

        if hit_end <= hit_start:
            raise ValueError(
                f"Stage {stage_idx} has no playable time.\n"
                f"Try reducing popup_seconds or miss_px, or lowering speed.\n"
                f"(hit_start={hit_start:.3f}, hit_end={hit_end:.3f})"
            )

        notes = generate_stage_notes(
            rng,
            bpm=bpm,
            offset=offset,
            stage_index=stage_idx,
            hit_start=hit_start,
            hit_end=hit_end,
            grid_beats=p["grid_beats"],
            density=p["density"],
            max_gap_beats=p["max_gap_beats"],
            speed=speed,
            spawn_y=spawn_y,
            hit_y=hit_y,
            no_jacks=True,
            prefer_nearby=True,
            jumpiness=p["jumpiness"],
        )
        all_notes.extend(notes)

        print(
            f"Stage {stage_idx}: hits in [{hit_start:.2f}, {hit_end:.2f}] "
            f"(speed={speed:.0f}px/s, travel={travel_time:.2f}s, clear={clear_time:.2f}s)"
        )

    all_notes.sort(key=lambda n: n.spawn)

    out = [
        {
            "spawn": round(n.spawn, 4),
            "hit": round(n.hit, 4),
            "end": round(n.end, 4),
            "lane": n.lane,
            "stage": n.stage,
            "speed": round(n.speed, 2),
            "type": n.type,
        }
        for n in all_notes
    ]

    with open("chart.json", "w") as f:
        json.dump(out, f, indent=2)

    print(f"\nWrote {len(out)} notes to chart.json")


if __name__ == "__main__":
    main()
