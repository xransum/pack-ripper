"""
pack-ripper scraper

Scrapes Beckett checklist pages and outputs structured JSON suitable for the
pack-ripper simulator. Each set gets its own file in the output directory.

Usage:
    python scraper/scrape.py --out src/data/sets
    python scraper/scrape.py --url https://www.beckett.com/news/2025-donruss-optic-football-cards/ --out src/data/sets

The scraper is designed to be re-runnable. It will overwrite existing files.
"""

import argparse
import json
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Default sets to scrape when no --url is given
# ---------------------------------------------------------------------------

DEFAULT_SETS = [
    {
        "url": "https://www.beckett.com/news/2025-donruss-optic-football-cards/",
        "id": "2025-donruss-optic-football",
        "name": "2025 Donruss Optic Football",
        "year": 2025,
        "sport": "football",
        "boxes_per_case": 12,
    },
]

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def fetch(url: str, retries: int = 3) -> BeautifulSoup:
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=20)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as exc:
            if attempt < retries - 1:
                wait = 2**attempt
                print(f"  [warn] fetch failed ({exc}), retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise


# ---------------------------------------------------------------------------
# Box configuration extraction
# ---------------------------------------------------------------------------

# Maps heading text patterns to a canonical box type key
BOX_TYPE_PATTERNS = [
    (r"hobby blaster", "hobby_blaster"),
    (r"1st off the line|fotl", "fotl"),
    (r"hobby mega", "hobby_mega"),
    (r"hobby box|hobby$", "hobby"),
    (r"mega box|mega$", "mega"),
    (r"h2 box|h2$", "h2"),
    (r"choice box|choice$", "choice"),
    (r"blaster box|blaster$", "blaster"),
]

# Which box types get the pack-based engine vs flat (guaranteed-contents) engine
PACK_BASED = {"hobby_blaster", "hobby", "fotl", "h2"}
FLAT_BASED = {"blaster", "mega", "hobby_mega", "choice"}


def classify_box_type(heading_text: str) -> str | None:
    text = heading_text.lower().strip()
    for pattern, key in BOX_TYPE_PATTERNS:
        if re.search(pattern, text):
            return key
    return None


def parse_guarantee_line(line: str) -> tuple[str, int] | None:
    """Parse a bullet like 'Autographs - 1' or 'Base Rated Rookies - 20'."""
    m = re.search(r"(.+?)\s*[-\u2013]\s*(\d+)", line)
    if m:
        label = m.group(1).strip()
        count = int(m.group(2))
        return label, count
    return None


def extract_box_configs(soup: BeautifulSoup) -> dict:
    """
    Find all 'What to expect in a X box' sections and return a dict keyed
    by canonical box type.
    """
    boxes = {}
    headings = soup.find_all(["h3", "h4"], string=re.compile(r"what to expect", re.I))

    for heading in headings:
        box_key = classify_box_type(heading.get_text())
        if not box_key:
            continue

        guarantees = {}
        ul = heading.find_next_sibling("ul")
        if ul:
            for li in ul.find_all("li"):
                result = parse_guarantee_line(li.get_text())
                if result:
                    label, count = result
                    guarantees[label] = count

        # Derive pack config from the at-a-glance table when available
        boxes[box_key] = {
            "label": heading.get_text()
            .lower()
            .replace("what to expect in a ", "")
            .replace("what to expect in an ", "")
            .strip()
            .title(),
            "tier": "pack" if box_key in PACK_BASED else "flat",
            "guarantees": guarantees,
        }

    return boxes


def extract_pack_config(soup: BeautifulSoup) -> dict:
    """
    Extract cards-per-pack and packs-per-box from the 'at a glance' section.
    Returns a dict keyed by box type key with {packs, cards_per_pack}.
    """
    config = {}
    glance = soup.find(string=re.compile(r"cards per pack", re.I))
    if not glance:
        return config

    # The at-a-glance block is usually a <p> with multiple lines
    container = glance.find_parent()
    if not container:
        return config

    text = container.get_text(separator="\n")

    # Parse lines like:
    #   Cards per pack: Hobby - 4; FOTL - 4; Blaster - 4; Mega - 6; H2 - 4; Choice - 8
    #   Packs per box:  Hobby - 20; FOTL - 20; Blaster - 6; Mega - 7; H2 - 8; Choice - 1

    def parse_config_line(line: str) -> dict:
        result = {}
        parts = re.split(r"[;,]", line)
        for part in parts:
            m = re.search(r"([A-Za-z0-9 ]+?)\s*[-\u2013]\s*(\d+)", part)
            if m:
                label = m.group(1).strip().lower()
                val = int(m.group(2))
                for pattern, key in BOX_TYPE_PATTERNS:
                    if re.search(pattern, label):
                        result[key] = val
                        break
        return result

    for line in text.split("\n"):
        if re.search(r"cards per pack", line, re.I):
            after_colon = line.split(":", 1)[-1]
            cpp = parse_config_line(after_colon)
            for key, val in cpp.items():
                config.setdefault(key, {})["cards_per_pack"] = val
        elif re.search(r"packs per box", line, re.I):
            after_colon = line.split(":", 1)[-1]
            ppb = parse_config_line(after_colon)
            for key, val in ppb.items():
                config.setdefault(key, {})["packs_per_box"] = val
        elif re.search(r"boxes per case", line, re.I):
            after_colon = line.split(":", 1)[-1]
            bpc = parse_config_line(after_colon)
            for key, val in bpc.items():
                config.setdefault(key, {})["boxes_per_case"] = val

    return config


# ---------------------------------------------------------------------------
# Hobby blaster pack slot derivation
#
# Based on Jacob's breakdown:
#   6 packs x 4 cards
#   Each pack: 1 base rookie + 2 base veterans
#   3 of 6 packs: + 1 Blue Scope Rated Rookie parallel
#   1 of 6 packs: + 1 insert slot (hit-eligible)
# ---------------------------------------------------------------------------

HOBBY_BLASTER_PACK_SLOTS = [
    {"slot": "base_rookie", "count": 1, "pool": "rated_rookies", "every_pack": True},
    {"slot": "base", "count": 2, "pool": "base", "every_pack": True},
    {
        "slot": "parallel_rookie",
        "count": 1,
        "every_n_packs": 2,
        "parallel": "Blue Scope",
        "pool": "rated_rookies",
    },
    {
        "slot": "insert",
        "count": 1,
        "every_n_packs": 6,
        "hit_eligible": True,
    },
]


def build_pack_slots(box_key: str, guarantees: dict) -> list:
    """Return the pack slot definitions for a given box type."""
    if box_key == "hobby_blaster":
        return HOBBY_BLASTER_PACK_SLOTS
    # For other pack-based boxes derive simple slots from guarantees
    slots = [
        {
            "slot": "base_rookie",
            "count": guarantees.get("Base Rated Rookies", 0),
            "pool": "rated_rookies",
            "every_box": True,
        },
        {
            "slot": "auto",
            "count": guarantees.get("Autographs", 0),
            "pool": "autographs",
            "every_box": True,
        },
        {
            "slot": "insert",
            "count": guarantees.get("Inserts", 0),
            "pool": "inserts",
            "hit_eligible": True,
            "every_box": True,
        },
        {
            "slot": "holo_parallel",
            "count": guarantees.get("Holo Parallels", 0),
            "pool": "base",
            "parallel": "Holo",
            "every_box": True,
        },
        {
            "slot": "numbered_parallel",
            "count": guarantees.get("Additional Numbered Parallels", 0),
            "pool": "base",
            "numbered_only": True,
            "every_box": True,
        },
    ]
    return [s for s in slots if s["count"] > 0]


# ---------------------------------------------------------------------------
# Card list extraction
# ---------------------------------------------------------------------------


def extract_images(soup: BeautifulSoup) -> dict[str, str]:
    """
    Build a map of player name -> first matching Beckett CDN image URL.
    Images in the article body typically follow a heading for the card they show.
    """
    img_map = {}
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if "img.beckett.com" not in src and "beckett-www.s3" not in src:
            continue
        # Try alt text first, then figure caption, then nearby heading text
        alt = img.get("alt", "").strip()
        if alt:
            img_map[alt.lower()] = src
    return img_map


def parse_print_run(text: str) -> int | None:
    """Extract a print run integer from a string like 'Neon Blue /399'."""
    m = re.search(r"/\s*(\d+)", text)
    if m:
        return int(m.group(1))
    return None


def is_gold_vinyl(name: str) -> bool:
    return "gold vinyl" in name.lower()


def parse_parallel_list(items: list[str]) -> list[dict]:
    """Convert a list of parallel name strings to structured dicts."""
    parallels = []
    for item in items:
        item = item.strip()
        if not item:
            continue
        print_run = parse_print_run(item)
        name = re.sub(r"\s*/\s*\d+", "", item).strip()
        parallels.append(
            {
                "name": name,
                "print_run": print_run,
                "excluded_from_sim": is_gold_vinyl(name),
            }
        )
    return parallels


def extract_card_section(section_el) -> list[dict]:
    """
    Given a BeautifulSoup element that contains a numbered card list,
    extract all cards as {number, name, team} dicts.
    """
    cards = []
    if not section_el:
        return cards

    # Cards appear as plain text lines: "1 Joe Burrow, Cincinnati Bengals"
    text = section_el.get_text(separator="\n")
    for line in text.split("\n"):
        line = line.strip()
        # Match: number + name + optional comma + team
        m = re.match(r"^(\d+)\s+(.+?)(?:,\s*(.+))?$", line)
        if not m:
            continue
        number = int(m.group(1))
        name_part = m.group(2).strip()
        team = m.group(3).strip() if m.group(3) else ""
        cards.append(
            {
                "number": number,
                "name": name_part,
                "team": team,
                "image_url": None,
            }
        )
    return cards


def extract_parallel_list_from_section(section_text: str) -> list[dict]:
    """Extract the parallel list that appears before the card list in a section."""
    parallels = []
    in_parallels = False
    for line in section_text.split("\n"):
        line = line.strip().lstrip("-").strip()
        if not line:
            continue
        if re.match(r"^(veteran|rated rookie|parallel)", line, re.I):
            in_parallels = True
            continue
        if re.match(r"^\d+\s", line):
            # Hit the numbered card list -- stop
            break
        if in_parallels and line:
            parallels.append(line)
    return parse_parallel_list(parallels)


# ---------------------------------------------------------------------------
# Insert extraction
# ---------------------------------------------------------------------------

# Known hit insert categories and their label patterns
HIT_INSERT_PATTERNS = {
    "downtown": re.compile(r"^downtown$", re.I),
    "downtown_duo": re.compile(r"downtown duo|downtown duos", re.I),
    "downtown_legends": re.compile(r"downtown legend", re.I),
    "rookie_kings": re.compile(r"rookie king", re.I),
    "sunday_kings": re.compile(r"sunday king", re.I),
    "uptowns": re.compile(r"^uptown", re.I),
}

JUNK_INSERT_PATTERNS = {
    "my_house": re.compile(r"my house", re.I),
    "retro_2015": re.compile(r"2015 retro(?! auto)", re.I),
}


def extract_inserts(soup: BeautifulSoup) -> dict:
    """
    Find all insert sections (h2/h3 headings that match known insert names)
    and extract their card lists.
    """
    inserts = {
        key: []
        for key in list(HIT_INSERT_PATTERNS.keys()) + list(JUNK_INSERT_PATTERNS.keys())
    }
    all_patterns = {**HIT_INSERT_PATTERNS, **JUNK_INSERT_PATTERNS}

    for heading in soup.find_all(["h2", "h3"]):
        heading_text = heading.get_text().strip()
        matched_key = None
        for key, pattern in all_patterns.items():
            if pattern.search(heading_text):
                matched_key = key
                break
        if not matched_key:
            continue

        # Collect text up to the next heading
        content_parts = []
        for sib in heading.next_siblings:
            if sib.name in ("h2", "h3"):
                break
            content_parts.append(
                sib.get_text(separator="\n") if hasattr(sib, "get_text") else str(sib)
            )

        combined = "\n".join(content_parts)
        cards = extract_card_section_from_text(combined)
        if cards:
            inserts[matched_key].extend(cards)

    return inserts


def extract_card_section_from_text(text: str) -> list[dict]:
    """Extract numbered card entries from raw text."""
    cards = []
    for line in text.split("\n"):
        line = line.strip()
        m = re.match(r"^(\d+)\s+(.+?)(?:,\s*(.+))?$", line)
        if not m:
            continue
        number = int(m.group(1))
        name_part = m.group(2).strip()
        team = m.group(3).strip() if m.group(3) else ""
        cards.append(
            {
                "number": number,
                "name": name_part,
                "team": team,
                "image_url": None,
            }
        )
    return cards


# ---------------------------------------------------------------------------
# Main page parser
# ---------------------------------------------------------------------------


def parse_beckett_page(soup: BeautifulSoup, meta: dict) -> dict:
    print("  Extracting box configurations...")
    box_configs = extract_box_configs(soup)
    pack_config = extract_pack_config(soup)

    # Merge pack config into box configs
    for key, pc in pack_config.items():
        if key in box_configs:
            box_configs[key].update(pc)
        else:
            box_configs[key] = {
                "label": key.replace("_", " ").title(),
                "tier": "pack" if key in PACK_BASED else "flat",
                "guarantees": {},
                **pc,
            }

    # Add pack slots to each box type
    for key, bc in box_configs.items():
        bc["pack_slots"] = build_pack_slots(key, bc.get("guarantees", {}))

    print("  Extracting images...")
    img_map = extract_images(soup)

    print("  Extracting base cards...")
    base_cards = _extract_base_set(soup, img_map)
    print(
        f"    {len(base_cards['veterans'])} veterans, {len(base_cards['rated_rookies'])} rated rookies"
    )

    print("  Extracting inserts...")
    inserts = extract_inserts(soup)
    hit_count = sum(len(v) for k, v in inserts.items() if k in HIT_INSERT_PATTERNS)
    print(
        f"    {hit_count} hit insert cards across {len(HIT_INSERT_PATTERNS)} categories"
    )

    print("  Extracting parallels...")
    parallels = _extract_parallels(soup)

    return {
        "id": meta["id"],
        "name": meta["name"],
        "year": meta["year"],
        "sport": meta["sport"],
        "boxes_per_case": meta.get("boxes_per_case", 12),
        "source_url": meta["url"],
        "box_types": box_configs,
        "cards": {
            "base": base_cards["veterans"],
            "rated_rookies": base_cards["rated_rookies"],
            "inserts": inserts,
            "hit_inserts": list(HIT_INSERT_PATTERNS.keys()),
            "junk_inserts": list(JUNK_INSERT_PATTERNS.keys()),
            "parallels": parallels,
        },
    }


def _extract_base_set(soup: BeautifulSoup, img_map: dict) -> dict:
    veterans = []
    rated_rookies = []

    # Find the Base Set Checklist section
    base_heading = soup.find(
        ["h2", "h3"], string=re.compile(r"base set checklist", re.I)
    )
    if not base_heading:
        # Fallback: find the first large numbered card list
        base_heading = soup.find(["h2", "h3"], string=re.compile(r"^base", re.I))

    if base_heading:
        content = []
        for sib in base_heading.next_siblings:
            if sib.name in ("h2", "h3"):
                break
            content.append(
                sib.get_text(separator="\n") if hasattr(sib, "get_text") else str(sib)
            )
        text = "\n".join(content)
        cards = extract_card_section_from_text(text)
        for c in cards:
            c["is_rookie"] = False
            _apply_image(c, img_map)
            if 1 <= c["number"] <= 200:
                veterans.append(c)
            # Numbers 201-300 are rated rookies but will be caught by the
            # dedicated rated-rookies section below

    # Find the Rated Rookies section
    rr_heading = soup.find(
        ["h2", "h3"],
        string=re.compile(r"rated rookie", re.I),
    )
    # Skip headings that are about autographs or patches
    if rr_heading and re.search(r"auto|patch|rps", rr_heading.get_text(), re.I):
        rr_heading = None

    # Walk siblings looking for the plain rated rookies list
    for heading in soup.find_all(["h2", "h3"]):
        text = heading.get_text()
        if re.search(r"base.*rated rookie|rated rookie", text, re.I) and not re.search(
            r"auto|patch|rps", text, re.I
        ):
            content = []
            for sib in heading.next_siblings:
                if sib.name in ("h2", "h3"):
                    break
                content.append(
                    sib.get_text(separator="\n")
                    if hasattr(sib, "get_text")
                    else str(sib)
                )
            combined = "\n".join(content)
            cards = extract_card_section_from_text(combined)
            if cards:
                for c in cards:
                    c["is_rookie"] = True
                    _apply_image(c, img_map)
                rated_rookies = cards
                break

    return {"veterans": veterans, "rated_rookies": rated_rookies}


def _apply_image(card: dict, img_map: dict):
    name_lower = card["name"].lower()
    # Try exact name match first
    if name_lower in img_map:
        card["image_url"] = img_map[name_lower]
        return
    # Try partial match (first word of name)
    first_word = name_lower.split()[0] if name_lower else ""
    for key, url in img_map.items():
        if first_word and first_word in key:
            card["image_url"] = url
            return


def _extract_parallels(soup: BeautifulSoup) -> dict:
    """Extract parallel lists for base veterans and rated rookies."""
    result = {"base": [], "rated_rookies": []}

    # Find veteran parallels section
    for heading in soup.find_all(["h2", "h3", "h4"]):
        text = heading.get_text().strip()
        if re.search(r"veteran.*parallel|parallel.*veteran", text, re.I):
            items = _collect_list_items(heading)
            result["base"] = parse_parallel_list(items)
            break

    # Find rated rookie parallels section -- appears under the rated rookies heading
    for heading in soup.find_all(["h2", "h3", "h4"]):
        text = heading.get_text().strip()
        if re.search(r"rated rookie", text, re.I) and not re.search(
            r"auto|patch|rps", text, re.I
        ):
            # Look for a "Parallels" sub-item within the next content block
            for sib in heading.next_siblings:
                if sib.name in ("h2", "h3"):
                    break
                if hasattr(sib, "get_text"):
                    sub_text = sib.get_text().strip()
                    if re.search(r"^parallels?$", sub_text, re.I):
                        # Next sibling should be the list
                        ul = sib.find_next_sibling("ul") or sib.find_next_sibling("ol")
                        if ul:
                            items = [li.get_text().strip() for li in ul.find_all("li")]
                            result["rated_rookies"] = parse_parallel_list(items)
                        break
            break

    # Fallback: if base parallels are empty, look for a simple list under
    # "Veteran/Legend Parallels" or similar
    if not result["base"]:
        for heading in soup.find_all(["h4", "h3"]):
            text = heading.get_text().strip()
            if re.search(r"veteran.{0,10}parallel|legend.{0,10}parallel", text, re.I):
                items = _collect_list_items(heading)
                if items:
                    result["base"] = parse_parallel_list(items)
                    break

    return result


def _collect_list_items(heading) -> list[str]:
    """Collect list items from the first <ul> following a heading."""
    for sib in heading.next_siblings:
        if sib.name == "ul":
            return [li.get_text().strip() for li in sib.find_all("li")]
        if sib.name in ("h2", "h3", "h4"):
            break
    return []


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def scrape_set(meta: dict, out_dir: str):
    print(f"\n[{meta['id']}]")
    print(f"  URL: {meta['url']}")
    print("  Fetching page...")

    try:
        soup = fetch(meta["url"])
    except Exception as exc:
        print(f"  ERROR: could not fetch page: {exc}", file=sys.stderr)
        return

    data = parse_beckett_page(soup, meta)

    out_path = os.path.join(out_dir, f"{meta['id']}.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

    print(f"  Written: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Scrape Beckett card set checklists")
    parser.add_argument("--url", help="Scrape a single URL instead of all defaults")
    parser.add_argument(
        "--out",
        default="src/data/sets",
        help="Output directory for JSON files (default: src/data/sets)",
    )
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)

    if args.url:
        # Single URL -- use a generic meta, the user can rename the file later
        slug = re.sub(r"[^a-z0-9]+", "-", args.url.lower()).strip("-")[:60]
        meta = {
            "url": args.url,
            "id": slug,
            "name": slug.replace("-", " ").title(),
            "year": 2025,
            "sport": "unknown",
            "boxes_per_case": 12,
        }
        scrape_set(meta, args.out)
    else:
        for meta in DEFAULT_SETS:
            scrape_set(meta, args.out)
            time.sleep(1)  # polite delay between requests

    print("\nDone.\n")


if __name__ == "__main__":
    main()
