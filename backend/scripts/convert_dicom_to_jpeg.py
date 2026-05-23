#!/usr/bin/env python3
import sys
import io
from pathlib import Path
try:
    import pydicom
    from PIL import Image
    import numpy as np
except Exception as e:
    print(f'MISSING_DEP:{e}', file=sys.stderr)
    sys.exit(2)


def convert(in_path, out_path, max_size=1024):
    ds = pydicom.dcmread(in_path, force=True)
    arr = ds.pixel_array
    if arr.ndim == 2:
        img = Image.fromarray(arr).convert('L')
        img = img.convert('RGB')
    else:
        img = Image.fromarray(arr)
        if img.mode != 'RGB':
            img = img.convert('RGB')

    # Resize preserving aspect
    w, h = img.size
    scale = min(1.0, float(max_size) / max(w, h))
    if scale < 1.0:
        img = img.resize((int(w*scale), int(h*scale)), Image.LANCZOS)

    out_dir = Path(out_path).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format='JPEG', quality=85)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: convert_dicom_to_jpeg.py <input.dcm> <output.jpg>')
        sys.exit(1)

    inp = sys.argv[1]
    outp = sys.argv[2]
    try:
        convert(inp, outp)
    except Exception as e:
        print(f'ERROR:{e}', file=sys.stderr)
        sys.exit(3)
