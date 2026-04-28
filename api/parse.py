"""
Vercel Python Serverless Function — 계약서 PDF 파싱.

요청 (POST /api/parse, multipart/form-data, 필드명: 'file'):
  Content-Type: multipart/form-data
  file: 계약서 PDF

응답:
{
  "company": "청춘작당 협동조합",
  "address": "전라남도 곡성군 죽곡면 화양기동길 23-12",
  "representative": "민찬양",
  "contractDate": "2026. 03. 17.",
  "serviceName": "곡성어린이도서관 2026년 도서관의 날 기념행사 용역",
  "contractAmount": 20080000,
  "startDate": "2026. 03. 19.",
  "endDate": "2026. 05. 17.",
  "department": "재무과"
}

핵심:
- pdfplumber 의 char-level 좌표를 사용하여 한글 PDF의 공백 손실을 복원
  (글자 간격이 평균 글자폭의 15%를 넘으면 공백 삽입)
- 추출된 텍스트에 정규식 적용. 추출 실패 항목은 None / 0
"""

import re
import json
import base64
import tempfile
from http.server import BaseHTTPRequestHandler

try:
    import pdfplumber
except ImportError:
    pdfplumber = None


# ─── 공백 복원 PDF 텍스트 추출 ─────────────────────────────
def extract_text_with_spaces(pdf_path: str, gap_ratio: float = 0.15) -> str:
    """
    pdfplumber 의 page.chars 로부터 라인을 재구성하면서, 글자 간격이
    평균 글자폭 * gap_ratio 를 초과하면 공백을 삽입한다.
    한글 PDF에서 라이브러리 기본 추출이 공백을 보존하지 못하는 문제 해결.
    """
    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            chars = page.chars
            if not chars:
                continue
            lines = {}
            for c in chars:
                key = round(c["top"], 0)
                lines.setdefault(key, []).append(c)
            buf = []
            for k in sorted(lines.keys()):
                row = sorted(lines[k], key=lambda c: c["x0"])
                widths = [c["x1"] - c["x0"] for c in row if c["text"].strip()]
                avg_w = sum(widths) / len(widths) if widths else 5
                line = []
                prev = None
                for c in row:
                    if prev is not None:
                        gap = c["x0"] - prev["x1"]
                        if gap > avg_w * gap_ratio and (not line or not line[-1].endswith(" ")):
                            line.append(" ")
                    line.append(c["text"])
                    prev = c
                buf.append("".join(line))
            pages_text.append("\n".join(buf))
    return "\n\n".join(pages_text)


# ─── 항목별 정규식 추출 ────────────────────────────────────
def _extract(text, pattern, flags=re.MULTILINE):
    m = re.search(pattern, text, flags)
    return m.group(1).strip() if m else None


def _strip_postal(addr):
    return re.sub(r"\(우[^)]*\)\s*", "", addr or "").strip()


def _normalize_date(s):
    if not s:
        return ""
    m = re.search(r"(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})", s)
    if not m:
        return ""
    y, mo, d = m.group(1), m.group(2), m.group(3)
    return f"{y}. {mo.zfill(2)}. {d.zfill(2)}."


def _parse_amount(s):
    if not s:
        return 0
    digits = re.sub(r"[^\d]", "", s)
    return int(digits) if digits else 0


def parse_contract_text(text: str) -> dict:
    """공백 복원된 PDF 텍스트로부터 계약서 표준 항목을 추출."""
    company = _extract(text, r"상\s*호\s+([^\n]+?)\s+사업자등록번호")
    # 주소: lookahead 로 종료점 명시 (전 글자 포함된 단어 영향 없음)
    addr_raw = _extract(text, r"주\s*소\s+((?:\(우[^)]*\))?\s*[^\n]+?)(?=\s+전\s*화\s*번\s*호|\s*우편번호)")
    address = _strip_postal(addr_raw or "")
    representative = _extract(text, r"대\s*표\s*자\s+([^\n]+?)(?=\s*F\s*A\s*X|\s*전\s*화)")
    contract_date = _normalize_date(_extract(text, r"계약일자\s*[:：]?\s*(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})"))
    service_name = _extract(text, r"계약건명\s*[:：]?\s*([^\n]+?)\s*$")
    amount_raw = _extract(text, r"계약금액[\s\S]*?\(\s*[\\\u20a9\uffe6Ww]?\s*([\d,]+)\)") or \
                 _extract(text, r"총용역부기금액[\s\S]*?\(\s*[\\\u20a9\uffe6Ww]?\s*([\d,]+)\)")
    contract_amount = _parse_amount(amount_raw or "")
    start_date = _normalize_date(_extract(text, r"착수일자\s*[:：]?\s*(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})"))
    end_date = _normalize_date(
        _extract(text, r"총완수일자\s*[:：]?\s*(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})") or
        _extract(text, r"금차완수일자\s*[:：]?\s*(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})")
    )
    department = _extract(text, r"담당\s*부서\s*[:：]?\s*([^\n]+?)(?=\s+담당|\s*$)")

    contract_number = _extract(text, r"계약번호\s*[:：]?\s*([A-Z0-9\-]+)")
    return {
        "contractNumber": contract_number or "",
        "company": company or "",
        "address": address or "",
        "representative": representative or "",
        "contractDate": contract_date,
        "serviceName": service_name or "",
        "contractAmount": contract_amount,
        "startDate": start_date,
        "endDate": end_date,
        "department": department,  # None 가능 (UI 에서 빨강 강조 + 사용자 보완)
    }


# ─── 멀티파트 파서 ────────────────────────────────────────
def parse_multipart(body: bytes, boundary: str) -> bytes:
    """가장 단순한 multipart 파서. 'file' 필드의 raw bytes 만 추출."""
    sep = ("--" + boundary).encode()
    parts = body.split(sep)
    for p in parts:
        if b'name="file"' in p or b"name=file" in p:
            # 헤더와 본문을 분리하는 \r\n\r\n
            idx = p.find(b"\r\n\r\n")
            if idx == -1:
                continue
            data = p[idx + 4:]
            # 마지막 \r\n 제거
            if data.endswith(b"\r\n"):
                data = data[:-2]
            return data
    raise ValueError("no 'file' field in multipart body")


# ─── HTTP 핸들러 ──────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            if pdfplumber is None:
                return self._error(500, "pdfplumber not installed")

            ctype = self.headers.get("content-type", "")
            length = int(self.headers.get("content-length", "0"))
            body = self.rfile.read(length)

            if "multipart/form-data" in ctype:
                m = re.search(r"boundary=(.+)", ctype)
                if not m:
                    return self._error(400, "missing boundary")
                pdf_bytes = parse_multipart(body, m.group(1).strip())
            elif "application/json" in ctype:
                # base64 인코딩된 PDF 도 허용
                payload = json.loads(body.decode("utf-8"))
                pdf_bytes = base64.b64decode(payload["pdfBase64"])
            else:
                # raw application/pdf
                pdf_bytes = body

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(pdf_bytes)
                tmp_path = f.name

            text = extract_text_with_spaces(tmp_path)
            parsed = parse_contract_text(text)

            self._json(200, parsed)
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
