#!/usr/bin/env python3
"""
hwpx 계약 서식 자동완성 스크립트
사용법: python fill_hwpx.py <템플릿파일.hwpx> <출력파일.hwpx> '{"1":"값","2":"값",...}'
청구서의 경우 통장사본 PDF를 함께 생성하여 제공.
"""

import zipfile
import json
import sys
import os
import re
import tempfile
from datetime import datetime, timedelta


# ── 상수 ────────────────────────────────────────────────
SPLIT_THRESHOLD = 30000
ADDRESS_SPLIT_RE = re.compile(r'^(.*?[시군구읍면동])\s+(.+)$')
POSTAL_RE = re.compile(r'\(우\s*:\s*\d+\)\s*|우\s*:\s*\d+\s*')

BANK_INFO = {
    '팜앤디협동조합': {'bank': '농협', 'account': '351-4022-2449-23'},
    '청춘작당협동조합': {'bank': '농협', 'account': '351-1068-2100-13'},
}

BANKBOOK_IMAGES = {
    '팜앤디협동조합': '팜앤디_통장사본.pdf',
    '청춘작당협동조합': '청춘작당_통장사본.pdf',
}


# ── 주소 처리 ────────────────────────────────────────────
def normalize_address(addr):
    return POSTAL_RE.sub('', addr).strip()

def split_address(addr):
    addr = normalize_address(addr)
    m = ADDRESS_SPLIT_RE.match(addr)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    words = addr.split()
    mid = len(words) // 2
    return ' '.join(words[:mid]), ' '.join(words[mid:])

def replace_with_two_lines(content, pos, line1, line2):
    p_start = content.rfind('<hp:p ', 0, pos)
    p_end = content.find('</hp:p>', pos) + len('</hp:p>')
    original_p = content[p_start:p_end]
    p_tag_end = content.find('>', p_start) + 1
    p_open = content[p_start:p_tag_end]
    m = re.search(r'<hp:run charPrIDRef="(\d+)">', original_p)
    charPr = m.group(1) if m else '12'
    new_p = (
        f'{p_open}<hp:run charPrIDRef="{charPr}"><hp:t>{line1}</hp:t></hp:run></hp:p>'
        f'{p_open}<hp:run charPrIDRef="{charPr}"><hp:t>{line2}</hp:t></hp:run></hp:p>'
    )
    return content[:p_start] + new_p + content[p_end:]

def apply_address(content, addr):
    addr_full = normalize_address(addr)
    line1, line2 = split_address(addr)
    positions = [m.start() for m in re.finditer(r'\{\{2\}\}', content)]
    for pos in reversed(positions):
        seg = content[pos:pos + 500]
        hz_m = re.search(r'horzsize="(\d+)"', seg)
        horzsize = int(hz_m.group(1)) if hz_m else 99999
        if horzsize < SPLIT_THRESHOLD:
            content = replace_with_two_lines(content, pos, line1, line2)
        else:
            content = content[:pos] + addr_full + content[pos + 5:]
    return content


# ── 업종 자동설정 ─────────────────────────────────────────
def auto_set_industry(values):
    INDUSTRY = '학술연구용역, 디자인, 행사'
    if '4' not in values and '1' in values:
        normalized = values['1'].replace(' ', '')
        if any(c in normalized for c in BANK_INFO.keys()):
            values['4'] = INDUSTRY
    return values


# ── 계좌 정보 자동설정 ────────────────────────────────────
def auto_set_bank(values):
    if '1' not in values:
        return values
    normalized = values['1'].replace(' ', '')
    for company, info in BANK_INFO.items():
        if company in normalized:
            values['_bank'] = info['bank']
            values['_account'] = info['account']
            break
    return values


# ── 보증일 자동계산 ───────────────────────────────────────
def compute_dates(values):
    if '10' in values and '11' not in values:
        try:
            end_date = datetime.strptime(values['10'].rstrip('.'), '%Y. %m. %d')
            gs = end_date + timedelta(days=1)
            ge = gs + timedelta(days=364)
            values['11'] = gs.strftime('%Y. %m. %d.')
            values['12'] = ge.strftime('%Y. %m. %d.')
        except ValueError:
            pass
    return values


# ── 청구서 은행 정보 삽입 ─────────────────────────────────
def apply_bank_info(content, values):
    if '_bank' in values:
        content = content.replace(
            '<hp:t>  ○ 은행명 : </hp:t>',
            f'<hp:t>  ○ 은행명 : {values["_bank"]}</hp:t>'
        )
    if '_account' in values:
        content = content.replace(
            '<hp:t>  ○ 계좌번호 : </hp:t>',
            f'<hp:t>  ○ 계좌번호 : {values["_account"]}</hp:t>'
        )
    return content


# ── 완료계 완료일 처리 ─────────────────────────────────
def apply_wanryo_date(content, values):
    """완료계의 완료일(2025년    월    일)을 계약종료일({{10}})로 치환"""
    if '10' not in values:
        return content
    date_str = values['10'].rstrip('.')  # "2026. 11. 30"
    try:
        from datetime import datetime
        d = datetime.strptime(date_str, '%Y. %m. %d')
        formatted = f"{d.year}년  {d.month:02d}월  {d.day:02d}일"
        content = content.replace('2025년    월    일', formatted)
    except ValueError:
        pass
    return content


# ── 선금신청서 선금액/비율 처리 ──────────────────────────
def num_to_korean(n):
    """숫자를 한글 금액으로 변환. 예: 9400000 → '구백사십만'"""
    if n == 0:
        return '영'
    units_small = ['', '십', '백', '천']
    digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
    units_large = ['', '만', '억', '조']
    result = ''
    unit_idx = 0
    while n > 0:
        chunk = n % 10000
        if chunk:
            chunk_str = ''
            for i in range(4):
                d = (chunk // (10 ** i)) % 10
                if d:
                    # 회계/계약 문서 규약: 1을 생략하지 않고 항상 '일' 접두를 유지한다.
                    # 예) 1004 → '일천사' (X '천사'), 1880 → '일천팔백팔십'
                    chunk_str = digits[d] + units_small[i] + chunk_str
            result = chunk_str + units_large[unit_idx] + result
        n //= 10000
        unit_idx += 1
    return result


def format_amount(n):
    """금액을 '일금 구백사십만원정 (₩9,400,000)' 형식으로 변환"""
    return f"일금 {num_to_korean(n)}원정 (₩{n:,})"


def apply_submission_year(content, values):
    """
    제출일 'YYYY. . .' 패턴의 연도(템플릿 기본값 2025)를 실제 제출 연도로 치환.
    우선순위: values['_submission_year'] > {{10}}(계약종료일) 연도 > 오늘 연도.
    공백/온점은 템플릿 그대로 유지하고 4자리 숫자만 교체한다.
    모든 서식(착수계/선금/완료/청구/구비서류)에 공통 적용.
    """
    import re
    from datetime import datetime
    year = values.get('_submission_year')
    if not year:
        end = values.get('10')
        if end:
            m = re.match(r'\s*(\d{4})', str(end))
            if m:
                year = m.group(1)
    if not year:
        year = str(datetime.now().year)
    # 'YYYY. . .' / 'YYYY.   .    .' / 'YYYY.  . ' / 'YYYY.  .' 등
    # 점 2~3개 + 임의 공백 모두 매칭. 마지막 점은 선택적.
    return re.sub(
        r'(<hp:t>)2025(\.\s*\.\s*\.?\s*</hp:t>)',
        lambda m: m.group(1) + str(year) + m.group(2),
        content
    )


def apply_submission_date(content, values):
    """
    제출일 'YYYY. . .' 패턴 전체를 _submission_date 값으로 교체.
    apply_submission_year 보다 우선 적용. _submission_date 미지정 시 호출되지 않음.

    예) 템플릿 '2025. . .' / '2025.   .    .' (연도가 2025인 패턴만) → '2026. 04. 28.' (입력값)
    주의: '2024.  . ' 같은 다른 연도 패턴은 매칭하지 않음 (착수계·접수일시 보호)
    """
    import re
    date = values.get('_submission_date')
    if not date:
        return content
    # 점 2~3개 + 임의 공백 패턴을 모두 매칭하여 통째로 교체
    return re.sub(
        r'<hp:t>2025\.\s*\.\s*\.?\s*</hp:t>',
        f'<hp:t>{date}</hp:t>',
        content
    )


def apply_cheonggu_amount(content, values):
    """
    청구서의 청구금액(5. 청구금액) 자동 입력.
    values['_cheonggu_amount']: 청구금액 (정수 또는 사전 포맷된 문자열)
    빈 칸 '<hp:t>금 원정 (￦ )</hp:t>'를 '금 OOO원정 (￦ N,NNN)' 형식으로 치환한다.
    {{7}}은 계약금액(=계약 총액)으로 유지하고, 청구금액은 _cheonggu_amount로 분리하여 입력한다.
    """
    amount = values.get('_cheonggu_amount')
    if amount is None or amount == '':
        return content

    if isinstance(amount, (int, float)) or (isinstance(amount, str) and amount.replace(',', '').replace(' ', '').isdigit()):
        n = int(str(amount).replace(',', '').replace(' ', ''))
        formatted = f"금 {num_to_korean(n)}원정 (￦ {n:,})"
    else:
        formatted = str(amount)

    content = content.replace(
        '<hp:t>금 원정 (￦ )</hp:t>',
        f'<hp:t>{formatted}</hp:t>'
    )
    return content


def apply_seongeum(content, values):
    """
    선금신청서의 신청금액(3곳)·신청비율 자동 입력.
    values['_seongeum_rate']: 신청비율 (예: 50)
    values['7']: 계약금액
    """
    rate = values.get('_seongeum_rate')
    if not rate:
        return content

    # 신청비율 삽입
    content = content.replace(
        '<hp:t>7. 선금급 신청비율 : %</hp:t>',
        f'<hp:t>7. 선금급 신청비율 : {rate}%</hp:t>'
    )

    # 계약금액에서 숫자 추출
    contract_amount = values.get('7', '')
    amount_match = re.search(r'[0-9,]{5,}', contract_amount)
    if not amount_match:
        return content

    total = int(amount_match.group(0).replace(',', ''))
    seongeum = (total * int(rate)) // 100  # 원 미만만 절삭 (만원 단위 절삭 X)
    kor_amount = format_amount(seongeum)

    # 1페이지: "6. 선금급 신청금액 :"
    content = content.replace(
        '<hp:t>6. 선금급 신청금액 :</hp:t>',
        f'<hp:t>6. 선금급 신청금액 : {kor_amount}</hp:t>'
    )
    # 2페이지: "5. 선금급 신청금액 : "
    content = content.replace(
        '<hp:t>5. 선금급 신청금액 : </hp:t>',
        f'<hp:t>5. 선금급 신청금액 : {kor_amount}</hp:t>'
    )
    # 3페이지: "3. 선금 신청금액: "
    content = content.replace(
        '<hp:t>3. 선금 신청금액: </hp:t>',
        f'<hp:t>3. 선금 신청금액: {kor_amount}</hp:t>'
    )

    return content


# ── 통장사본 PDF 생성 ─────────────────────────────────────
def make_bankbook_pdf(values, skill_dir, output_dir):
    """업체명에 맞는 통장사본을 PDF로 생성하여 output_dir에 저장"""
    if '1' not in values:
        return None
    normalized = values['1'].replace(' ', '')
    img_filename = None
    for company, fname in BANKBOOK_IMAGES.items():
        if company in normalized:
            img_filename = fname
            break
    if not img_filename:
        return None

    img_path = os.path.join(skill_dir, 'templates', img_filename)
    if not os.path.exists(img_path):
        print(f"통장사본 이미지 없음: {img_path}")
        return None

    company_name = values['1'].replace(' ', '_')
    pdf_path = os.path.join(output_dir, f'통장사본_{company_name}.pdf')

    # PDF 입력이면 단순 복사 (이미 PDF), JPG/PNG면 reportlab 으로 변환
    if img_path.lower().endswith('.pdf'):
        import shutil
        shutil.copyfile(img_path, pdf_path)
    else:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from make_bankbook_pdf import create_bankbook_pdf
        create_bankbook_pdf(img_path, pdf_path)
    return pdf_path


# ── 메인 치환 ─────────────────────────────────────────────
def fill_hwpx(template_path, output_path, values):
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(template_path, 'r') as z:
            z.extractall(tmpdir)

        contents_dir = os.path.join(tmpdir, 'Contents')
        for filename in sorted(os.listdir(contents_dir)):
            if not (filename.startswith('section') and filename.endswith('.xml')):
                continue
            filepath = os.path.join(contents_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            if '2' in values and '{{2}}' in content:
                content = apply_address(content, values['2'])

            content = apply_bank_info(content, values)
            # _submission_date 가 있으면 전체 날짜 치환, 없으면 연도만 치환 (fallback)
            if values.get('_submission_date'):
                content = apply_submission_date(content, values)
            else:
                content = apply_submission_year(content, values)

            # 완료계: 완료일 자동 입력
            if '4__완료계' in template_path:
                content = apply_wanryo_date(content, values)

            # 선금신청서: 신청금액/비율 자동 입력
            if '3__선금신청서' in template_path:
                content = apply_seongeum(content, values)

            # 청구서: 청구금액 자동 입력 (계약금액 {{7}}과 별도)
            if '5__청구서' in template_path:
                content = apply_cheonggu_amount(content, values)

            for key, val in values.items():
                if key.startswith('_') or key == '2':
                    continue
                content = content.replace('{{' + str(key) + '}}', str(val))

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
            for root, dirs, files in os.walk(tmpdir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, tmpdir)
                    compress = zipfile.ZIP_STORED if arcname == 'mimetype' else zipfile.ZIP_DEFLATED
                    zout.write(file_path, arcname, compress_type=compress)


# ── 엔트리포인트 ──────────────────────────────────────────
if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("사용법: python fill_hwpx.py <템플릿.hwpx> <출력.hwpx> '<json값>'")
        sys.exit(1)

    raw_values = json.loads(sys.argv[3])
    values = auto_set_industry(raw_values)
    values = auto_set_bank(values)
    values = compute_dates(values)
    fill_hwpx(sys.argv[1], sys.argv[2], values)
    print(f"완료: {sys.argv[2]}")

    # 청구서인 경우 통장사본 PDF 별도 생성
    if '5__청구서' in sys.argv[1]:
        skill_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_dir = os.path.dirname(sys.argv[2])
        pdf_path = make_bankbook_pdf(values, skill_dir, output_dir)
        if pdf_path:
            print(f"통장사본 PDF 생성: {pdf_path}")
