import sys
import json
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

try:
    from cnocr import CnOcr
    ocr = CnOcr()
    path = sys.argv[1]
    result = ocr.ocr(path)
    lines = [item.get('text', '') for item in result if item.get('text', '').strip()]
    print(json.dumps({"success": True, "text": "\n".join(lines)}, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
