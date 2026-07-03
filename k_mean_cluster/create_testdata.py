# Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import sys
import os
import time
import json
import argparse

# 1. Dependency Guard ---------------------------------------------------------
try:
    import numpy as np
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except ImportError:
    print("Missing required package: numpy and/or matplotlib")
    print("\nUse a virtual environment:\n")
    print("  python3 -m venv venv")
    print("  source venv/bin/activate")
    print("  pip install numpy matplotlib")
    sys.exit(1)


# Logging / timing helpers ----------------------------------------------------
n_sec__start_global = time.time()
o_timing = {}


let_print = print  # keep a stable reference


f_log = lambda s_msg: let_print(f"[{f_s_elapsed()}] {s_msg}")


def f_s_elapsed():
    """Return the elapsed wall-clock time since program start as mm:ss.mmm."""
    n_sec__elapsed = time.time() - n_sec__start_global
    n_min = int(n_sec__elapsed // 60)
    n_sec = n_sec__elapsed - n_min * 60
    return f"{n_min:02d}:{n_sec:06.3f}"


def f_v_timed(s_name, f_callback):
    """Run f_callback, record its elapsed seconds under s_name, return its result."""
    f_log(f"{s_name} ...")
    n_sec__start = time.time()
    v_result = f_callback()
    n_sec__delta = time.time() - n_sec__start
    o_timing[s_name] = n_sec__delta
    f_log(f"{s_name} complete ({n_sec__delta:.3f}s)")
    return v_result


# Pattern generators (each returns an array of numbers: one dataset) ----------
def f_a_n_linear__increasing(n_noise=0.5):
    """Points roughly following an increasing line."""
    a_n_base = np.linspace(-18, 18, 20)
    a_n_noise = np.random.normal(0, n_noise, 20)
    return a_n_base + a_n_noise


def f_a_n_linear__decreasing(n_noise=0.5):
    """Points roughly following a decreasing line."""
    a_n_base = np.linspace(18, -18, 20)
    a_n_noise = np.random.normal(0, n_noise, 20)
    return a_n_base + a_n_noise


def f_a_n_shape__v(n_noise=0.5):
    """V-shaped pattern."""
    a_n_left = np.linspace(-18, 0, 10)
    a_n_right = np.linspace(0, -18, 10)
    a_n_base = np.concatenate([a_n_left, a_n_right])
    a_n_noise = np.random.normal(0, n_noise, 20)
    return a_n_base + a_n_noise


def f_a_n_shape__inverted_v(n_noise=0.5):
    """Inverted V-shaped pattern."""
    a_n_left = np.linspace(-18, 0, 10)
    a_n_right = np.linspace(0, 18, 10)
    a_n_base = np.concatenate([a_n_left, a_n_right])
    a_n_noise = np.random.normal(0, n_noise, 20)
    return a_n_base + a_n_noise


def f_a_n_curve__s(n_noise=0.5):
    """S-shaped curve."""
    a_n_t = np.linspace(-3, 3, 20)
    a_n_base = 10 * np.sin(a_n_t) + 5 * a_n_t
    a_n_noise = np.random.normal(0, n_noise, 20)
    return a_n_base + a_n_noise


def f_a_n_cluster__bimodal(n_noise=0.5):
    """Two clusters of points."""
    a_n_cluster__low = np.random.normal(-10, 1, 10)
    a_n_cluster__high = np.random.normal(10, 1, 10)
    a_n_base = np.concatenate([a_n_cluster__low, a_n_cluster__high])
    a_n_noise = np.random.normal(0, n_noise, 20)
    return a_n_base + a_n_noise


def f_a_n_random__uniform(n_noise=0.5):
    """Completely random points (noise argument unused on purpose)."""
    return np.random.uniform(-18, 18, 20)


def f_a_n_wave__sine(n_noise=0.5):
    """Sine wave pattern."""
    a_n_t = np.linspace(0, 4 * np.pi, 20)
    a_n_base = 12 * np.sin(a_n_t)
    a_n_noise = np.random.normal(0, n_noise, 20)
    return a_n_base + a_n_noise


# Dataset assembly ------------------------------------------------------------
def f_o_dataset(n_cnt__sample=1000, n_noise=0.5):
    """
    Generate datasets with different patterns.
    Each dataset has 20 x-coordinates between -20 and 20.
    Returns an object with the shuffled data and matching pattern labels.
    """
    a_o_pattern = [
        {"s_name": "linear_increasing", "f_a_n": f_a_n_linear__increasing},
        {"s_name": "linear_decreasing", "f_a_n": f_a_n_linear__decreasing},
        {"s_name": "v_shape", "f_a_n": f_a_n_shape__v},
        {"s_name": "inverted_v", "f_a_n": f_a_n_shape__inverted_v},
        {"s_name": "s_curve", "f_a_n": f_a_n_curve__s},
        {"s_name": "clusters_bimodal", "f_a_n": f_a_n_cluster__bimodal},
        {"s_name": "random_uniform", "f_a_n": f_a_n_random__uniform},
        {"s_name": "sine_wave", "f_a_n": f_a_n_wave__sine},
    ]

    n_its_pattern = len(a_o_pattern)
    n_cnt__per_pattern = n_cnt__sample // n_its_pattern

    a_a_n_data = []   # array of datasets (each dataset is an array of numbers)
    a_s_label = []    # for verification (wouldn't have these in real unsupervised)

    for n_it_pattern in range(n_its_pattern):
        o_pattern = a_o_pattern[n_it_pattern]
        for _ in range(n_cnt__per_pattern):
            a_n_data = o_pattern["f_a_n"](n_noise)
            a_a_n_data.append(a_n_data)
            a_s_label.append(o_pattern["s_name"])

    # Shuffle
    a_n_idx = np.random.permutation(len(a_a_n_data))
    return {
        "a_a_n_data": np.array(a_a_n_data)[a_n_idx],
        "a_s_label": np.array(a_s_label)[a_n_idx],
    }


# Visualization ---------------------------------------------------------------
def f_visualize(a_a_n_data, a_s_label, n_cnt__row=5, s_path__out="samples.png"):
    """Render a grid of random sample datasets and save it to s_path__out."""
    n_its_col = 3
    o_fig, a_a_o_ax = plt.subplots(n_cnt__row, n_its_col, figsize=(15, 10))

    for n_it_row in range(n_cnt__row):
        for n_it_col in range(n_its_col):
            n_idx = np.random.randint(0, len(a_a_n_data))
            o_ax = a_a_o_ax[n_it_row, n_it_col]
            o_ax.scatter(a_a_n_data[n_idx], np.zeros(20), alpha=0.6)
            o_ax.set_ylim(-1, 1)
            o_ax.set_xlim(-22, 22)
            o_ax.set_title(f"Pattern: {a_s_label[n_idx]}")
            o_ax.set_yticks([])

    plt.tight_layout()
    plt.savefig(s_path__out)
    plt.close(o_fig)


# IPC helpers -----------------------------------------------------------------
def f_s_uuid(s_uuid__arg):
    """Resolve S_UUID from the --s-uuid argument, then from a local .env file."""
    if s_uuid__arg:
        return s_uuid__arg
    s_path__env = os.path.join(os.getcwd(), ".env")
    if os.path.exists(s_path__env):
        with open(s_path__env, "r") as o_file:
            for s_line in o_file:
                if s_line.startswith("S_UUID="):
                    return s_line.split("=", 1)[1].strip()
    return None


def f_emit__ipc(s_uuid, o_payload):
    """Emit a tagged machine-readable json block to stdout, if S_UUID is known."""
    if not s_uuid:
        return
    print(f"{s_uuid}_start_json")
    print(json.dumps(o_payload))
    print(f"{s_uuid}_end_json")


# Argument parsing ------------------------------------------------------------
def f_o_arg():
    """Parse CLI arguments and print a summary table of provided/default values."""
    o_parser = argparse.ArgumentParser(
        description="Generate pattern test datasets for unsupervised learning."
    )
    o_parser.add_argument("--samples", type=int, default=1000,
                          help="total number of samples to generate")
    o_parser.add_argument("--noise", type=float, default=0.8,
                          help="noise level applied to each pattern")
    o_parser.add_argument("--output", type=str, default="samples.png",
                          help="path of the visualization image to write")
    o_parser.add_argument("--s-uuid", type=str, default=None,
                          help="S_UUID for machine-readable IPC blocks")
    o_arg = o_parser.parse_args()

    a_o_row = [
        ("--samples", o_arg.samples, "--samples" in sys.argv),
        ("--noise", o_arg.noise, "--noise" in sys.argv),
        ("--output", o_arg.output, "--output" in sys.argv),
        ("--s-uuid", o_arg.s_uuid, "--s-uuid" in sys.argv),
    ]
    print("  ┌ Arguments ────────────────────────┐")
    for s_name, v_val, b_provided in a_o_row:
        s_src = "(provided)" if b_provided else "(default)"
        print(f"  │ {s_name:<12} {str(v_val):<14} {s_src:<11}│")
    print("  └──────────────────────────────────────┘")
    return o_arg


# Performance summary ---------------------------------------------------------
def f_print__performance():
    """Print the timing summary table for every measured function."""
    print("  ┌ Performance ───────────────────┐")
    n_sec__total = 0.0
    for s_name, n_sec in o_timing.items():
        print(f"  │ {s_name:<20} {n_sec:>7.3f}s          │")
        n_sec__total += n_sec
    print("  │ ───────────────────────────    │")
    print(f"  │ {'Total':<20} {n_sec__total:>7.3f}s          │")
    print("  └──────────────────────────────────────┘")


# Entry point -----------------------------------------------------------------
def f_main():
    o_arg = f_o_arg()
    s_uuid = f_s_uuid(o_arg.s_uuid)

    try:
        o_dataset = f_v_timed(
            "generate_dataset",
            lambda: f_o_dataset(n_cnt__sample=o_arg.samples, n_noise=o_arg.noise),
        )
        a_a_n_data = o_dataset["a_a_n_data"]
        a_s_label = o_dataset["a_s_label"]

        f_v_timed(
            "visualize_sample",
            lambda: f_visualize(a_a_n_data, a_s_label, s_path__out=o_arg.output),
        )
    except Exception as o_err:
        f_log(f"Processing error: {o_err}")
        f_emit__ipc(s_uuid, {"status": "error", "message": str(o_err)})
        sys.exit(2)

    f_emit__ipc(s_uuid, {
        "status": "complete",
        "output_path": o_arg.output,
        "samples": int(len(a_a_n_data)),
        "elapsed_s": round(time.time() - n_sec__start_global, 3),
    })

    f_print__performance()
    sys.exit(0)


if __name__ == "__main__":
    f_main()
