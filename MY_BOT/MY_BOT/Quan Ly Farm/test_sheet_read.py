# -*- coding: utf-8 -*-
import sys, os
sys.stdout.reconfigure(encoding='utf-8')

import gspread
from oauth2client.service_account import ServiceAccountCredentials

creds = ServiceAccountCredentials.from_json_keyfile_name(
    '../credentials.json',
    ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
)
client = gspread.authorize(creds)
ss = client.open('Danh Mục Sản Phẩm')
ws = ss.worksheet('Acc thu hồi')
rows = ws.get_all_values()

output = []
output.append(f"HEADER ({len(rows[0])} cols): {rows[0]}")
output.append("")

for i, r in enumerate(rows[1:61], 2):
    has_data = any(cell.strip() for cell in r if cell.strip() != 'CHƯA THU HỒI')
    if has_data:
        output.append(f"Row {i}: {r}")

with open('sheet_dump.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Done! Written to sheet_dump.txt")
