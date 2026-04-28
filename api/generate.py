"""
Vercel Python Serverless Function — hwpx-contract 스킬을 그대로 호출.

스킬 파일은 ../skill/ 에 번들되어 있어야 한다 (vercel.json includeFiles 설정 참고).
한글 파일명의 macOS NFD vs Linux NFC 정규화 차이로 인한 매칭 실패를 방지하기 위해
파일을 찾을 때 여러 정규화 형태를 모두 시도한다.
"""

import os
import sys
import json
import base64
import tempfile
import unicodedata
from datetime import datetime
from http.server import BaseHTTPRequestHandler

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


def find_template(template_basename):
    """
    한글 파일명의 NFC/NFD 정규화 차이를 모두 처리.
    1) 원본 이름 그대로 시도
    2) NFC 정규화 형식 시도 (Linux 기본)
    3) NFD 정규화 형식 시도 (macOS 기본)
    4) 마지막으로 templates 디렉토리 안 모든 파일을 NFC 정규화하여 매칭
    """
    templates_dir = os.path.join(SKILL_DIR, "templates")
    candidates = [
        template_basename,
        unicodedata.normalize("NFC", template_basename),
        unicodedata.normalize("NFD", template_basename),
    ]
    for c in candidates:
        p = os.path.join(templates_dir, c)
        if os.path.exists(p):
            return p

    # 디렉토리 스캔 후 정규화하여 매칭 (가장 robust)
    target_nfc = unicodedata.normalize("NFC", template_basename)
    if os.path.isdir(templates_dir):
        for fname in os.listdir(templates_dir):
            if unicodedata.normalize("NFC", fname) == target_nfc:
                return os.path.join(templates_dir, fname)

    return None


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("content-length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            form_key = payload["formKey"]
            values = payload["values"]

            if form_key not in TEMPLATE_FILES:
                return self._error(400, f"unknown formKey: {form_key}")

            template_path = find_template(TEMPLATE_FILES[form_key])
            if not template_path:
                # 진단용: 디렉토리에 실제로 어떤 파일들이 있는지 함께 보고
                templates_dir = os.path.join(SKILL_DIR, "templates")
                listing = os.listdir(templates_dir) if os.path.isdir(templates_dir) else "(dir not found)"
                return self._error(
                    500,
                    f"template not found: {TEMPLATE_FILES[form_key]}\n"
                    f"templates dir: {templates_dir}\n"
                    f"existing files: {listing}",
                )

            values = auto_set_industry(values)
            values = auto_set_bank(values)
            values = compute_dates(values)

            with tempfile.TemporaryDirectory() as tmp:
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                out_name = f"{form_key}_{stamp}.hwpx"
                out_path = os.path.join(tmp, out_name)

                fill_hwpx(template_path, out_path, values)

                with open(out_path, "rb") as f:
                    hwpx_b64 = base64.b64encode(f.read()).decode("ascii")

                bankbook_b64 = None
                bankbook_name = None
                if "5__청구서" in template_path or "5__청구서" == form_key:
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
