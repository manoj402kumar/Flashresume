import os, requests, csv
from dotenv import load_dotenv

load_dotenv('d:/FlashresumeFolder/Flashresumev2/backend/.env')
key_id = os.environ.get('RAZORPAY_KEY_ID')
key_secret = os.environ.get('RAZORPAY_KEY_SECRET')

# Fetch all payments (paginated, 100 per call)
all_payments = []
skip = 0
while True:
    resp = requests.get(
        'https://api.razorpay.com/v1/payments',
        auth=(key_id, key_secret),
        params={'count': 100, 'skip': skip}
    )
    data = resp.json()
    items = data.get('items', [])
    if not items:
        break
    all_payments.extend(items)
    skip += 100
    if len(items) < 100:
        break

print(f"Total payments fetched: {len(all_payments)}")

# Filter only captured (successful) payments
results = []
for p in all_payments:
    if p.get('status') == 'captured':
        results.append({
            'phone':  p.get('contact', 'N/A'),
            'email':  p.get('email', 'N/A'),
            'amount': str(int(p.get('amount', 0)) // 100) + ' INR',
            'method': p.get('method', ''),
            'payment_id': p.get('id', ''),
        })

print(f"Successful payments with phone numbers: {len(results)}")
print()
print(f"{'Phone':<20} {'Email':<35} {'Amount':<10} Method")
print("-" * 80)
for r in results:
    phone  = r['phone']
    email  = r['email']
    amount = r['amount']
    method = r['method']
    print(f"{phone:<20} {email:<35} {amount:<10} {method}")

# Also save to CSV
out_path = 'C:/Users/DELL/.gemini/antigravity-ide/brain/d7c8697a-f4d3-421c-a2dc-c02119e74e8f/scratch/razorpay_contacts.csv'
with open(out_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['phone','email','amount','method','payment_id'])
    writer.writeheader()
    writer.writerows(results)
print()
print(f"Saved to: {out_path}")
