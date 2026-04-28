#!/usr/bin/env python3
"""
통장사본 이미지를 A4 PDF로 변환하는 스크립트
사용법: python make_bankbook_pdf.py <이미지.jpg> <출력.pdf>
"""

import sys
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Image as RLImage
from reportlab.lib.units import mm
from PIL import Image as PILImage


def create_bankbook_pdf(img_path: str, output_path: str) -> None:
    img = PILImage.open(img_path)
    w, h = img.size

    margin = 15 * mm
    page_w, page_h = A4
    avail_w = page_w - 2 * margin
    avail_h = page_h - 2 * margin

    ratio = min(avail_w / w, avail_h / h)
    img_w = w * ratio
    img_h = h * ratio

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=margin, rightMargin=margin,
        topMargin=margin, bottomMargin=margin
    )
    doc.build([RLImage(img_path, width=img_w, height=img_h)])
    print(f"완료: {output_path}")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("사용법: python make_bankbook_pdf.py <이미지.jpg> <출력.pdf>")
        sys.exit(1)
    create_bankbook_pdf(sys.argv[1], sys.argv[2])
