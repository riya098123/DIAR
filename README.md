# DIAR Diploma Verification

A local Flask app for generating diploma PDFs and QR codes, and viewing diploma verification pages.

## Requirements

- Python 3
- Internet access only if you want to run the optional Sepolia RPC check

## Install

Open a terminal in the project directory and create a virtual environment.

### Windows PowerShell

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install Flask "qrcode[pil]" reportlab python-dotenv web3
```

### macOS or Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install 'qrcode[pil]' Flask reportlab python-dotenv web3
```

## Run the App

With the virtual environment active, run:

```bash
python app.py
```

Open <http://127.0.0.1:5000> in your browser. Enter a student name and course to generate a diploma. The app stores records in `records.json`, diploma PDFs in `diplomas/`, and generated QR images in `static/`.

The app runs locally and does not require an RPC URL. Its built-in Flask server has debug mode enabled; use a production WSGI server and disable debug mode before deploying it beyond local development.

## Optional Sepolia RPC Check

To check the RPC connection separately, set `SEPOLIA_RPC_URL` in the project-root `.env` file, then run:

```bash
python test_rpc.py
```

The check prints whether it can connect and, on success, the connected chain ID. It does not issue diplomas or submit transactions to the blockchain. Keep RPC credentials private; `.env` is excluded by `.gitignore`.