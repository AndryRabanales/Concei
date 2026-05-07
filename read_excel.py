import pandas as pd
import json

df = pd.read_excel(r'C:\Users\andry\Desktop\NoteIt\Propuestas 2026 04 14.xlsx')
data = df.to_json(orient='records', force_ascii=False)

with open(r'c:\Users\andry\Desktop\DrAnabel\excel_data.json', 'w', encoding='utf-8') as f:
    f.write(data)
