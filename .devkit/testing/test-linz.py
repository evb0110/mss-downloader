#!/usr/bin/env python3
import requests

print("Testing Linz manuscript IDs...")
test_ids = [115, 117, 118, 120, 150, 200, 250, 300, 500, 1000]

for id in test_ids:
    url = f"https://digi.landesbibliothek.at/viewer/api/v1/records/{id}/manifest/"
    try:
        response = requests.head(url, timeout=5)
        print(f"ID {id}: {response.status_code}")
    except Exception as e:
        print(f"ID {id}: Error - {e}")