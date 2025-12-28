import json
import random
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import librosa


@dataclass
class Event:
    hit: float
    end: float          # == hit for taps; > hit for holds
    type: str           # "tap" or "hold"


@dataclass
class Note:
    spawn: float
    hit: float
    end: float
    lane: int
    stage: int
    speed: float
    type: str           # "tap" or "hold"


# -------------------------
# Helpers
# -------------------------
def make_fixed_grid(duration_s: float, bpm: float, subdiv_per_beat: int, beat0: float) -> np.ndarray:
    """Fixed BPM grid times. subdiv_per_beat: 1=quarters, 2=eighths, 4=sixteenths."""
    spb = 60.0 / bpm
    dt = spb / subdiv_per_beat
    n = int(np.floor((duration_s - beat0) / dt)) + 1
    t = beat0 + np.arange(max(n, 1), dtype=float) * dt
    return t[(t >= 0.0) & (t <= duration_s)]


def estimate_beat0(
    *,
    bpm: float,
    duration: float,
    onset_times_env: np.ndarray,
    onset_env: np.ndarray,
    search_window: Tuple[float, float] = (0.0, 45.0),
    grid_subdiv: int = 1,
    steps: int = 240,
) -> float:
    """Auto-find beat0 in [0, spb) that maximizes onset strength sampled on a beat grid."""
    spb = 60.0 / bpm
    t_min, t_max = search_window
    t_max = min(t_max, duration)

    best_o = 0.0
    best_score = -1e18

    for o in np.linspace(0.0, spb, steps, endpoint=False):
        grid = make_fixed_grid(duration_s=duration, bpm=bpm, subdiv_per_beat=grid_subdiv, beat0=o)
        grid = grid[(grid >= t_min) & (grid <= t_max)]
        if len(grid) == 0:
            continue
        s = np.interp(grid, onset_times_env, onset_env)
        score = float(np.sum(s))
        if score > best_score:
            best_score = score
            best_o = float(o)

    return best_o


def build_stage_hit_window(
    *,
    stage_idx: int,
    start_boundary: float,
    end_boundary: float,
    speed: float,
    spawn_y: float,
    hit_y: float,
    popup_seconds: float,
    miss_px: float,
    song_duration: float,
) -> Tuple[float, float, float]:
    """
    Returns (hit_start, hit_end, travel_time) for this stage.
    Ensures no notes are on screen during popups by:
    - start hits late enough that spawn happens after popup ends (except stage 1)
    - end hits early enough that misses clear before popup starts
    """
    travel_time = (hit_y - spawn_y) / speed
    clear_time = miss_px / speed

    if stage_idx == 1:
        hit_start = start_boundary
    else:
        hit_start = start_boundary + popup_seconds + travel_time

    hit_end = end_boundary - clear_time
    hit_start = max(0.0, hit_start)
    hit_end = min(song_duration, hit_end)
    return hit_start, hit_end, travel_time


def thin_by_gap(times: np.ndarray, min_gap_s: float) -> List[float]:
    """Keep times such that consecutive kept times are at least min_gap_s apart."""
    out: List[float] = []
    last = -1e9
    for t in times:
        t = float(t)
        if t - last >= min_gap_s:
            out.append(t)
            last = t
    return out


def enforce_max_gap_on_grid(
    chosen: np.ndarray,
    grid: np.ndarray,
    hit_start: float,
    hit_end: float,
    max_gap_s: float,
    fill_rate: int = 1,
) -> np.ndarray:
    """
    Prevent long dead zones:
    - fills BETWEEN notes (like before)
    - ALSO fills at EDGES: [hit_start -> first] and [last -> hit_end]
    Inserts up to fill_rate grid-aligned hits per oversized gap.
    """
    chosen = np.array(sorted([float(t) for t in chosen if hit_start <= t <= hit_end]), dtype=float)
    stage_grid = grid[(grid >= hit_start) & (grid <= hit_end)]
    if len(stage_grid) == 0:
        return chosen

    # If empty, seed with one note near the middle so we can fill from edges
    if len(chosen) == 0:
        mid = float(stage_grid[len(stage_grid) // 2])
        chosen = np.array([mid], dtype=float)

    def insert_between(a: float, b: float, filled_list: List[float]):
        gap = b - a
        if gap <= max_gap_s:
            return
        between = stage_grid[(stage_grid > a) & (stage_grid < b)]
        if len(between) == 0:
            return
        k = min(fill_rate, len(between))
        idxs = np.linspace(0, len(between) - 1, k + 2)[1:-1].astype(int)
        for idx in idxs:
            filled_list.append(float(between[idx]))

    filled: List[float] = []

    # --- EDGE 1: stage start -> first note
    first = float(chosen[0])
    filled.append(first)
    insert_between(hit_start, first, filled)

    # --- MIDDLES: between notes
    for a, b in zip(chosen[:-1], chosen[1:]):
        a = float(a); b = float(b)
        insert_between(a, b, filled)
        filled.append(b)

    # --- EDGE 2: last note -> stage end
    last = float(chosen[-1])
    insert_between(last, hit_end, filled)

    # unique + sorted
    return np.array(sorted(set(np.round(filled, 4))), dtype=float)


def cluster_to_holds(
    hit_times: List[float],
    *,
    cluster_gap_s: float,
    hold_min_s: float,
    hit_end_limit: float,
) -> List[Event]:
    """
    Deterministic holds:
    - If consecutive hits are closer than cluster_gap_s, convert that run into ONE hold
      from first hit to last hit in the run.
    """
    if not hit_times:
        return []

    events: List[Event] = []
    i = 0
    n = len(hit_times)

    while i < n:
        start = hit_times[i]
        end = start
        j = i

        while j + 1 < n and (hit_times[j + 1] - hit_times[j]) <= cluster_gap_s:
            end = hit_times[j + 1]
            j += 1

        end = min(end, hit_end_limit)

        if end - start >= hold_min_s:
            events.append(Event(hit=start, end=end, type="hold"))
            i = j + 1
        else:
            events.append(Event(hit=start, end=start, type="tap"))
            i += 1

    return events


def pick_lane_available(
    rng: random.Random,
    prev_lane: Optional[int],
    lane_busy_until: List[float],
    t: float,
    jumpiness: float,
) -> int:
    """Choose a lane that isn't currently held at time t. Prefer nearby lanes unless jumpy."""
    lanes = [0, 1, 2, 3]
    available = [l for l in lanes if lane_busy_until[l] <= t]
    if not available:
        available = lanes

    if prev_lane is None or prev_lane not in available:
        return rng.choice(available)

    weights = []
    for l in available:
        d = abs(l - prev_lane)
        base = 1.0 / (1.0 + d)
        w = (1.0 - jumpiness) * base + jumpiness * 1.0
        weights.append(w)

    return rng.choices(available, weights=weights, k=1)[0]


# -------------------------
# Main
# -------------------------
def main():
    rng = random.Random(42)

    mp3_path = "song.mp3"
    out_path = "chart.json"

    bpm = 75.0

    # Match Phaser
    popup_seconds = 1.4
    miss_px = 60.0
    spawn_y = -60.0
    hit_y = 600.0

    # Your stage boundaries (keep as-is)
    boundaries = [0.0, 15.0, 30.0, 75.0, 110.0, 160.0, 231.0]

    # Must match in-game stage speeds
    stage_speeds = [320.0, 360.0, 400.0, 440.0, 480.0, 520.0]

    # Difficulty ramp (tweak here)
    stage_subdiv =    [1, 2, 2, 2, 4, 4]
    stage_keep =      [0.40, 0.50, 0.60, 0.65, 0.70, 0.85]   # stage 6 harder
    stage_min_gap =   [0.35, 0.33, 0.30, 0.28, 0.24, 0.19]   # stage 6 denser
    stage_jumpiness = [0.15, 0.20, 0.22, 0.22, 0.26, 0.45]   # stage 6 more lane movement

    # Holds from clusters (NOT random)
    hold_min_s = 0.40
    stage_cluster_gap = [0.42, 0.38, 0.32, 0.28, 0.26, 0.22]  # slightly fewer holds late

    # NEW: max-gap enforcement per stage (fix gaps in 3 & 4 too)
    # max allowed silence between notes in that stage
    stage_max_gap =   [1.00, 1.00, 1.00, 1.00, 1.00, 0.85]   # stage 6 constant pressure
    # how many fillers can be inserted inside an oversized gap
    stage_fill_rate = [1,    1,    3,    1,    2,    2]

    # Make stage 6 more tap-heavy by preventing too many clusters from collapsing into holds:
    # If you want *more* holds in stage 6, raise this.
    stage6_holds_enabled = False

    global_offset = 0.00

    # Load audio
    y, sr = librosa.load(mp3_path, sr=None, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_env = np.maximum(onset_env, 0.0)
    if np.max(onset_env) > 1e-9:
        onset_env = onset_env / np.max(onset_env)
    onset_times_env = librosa.times_like(onset_env, sr=sr)

    beat0 = estimate_beat0(
        bpm=bpm,
        duration=duration,
        onset_times_env=onset_times_env,
        onset_env=onset_env,
        search_window=(0.0, 45.0),
        grid_subdiv=1,
        steps=240,
    )
    print(f"Estimated beat0 ≈ {beat0:.4f}s (BPM={bpm})")

    notes: List[Note] = []
    prev_lane: Optional[int] = None

    for stage_idx in range(1, 7):
        start_boundary = boundaries[stage_idx - 1]
        end_boundary = boundaries[stage_idx]
        speed = stage_speeds[stage_idx - 1]

        hit_start, hit_end, travel_time = build_stage_hit_window(
            stage_idx=stage_idx,
            start_boundary=start_boundary,
            end_boundary=end_boundary,
            speed=speed,
            spawn_y=spawn_y,
            hit_y=hit_y,
            popup_seconds=popup_seconds,
            miss_px=miss_px,
            song_duration=duration,
        )
        if hit_end <= hit_start:
            print(f"Stage {stage_idx}: no playable window.")
            continue

        subdiv = stage_subdiv[stage_idx - 1]
        keep_frac = stage_keep[stage_idx - 1]
        min_gap = stage_min_gap[stage_idx - 1]
        jumpiness = stage_jumpiness[stage_idx - 1]
        cluster_gap = stage_cluster_gap[stage_idx - 1]

        max_gap = stage_max_gap[stage_idx - 1]
        fill_rate = stage_fill_rate[stage_idx - 1]

        # Beat-locked candidate times
        grid = make_fixed_grid(duration_s=duration, bpm=bpm, subdiv_per_beat=subdiv, beat0=beat0)
        cand = grid[(grid >= hit_start) & (grid <= hit_end)]
        if len(cand) == 0:
            print(f"Stage {stage_idx}: empty grid window.")
            continue

        scores = np.interp(cand, onset_times_env, onset_env)
        scores = scores ** 1.6  # peak emphasis

        k = max(1, int(len(cand) * keep_frac))
        top_idx = np.argpartition(scores, -k)[-k:]
        chosen = np.sort(cand[top_idx])

        # Fill long gaps on-grid (per stage)
        if max_gap is not None and len(chosen) >= 2:
            chosen = enforce_max_gap_on_grid(
                chosen=chosen,
                grid=grid,
                hit_start=hit_start,
                hit_end=hit_end,
                max_gap_s=max_gap,
                fill_rate=fill_rate,
            )

        # Enforce minimum gap
        thinned = thin_by_gap(chosen, min_gap_s=min_gap)
        thinned = [t + global_offset for t in thinned]
        thinned = [t for t in thinned if hit_start <= t <= hit_end]

        # Turn clusters into holds (optionally disabled for stage 6 to make it harder)
        if stage_idx == 6 and not stage6_holds_enabled:
            events = [Event(hit=t, end=t, type="tap") for t in thinned]
        else:
            events = cluster_to_holds(
                thinned,
                cluster_gap_s=cluster_gap,
                hold_min_s=hold_min_s,
                hit_end_limit=hit_end,
            )

        lane_busy_until = [0.0, 0.0, 0.0, 0.0]
        stage_notes = 0
        hold_count = 0

        for ev in events:
            lane = pick_lane_available(rng, prev_lane, lane_busy_until, ev.hit, jumpiness=jumpiness)
            prev_lane = lane

            spawn = ev.hit - travel_time
            if spawn < 0.0:
                continue

            if ev.type == "hold":
                lane_busy_until[lane] = max(lane_busy_until[lane], ev.end)
                hold_count += 1

            notes.append(Note(
                spawn=spawn,
                hit=ev.hit,
                end=ev.end,
                lane=lane,
                stage=stage_idx,
                speed=speed,
                type=ev.type,
            ))
            stage_notes += 1

        print(
            f"Stage {stage_idx}: subdiv={subdiv} cand={len(cand)} keep={keep_frac:.2f} "
            f"minGap={min_gap:.2f}s maxGap={max_gap:.2f}s fill={fill_rate} "
            f"notes={stage_notes} holds={hold_count}"
        )

    notes.sort(key=lambda n: n.spawn)

    out: List[Dict] = [
        {
            "spawn": round(n.spawn, 4),
            "hit": round(n.hit, 4),
            "end": round(n.end, 4),
            "lane": n.lane,
            "stage": n.stage,
            "speed": round(n.speed, 2),
            "type": n.type,
        }
        for n in notes
        if 0.0 <= n.hit <= duration
    ]

    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)

    print(f"\nWrote {out_path} | notes={len(out)} | duration={duration:.2f}s")


if __name__ == "__main__":
    main()
