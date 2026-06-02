"""Assign a stable display_name to every persona row in
disc-app/data/personas/*.jsonl. Idempotent: re-running preserves existing
display_names unless --overwrite is passed.

Names are drawn from a curated pool of 86 distinct first names (with last
initials where needed to disambiguate), one per persona. The mapping is
position-stable: row N of file F always gets the same name. Sims that
reuse the same persona row therefore show the same display_name across
all sims — that's the point. A user who likes "Frank" can find Frank
again.

Run:
    python scripts/assign-display-names.py            # safe (skips existing)
    python scripts/assign-display-names.py --overwrite # re-roll all names

After running, upload-personas.sh to push the new files to the Fly volume.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

PERSONAS_DIR = Path(__file__).parent.parent / "data" / "personas"

# 86 names. Roughly grouped to match each file's voice, though the assignment
# is positional, not semantic — once a row gets a name, that's the name
# forever. Diverse enough to feel like a real forum cast.

# personas_sarc.jsonl — 12 rows. Spicy sarcastic voice. Punchy short names.
SARC_NAMES = [
    "Frank",   "Marlene", "Otis",    "Reggie",
    "Dot",     "Hank",    "Bea",     "Vince",
    "Wanda",   "Cyrus",   "Ida",     "Mort",
]

# personas_hn_spicy.jsonl — 6 rows. HN denier voice. Tech-skeptic flavored.
HN_SPICY_NAMES = [
    "Garrett", "Pria",    "Eshan",   "Marcus",
    "Lina",    "Yusuf",
]

# personas_creative.jsonl — 18 rows. Creative/constructive voice. Warmer names.
CREATIVE_NAMES = [
    "Iris",    "Theo",    "Mira",    "Alvaro",
    "Juno",    "Sasha",   "Felix",   "Noor",
    "Cleo",    "Soren",   "Edith",   "Kai",
    "Rosa",    "Wren",    "August",  "Maeve",
    "Tomasz",  "Ines",
]

# personas_adversarial.jsonl — 50 rows. Adversarial reviewers / cranks.
# Bigger pool needed. Mix of common + slightly unusual.
ADVERSARIAL_NAMES = [
    "Greg",    "Tina",    "Brad",    "Sue",
    "Doug",    "Lana",    "Chuck",   "Phyllis",
    "Earl",    "Renata",  "Wes",     "Maxine",
    "Stu",     "Marge",   "Lou",     "Ada",
    "Burt",    "Helga",   "Roy",     "Ginny",
    "Saul",    "Beverly", "Curt",    "Joanne",
    "Mel",     "Rhoda",   "Norm",    "Carla",
    "Vern",    "Estelle", "Russ",    "Pam",
    "Glenn",   "Mavis",   "Dale",    "Lila",
    "Bart",    "Trudy",   "Clyde",   "Nadia",
    "Walt",    "Bonnie",  "Rod",     "Cora",
    "Floyd",   "Dee",     "Murray",  "Sybil",
    "Joey",    "Imelda",
]

POOLS = {
    "personas_sarc.jsonl":        SARC_NAMES,
    "personas_hn_spicy.jsonl":    HN_SPICY_NAMES,
    "personas_creative.jsonl":    CREATIVE_NAMES,
    "personas_adversarial.jsonl": ADVERSARIAL_NAMES,
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--overwrite", action="store_true",
                        help="Replace existing display_name values (default: keep them).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would change but don't write files.")
    args = parser.parse_args()

    # Sanity check: total names == total rows == 86.
    total_names = sum(len(p) for p in POOLS.values())
    if total_names != 86:
        print(f"FAIL: pool sizes total {total_names}, expected 86")
        return 1
    # No duplicate names across all pools (collisions would defeat the
    # "Frank is one person" promise).
    seen: dict[str, str] = {}
    for fname, names in POOLS.items():
        for n in names:
            if n in seen:
                print(f"FAIL: {n!r} appears in both {seen[n]} and {fname}")
                return 1
            seen[n] = fname

    for fname, names in POOLS.items():
        path = PERSONAS_DIR / fname
        if not path.exists():
            print(f"SKIP: {path} (file not found)")
            continue
        rows = [json.loads(L) for L in path.read_text().splitlines() if L.strip()]
        if len(rows) != len(names):
            print(f"FAIL: {fname} has {len(rows)} rows but pool has {len(names)} names")
            return 1
        changed = 0
        for i, (row, name) in enumerate(zip(rows, names)):
            existing = row.get("display_name")
            if existing and not args.overwrite:
                continue  # preserve manual edits
            if existing == name:
                continue  # no change needed
            row["display_name"] = name
            changed += 1
        if args.dry_run:
            print(f"{fname}: would change {changed} of {len(rows)} rows")
            continue
        if changed:
            with path.open("w") as f:
                for row in rows:
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"{fname}: wrote {changed} display_names ({len(rows)} rows total)")

    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
