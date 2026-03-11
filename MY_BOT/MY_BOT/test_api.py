import requests
import json

cfg = {
    "key": "723e25ee17e7ee0add725cd63732bf76",
    "username": "0965268536",
    "password": "Thinh195",
    "accountNo": "0965268536"
}

resp = requests.get("https://apicanhan.com/api/mbbankv3", params=cfg, timeout=30)
data = resp.json()

# Save full response to JSON file
with open("api_response.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Saved to api_response.json")
print("Status:", data.get("status"))
print("Transactions count:", len(data.get("transactions", [])))
