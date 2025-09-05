# Python Backend Setup

## Requirements
- Python 3.9+
- Groq API key

## Installation
1. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set your Groq API key in `.env` file

## Running the Server
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`