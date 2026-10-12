# tools/

- `src/reference.png` — ảnh tham chiếu gốc (nhân vật, địch, bối cảnh).
- `heads.py` → `extract.py` — cắt & tách nền (rembg `isnet-general-use`) để tạo ảnh trong `public/assets/`.
  ```bash
  pip install rembg onnxruntime pillow scipy numpy
  cd tools
  python3 -c "from rembg import new_session, remove; from PIL import Image; im=Image.open('src/reference.png').convert('RGB'); c=im.crop((0,130,600,420)).resize((1200,580)); remove(c, session=new_session('isnet-general-use')).save('out/poster_full_isnet-general-use.png')"
  python3 heads.py && python3 extract.py
  ```
- `run.py` + `bot.js` — smoke test tự động: autopilot chơi một màn (cần `npm run build && npm run preview` và Playwright).
  `python3 tools/run.py <màn> <giây> [god]` (biến môi trường `CP=1` để bắt đầu từ checkpoint trước boss).
- `shots.py` — chụp màn hình các scene để kiểm tra giao diện.
