"""
Vercel Python Serverless Function — hwpx-contract 스킬을 그대로 호출.

요청 (POST /api/generate):
{
  "formKey": "5__청구서" | "1__계약_시_구비서류" | ...,
  "values": { "1": "...", "2": "...", ..., "_cheonggu_amount": 10040000, "_seongeum_rate": 50, ... }
}

응답:
{
  "fileName": "5__청구서_20260427.hwpx",
  "hwpxBase64": "...",
  "bankbookPdfBase64": "..." | null,
  "bankbookFileName": "통장사본_청춘작당_협동조합.pdf" | null
}

스킬 파일은 ../skill/ 에 번들되어 있어야 한다 (vercel.json includeFiles 설정 참고).
"""

import os
import sys
import json
import base64
import tempfile
from datetime import datetime
from http.server import BaseHTTPRequestHandler

# skill 디렉토리 import path 추가
HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.normpath(os.path.join(HERE, "..", "skill"))
sys.path.insert(0, os.path.join(SKILL_DIR, "scripts"))

from fill_hwpx import (
    auto_set_industry,
    auto_set_bank,
    compute_dates,
    fill_hwpx,
    make_bankbook_pdf,
)


TEMPLATE_FILES = {
    "1__계약_시_구비서류": "1__계약_시_구비서류.hwpx",
    "2__착수계": "2__착수계.hwpx",
    "3__선금신청서": "3__선금신청서.hwpx",
    "4__완료계": "4__완료계.hwpx",
    "5__청구서": "5__청구서.hwpx",
}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            form_key = payload["formKey"]
            values = payload["values"]

            if form_key not in TEMPLATE_FILES:
                return self._error(400, f"unknown formKey: {form_key}")

            template_path = os.path.join(SKILL_DIR, "templates", TEMPLATE_FILES[form_key])
            if not os.path.exists(template_path):
                return self._error(500, f"template not found: {template_path}")

            # 스킬과 동일한 전처리 흐름
            values = auto_set_industry(values)
            values = auto_set_bank(values)
            values = compute_dates(values)

            # tempdir에서 hwpx 생성
            with tempfile.TemporaryDirectory() as tmp:
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                out_name = f"{form_key}_{stamp}.hwpx"
                out_path = os.path.join(tmp, out_name)

                fill_hwpx(template_path, out_path, values)

                with open(out_path, "rb") as f:
                    hwpx_b64 = base64.b64encode(f.read()).decode("ascii")

                # 청구서면 통장사본 PDF도 생성
                bankbook_b64 = None
                bankbook_name = None
                if "5__청구서" in template_path:
                    pdf_path = make_bankbook_pdf(values, SKILL_DIR, tmp)
                    if pdf_path and os.path.exists(pdf_path):
                        with open(pdf_path, "rb") as f:
                            bankbook_b64 = base64.b64encode(f.read()).decode("ascii")
                        bankbook_name = os.path.basename(pdf_path)

            self._json(
                200,
                {
                    "fileName": out_name,
                    "hwpxBase64": hwpx_b64,
                    "bankbookPdfBase64": bankbook_b64,
                    "bankbookFileName": bankbook_name,
                },
            )
        except Exception as e:
            self._error(500, f"{type(e).__name__}: {e}")

    def _json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, msg):
        body = msg.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
