"""OCR processing module.

Priority chain: RapidOCR (ONNX) > Tesseract CLI > skip.
Mirrors the Rust OCR logic in pipeline.rs.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class OcrResult:
    text: str
    confidence: float
    engine: str


def ocr_image(image_path: str | Path) -> OcrResult:
    """Run OCR on a single image file. Tries engines in priority order."""
    image_path = Path(image_path)

    # Try RapidOCR first
    result = _try_rapidocr(image_path)
    if result:
        return result

    # Fallback to Tesseract CLI
    result = _try_tesseract(image_path)
    if result:
        return result

    return OcrResult(text="", confidence=0.0, engine="none")


def ocr_pdf_page(pdf_path: str | Path, page_number: int) -> OcrResult:
    """Extract a specific page from PDF as image, then OCR it."""
    pdf_path = Path(pdf_path)
    try:
        import fitz

        doc = fitz.open(str(pdf_path))
        if page_number < 1 or page_number > doc.page_count:
            doc.close()
            return OcrResult(text="", confidence=0.0, engine="error")

        page = doc.load_page(page_number - 1)
        pix = page.get_pixmap(dpi=200)
        img_path = pdf_path.parent / f"_ocr_tmp_p{page_number}.png"
        pix.save(str(img_path))
        doc.close()

        result = ocr_image(img_path)

        try:
            img_path.unlink()
        except OSError:
            pass

        return result
    except Exception as e:
        logger.warning("OCR page extraction failed: %s", e)
        return OcrResult(text="", confidence=0.0, engine="error")


def has_ocr_engine() -> bool:
    """Check if any OCR engine is available."""
    return _has_rapidocr() or shutil.which("tesseract") is not None


def _has_rapidocr() -> bool:
    import importlib.util

    return importlib.util.find_spec("rapidocr_onnxruntime") is not None


def _try_rapidocr(image_path: Path) -> OcrResult | None:
    try:
        from rapidocr_onnxruntime import RapidOCR

        engine = RapidOCR()
        result, _ = engine(str(image_path))

        if not result:
            return None

        lines = []
        total_conf = 0.0
        for item in result:
            if len(item) >= 2:
                lines.append(item[1])
                total_conf += item[2] if len(item) > 2 else 0.9

        text = "\n".join(lines)
        avg_conf = total_conf / len(result) if result else 0.0

        return OcrResult(text=text, confidence=avg_conf, engine="rapidocr")
    except ImportError:
        return None
    except Exception as e:
        logger.warning("RapidOCR failed: %s", e)
        return None


def _try_tesseract(image_path: Path) -> OcrResult | None:
    tesseract = shutil.which("tesseract")
    if not tesseract:
        return None

    try:
        proc = subprocess.run(
            [tesseract, str(image_path), "stdout", "--psm", "6"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        text = proc.stdout.strip()
        if text:
            return OcrResult(text=text, confidence=0.8, engine="tesseract")
    except Exception as e:
        logger.warning("Tesseract failed: %s", e)

    return None



