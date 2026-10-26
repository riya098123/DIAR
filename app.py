
import json
import hashlib
import secrets
from pathlib import Path

import qrcode
from flask import Flask, request, render_template, send_file, url_for, redirect
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
PDF_DIR = BASE_DIR / "diplomas"
STATIC_DIR = BASE_DIR / "static"
DATA_FILE = BASE_DIR / "records.json"

PDF_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

if not DATA_FILE.exists():
    DATA_FILE.write_text("{}", encoding="utf-8")


def load_records():
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def save_records(records):
    DATA_FILE.write_text(json.dumps(records, indent=2), encoding="utf-8")


def valid_diploma_id(diploma_id):
    return (
        len(diploma_id) == 16
        and all(c in "0123456789abcdefABCDEF" for c in diploma_id)
    )


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_pdf(name, course, diploma_id):
    path = PDF_DIR / f"{diploma_id}.pdf"
    pdf = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4

    pdf.setTitle("DIAR Academic Diploma")
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawCentredString(width / 2, height - 100, "ACADEMIC DIPLOMA")

    pdf.setFont("Helvetica", 14)
    pdf.drawCentredString(width / 2, height - 160, "This certifies that")

    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawCentredString(width / 2, height - 200, name)

    pdf.setFont("Helvetica", 14)
    pdf.drawCentredString(
        width / 2, height - 240, f"has completed {course}"
    )

    pdf.setFont("Helvetica", 10)
    pdf.drawString(60, 100, f"Diploma ID: {diploma_id}")
    pdf.drawString(60, 80, "DIAR verification system")
    pdf.save()

    return path


@app.route("/", methods=["GET", "POST"])
def index():
    message = None

    if request.method == "POST":
        name = request.form.get("name", "").strip()
        course = request.form.get("course", "").strip()

        if not name or not course:
            message = "Enter both student name and course."
        else:
            diploma_id = secrets.token_hex(8).upper()
            pdf_path = create_pdf(name, course, diploma_id)
            digest = sha256_file(pdf_path)

            records = load_records()
            records[diploma_id] = {
                "student_name": name,
                "course": course,
                "sha256": digest,
                "revoked": False
            }
            save_records(records)

            verification_url = url_for(
                "verify", diploma_id=diploma_id, _external=True
            )
            qrcode.make(verification_url).save(
                STATIC_DIR / f"{diploma_id}.png"
            )

            return redirect(url_for("issued", diploma_id=diploma_id))

    return render_template("index.html", message=message)


@app.route("/issued/<diploma_id>")
def issued(diploma_id):
    if not valid_diploma_id(diploma_id):
        return "Invalid diploma ID", 400

    record = load_records().get(diploma_id)
    pdf_path = PDF_DIR / f"{diploma_id}.pdf"

    if not record or not pdf_path.is_file():
        return "Diploma not found", 404

    document_hash = sha256_file(pdf_path)

    if document_hash != record["sha256"]:
        return "PDF hash mismatch. Do not register this diploma.", 409

    return render_template(
        "issued.html",
        diploma_id=diploma_id,
        document_hash=document_hash,
        record=record,
        pdf_url=url_for("download", diploma_id=diploma_id),
        qr_url=url_for("qr_image", diploma_id=diploma_id)
    )


@app.route("/download/<diploma_id>")
def download(diploma_id):
    if not valid_diploma_id(diploma_id):
        return "Invalid diploma ID", 400

    path = PDF_DIR / f"{diploma_id}.pdf"
    if not path.is_file():
        return "Diploma not found", 404

    return send_file(path, as_attachment=True)


@app.route("/verify/<diploma_id>")
def verify(diploma_id):
    if not valid_diploma_id(diploma_id):
        return "Invalid diploma ID", 400

    pdf_path = PDF_DIR / f"{diploma_id}.pdf"

    return render_template(
        "verify.html",
        diploma_id=diploma_id,
        pdf_url=url_for("diploma_file", diploma_id=diploma_id),
        pdf_available=pdf_path.is_file()
    )


@app.route("/diploma-file/<diploma_id>")
def diploma_file(diploma_id):
    if not valid_diploma_id(diploma_id):
        return "Invalid diploma ID", 400

    path = PDF_DIR / f"{diploma_id}.pdf"
    if not path.is_file():
        return "Diploma PDF not found in local storage", 404

    return send_file(
        path,
        mimetype="application/pdf",
        as_attachment=False,
        download_name=f"{diploma_id}.pdf"
    )


@app.route("/qr/<diploma_id>")
def qr_image(diploma_id):
    if not valid_diploma_id(diploma_id):
        return "Invalid diploma ID", 400

    path = STATIC_DIR / f"{diploma_id}.png"
    if not path.is_file():
        return "QR code not found", 404

    return send_file(path, mimetype="image/png")


if __name__ == "__main__":
    app.run(debug=True)
