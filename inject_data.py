import json
import re

with open(r'c:\Users\andry\Desktop\DrAnabel\seed_data.json', 'r', encoding='utf-8') as f:
    json_data = f.read()

# For admin.js
with open(r'c:\Users\andry\Desktop\DrAnabel\js\admin.js', 'r', encoding='utf-8') as f:
    admin_content = f.read()

# Replace the defaultData block
# The block looks like: const defaultData = { workshop: [...], visit: [...] };
admin_content = re.sub(r'const defaultData = \{.*?\};', f'const defaultData = {json_data};', admin_content, flags=re.DOTALL)

with open(r'c:\Users\andry\Desktop\DrAnabel\js\admin.js', 'w', encoding='utf-8') as f:
    f.write(admin_content)

# For app.js
with open(r'c:\Users\andry\Desktop\DrAnabel\js\app.js', 'r', encoding='utf-8') as f:
    app_content = f.read()

app_content = re.sub(r'const defaultData = \{.*?\};', f'const defaultData = {json_data};', app_content, flags=re.DOTALL)

with open(r'c:\Users\andry\Desktop\DrAnabel\js\app.js', 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Injected successfully.")
