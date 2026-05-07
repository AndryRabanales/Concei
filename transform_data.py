import json

with open(r'c:\Users\andry\Desktop\DrAnabel\excel_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

workshops = []
for idx, row in enumerate(data):
    instructor1 = row.get("Nombre completo del instructor No. 1", "")
    instructor2 = row.get("Nombre completo del instructor No. 2", "")
    instructor = instructor1 if instructor1 else ""
    if instructor2 and instructor2 != "Na":
        instructor += f" y {instructor2}"
        
    horario1 = row.get("Horario", "")
    horario2 = row.get("Indique el horario para su taller", "")
    horario = horario1 if horario1 and horario1 != "Otro horario" else horario2
    if not horario:
        horario = row.get("Duración total (en horas)", "")
    
    ws = {
        "id": f"ws{idx+1}",
        "name": row.get("Título del taller", ""),
        "description": row.get("Descripción del taller", ""),
        "price": 70,
        "hours": str(horario).strip(),
        "instructor": instructor,
        "dependency": row.get("Dependencia", ""),
        "modality": row.get("Modalidad", "Presencial"),
        "capacity": row.get("Cupo (no. de estudiantes)", 30)
    }
    workshops.append(ws)

json_str = json.dumps({"workshop": workshops, "visit": []}, ensure_ascii=False, indent=4)
# Modify it to match JS object syntax roughly
with open(r'c:\Users\andry\Desktop\DrAnabel\seed_data.json', 'w', encoding='utf-8') as f:
    f.write(json_str)
