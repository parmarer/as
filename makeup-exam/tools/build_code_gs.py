# -*- coding: utf-8 -*-
"""Generate Code.gs (Google Apps Script) from exam_items.json.

Usage: python3 tools/build_code_gs.py   (run from the makeup-exam directory)
"""
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "exam_items.json").read_text(encoding="utf-8"))
template = (root / "tools" / "Code.template.gs").read_text(encoding="utf-8")

assert "__EXAM_JSON__" in template
payload = json.dumps(data, ensure_ascii=False, indent=2)
code = template.replace("__EXAM_JSON__", payload)
(root / "Code.gs").write_text(code, encoding="utf-8")
print(f"Code.gs written: {len(data['mcq'])} MCQ + {len(data['short'])} short answer")
