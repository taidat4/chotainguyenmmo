"""
Test API theo cách Bot Thong Bao
"""
import requests
import json

# Config
config = {
    "apicanhanKey": "723e25ee17e7ee0add725cd63732bf76",
    "apicanhanUser": "0965268536",
    "apicanhanPass": "Thinh195",
    "apicanhanAccount": "0965268536"
}

print("=" * 60)
print("TEST API THEO BOT THONG BAO")
print("=" * 60)

# Setup session giong Bot Thong Bao
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
})

params = {
    "key": config["apicanhanKey"],
    "username": config["apicanhanUser"],
    "password": config["apicanhanPass"],
    "accountNo": config["apicanhanAccount"]
}

try:
    response = session.get("https://apicanhan.com/api/mbbankv3", params=params, timeout=15)
    print(f"HTTP Status: {response.status_code}")
    
    data = response.json()
    print(f"API Status: {data.get('status')}")
    print(f"Message: {data.get('message')}")
    
    if "transactions" in data:
        txs = data["transactions"]
        print(f"Total transactions: {len(txs)}")
        
        # Chi hien giao dich IN
        in_txs = [t for t in txs if t.get("type") == "IN"]
        print(f"IN transactions: {len(in_txs)}")
        
        print("\n3 giao dich IN gan nhat:")
        for i, tx in enumerate(in_txs[:3]):
            print(f"  [{i+1}] {tx.get('transactionDate')} - {tx.get('amount')} - {tx.get('description')[:60]}")
        
        # Tim ME4Z0N
        print("\nTimkiem ME4Z0N:")
        found = False
        for tx in txs:
            desc = tx.get("description", "")
            if "ME4Z0N" in desc.upper():
                print(f"  TIM THAY! Amount={tx.get('amount')}, Date={tx.get('transactionDate')}")
                print(f"  Desc: {desc}")
                found = True
        if not found:
            print("  KHONG TIM THAY ME4Z0N!")
            
except Exception as e:
    print(f"Loi: {e}")
    import traceback
    traceback.print_exc()
