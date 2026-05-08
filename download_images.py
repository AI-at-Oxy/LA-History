"""
Download Wikipedia images for each LA-History location and update locations.json.
Uses the Wikipedia REST API to find the best image for each location.
"""

import json
import os
import time
import urllib.request
import urllib.parse
import urllib.error

IMG_DIR = os.path.join("static", "img")
LOCATIONS_FILE = os.path.join("data", "locations.json")

# Map each location slug to a Wikipedia article title for best image match.
WIKI_TITLES = {
    "kuruvungna-springs":   None,  # already has a local image
    "ballona-wetlands":     "Ballona Wetlands",
    "san-gabriel-foothills":"San Gabriel Mountains",
    "el-pueblo":            "El Pueblo de Los Angeles Historical Monument",
    "mission-san-gabriel":  "Mission San Gabriel Arcangel",
    "fort-moore-hill":      "Fort Moore Pioneer Memorial",
    "old-chinatown":        "Chinatown, Los Angeles",
    "bradbury-building":    "Bradbury Building",
    "hollenbeck-park":      "Hollenbeck Park",
    "la-placita-church":    "Our Lady Queen of Angels Catholic Church (Los Angeles)",
    "watts-towers":         "Watts Towers",
    "griffith-observatory": "Griffith Observatory",
    "chavez-ravine":        "Chavez Ravine",
    "macarthur-park":       "MacArthur Park (Los Angeles)",
    "hollywood-sign":       "Hollywood Sign",
}


def get_wiki_image_url(title):
    """Return the URL of the main image for a Wikipedia article, or None."""
    api = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": title,
        "prop": "pageimages",
        "pithumbsize": 1200,
        "format": "json",
        "redirects": 1,
    }
    url = api + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "LA-History-ImageBot/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  [ERROR] API request failed: {e}")
        return None

    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        thumb = page.get("thumbnail", {})
        if thumb.get("source"):
            return thumb["source"]
    return None


def guess_extension(url):
    """Guess file extension from URL, defaulting to .jpg."""
    path = urllib.parse.urlparse(url).path.lower()
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    return ".jpg"


def download_image(url, dest_path, retries=3):
    """Download url to dest_path. Returns True on success. Retries on 429."""
    req = urllib.request.Request(url, headers={"User-Agent": "LA-History-ImageBot/1.0"})
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp, open(dest_path, "wb") as f:
                f.write(resp.read())
            return True
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                wait = 8 * attempt
                print(f"  [RATE-LIMIT] 429, waiting {wait}s (retry {attempt}/{retries - 1})...")
                time.sleep(wait)
            else:
                print(f"  [ERROR] Download failed: {e}")
                return False
        except Exception as e:
            print(f"  [ERROR] Download failed: {e}")
            return False
    return False


def main():
    os.makedirs(IMG_DIR, exist_ok=True)

    with open(LOCATIONS_FILE, encoding="utf-8") as f:
        locations = json.load(f)

    changed = False

    for loc in locations:
        slug = loc.get("slug", "")
        name = loc.get("name", slug)
        wiki_title = WIKI_TITLES.get(slug)

        # Skip if already a local path and file exists
        current_url = loc.get("image_url", "")
        if current_url.startswith("/static/img/"):
            rel = current_url.lstrip("/")
            if os.path.exists(rel):
                print(f"[SKIP] {name}: already has local image -> {current_url}")
                continue

        if wiki_title is None:
            print(f"[SKIP] {name}: no Wikipedia title configured")
            continue

        print(f"[FETCH] {name} -- Wikipedia: '{wiki_title}'")
        img_url = get_wiki_image_url(wiki_title)
        time.sleep(1)  # polite pause after API call

        if not img_url:
            print(f"  [WARN] No image found for '{wiki_title}'")
            continue

        ext = guess_extension(img_url)
        filename = f"{slug}{ext}"
        dest_path = os.path.join(IMG_DIR, filename)

        print(f"  Downloading: {img_url}")
        print(f"  Saving to:   {dest_path}")

        if download_image(img_url, dest_path):
            new_url = f"/static/img/{filename}"
            loc["image_url"] = new_url
            changed = True
            print(f"  [OK] {new_url}")
        else:
            print(f"  [FAIL] Could not download image for {name}")

        time.sleep(3)  # be polite to Wikimedia between downloads

    if changed:
        with open(LOCATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(locations, f, indent=2, ensure_ascii=False)
        print("\nlocations.json updated.")
    else:
        print("\nNo changes made to locations.json.")


if __name__ == "__main__":
    main()
