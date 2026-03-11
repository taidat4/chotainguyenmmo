import json

with open('api_response.json', encoding='utf-8') as f:
    data = json.load(f)

txs = data['transactions']
print(f"Total transactions: {len(txs)}")
print(f"\nLatest transaction:")
print(f"  Date: {txs[0]['transactionDate']}")
print(f"  Amount: {txs[0]['amount']}")
print(f"  Description: {txs[0]['description']}")

# Check for ME4Z0N
print("\nSearching for ME4Z0N...")
found = False
for i, tx in enumerate(txs):
    if 'ME4Z0N' in tx.get('description', '').upper():
        print(f"  FOUND at index {i}: {tx}")
        found = True
if not found:
    print("  NOT FOUND!")
