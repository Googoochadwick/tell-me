# Tell-Me Extension Setup Guide

This guide walks you through setting up the Tell-Me extension to use the local Gemma 270M model instead of the Gemini API.

## Prerequisites

- Python 3.8+ installed and in PATH
- Node.js and npm installed
- Hugging Face account (free)
- Google Colab access

---

## Step 1: Download Gemma 270M Model from Colab

The extension uses the `google/functiongemma-270m-it` model locally. You'll need to download it from Google Colab first.

### 1.1 Open the Colab Notebook

A Colab notebook is included in this project: `Gemma_Transformers_Example.ipynb`

You can also open it directly from Colab:
- Go to [Google Colab](https://colab.research.google.com)
- Click "File" → "Open notebook" → "GitHub"
- Paste the repo URL and open the notebook

### 1.2 Accept the Model License

1. Go to https://huggingface.co/google/functiongemma-270m-it
2. Log in to your Hugging Face account
3. Accept the model usage terms (checkbox at the top of the page)
4. Generate an access token (Settings → Access Tokens) with "read" scope
5. Copy the token (starts with `hf_`)

### 1.3 Run Colab Cells

In the notebook, run these cells in order:

**Cell 1: Install Dependencies**
```python
!pip install transformers torch
```

**Cell 2: Login to Hugging Face**
```python
from huggingface_hub import login
login()
```
When prompted, paste your Hugging Face token.

**Cell 3: Download the Model**
```python
from huggingface_hub import snapshot_download
import os
import shutil

HF_TOKEN = os.environ.get("HUGGING_FACE_HUB_TOKEN", "hf_your_token_here")

local_dir = "/content/functiongemma-270m-it"
if os.path.exists(local_dir):
    shutil.rmtree(local_dir)

snapshot_download(
    repo_id="google/functiongemma-270m-it",
    local_dir=local_dir,
    token=HF_TOKEN
)

print("Saved to:", local_dir)
```

**Cell 4: Zip and Download**
```python
!rm -rf /content/functiongemma-270m-it/.cache
!cd /content && zip -r functiongemma-270m-it.zip functiongemma-270m-it
from google.colab import files
files.download("/content/functiongemma-270m-it.zip")
```

Allow pop-ups in your browser when prompted. The ZIP will download to your machine.

### 1.4 Extract the Model Locally

1. Unzip `functiongemma-270m-it.zip` to your machine
2. Place the extracted folder `functiongemma-270m-it/` **in the project root** (same level as `package.json`)
   ```
   tell-me/
   ├── functiongemma-270m-it/          ← Put model here
   │   ├── config.json
   │   ├── model.safetensors
   │   ├── tokenizer.json
   │   └── ... (other files)
   ├── src/
   ├── package.json
   ├── .env
   └── ...
   ```

---

## Step 2: Setup Python Virtual Environment

The extension spawns a Python process to run the model. You should use a virtual environment to isolate dependencies.

### 2.1 Create venv

```powershell
cd C:\Users\palpr\Programming_Projects\Hackathon\VSCode-TheHelper\tell-me
python -m venv .venv
```

### 2.2 Activate venv

```powershell
.\.venv\Scripts\Activate.ps1
```

If you get an execution policy error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\.venv\Scripts\Activate.ps1
```

### 2.3 Install Dependencies

```powershell
pip install --upgrade pip
pip install transformers torch
```

This may take 5-10 minutes depending on your internet speed.

### 2.4 Verify Installation

```powershell
python -c "from transformers import pipeline; print('OK')"
```

Should print `OK`.

---

## Step 3: Configure Environment Variables

### 3.1 Copy .env.example to .env

The project includes `.env.example`. Copy it:

```powershell
Copy-Item .env.example .env
```

### 3.2 Edit .env

Open `.env` and set the model path:

```dotenv
GEMMA_MODEL_DIR=C:\Users\palpr\Programming_Projects\Hackathon\VSCode-TheHelper\tell-me\functiongemma-270m-it
# PYTHON_VENV=C:\Users\palpr\Programming_Projects\Hackathon\VSCode-TheHelper\tell-me\.venv
```

The extension will auto-detect `.venv` in the project root, so `PYTHON_VENV` is optional.

---

## Step 4: Install Node Dependencies

Install the npm packages for the extension:

```powershell
npm install --force
```

---

## Step 5: Compile and Run the Extension

### 5.1 Compile TypeScript

```powershell
npm run compile
```

Should compile without errors.

### 5.2 Launch the Extension

Press **F5** in VS Code. This opens a new VS Code window with the extension loaded.

---

## Step 6: Test the Extension

### 6.1 Open a C/C++ File

In the extension window:
1. Create or open a C/C++ file (`.c` or `.cpp`)
2. Write some code (e.g., a simple "hello world" or code with an intentional error)

Example `test.cpp`:
```cpp
#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
```

### 6.2 Run "Compile & Run"

1. Open the **Tell-me** sidebar view (icon in activity bar)
2. Click **"Compile & Run"** button
3. The extension will:
   - Compile the C/C++ file using gcc/g++
   - Run the executable
   - Pass the output + code to the local Gemma model
   - Display educational feedback in the sidebar

---

## Troubleshooting

### Model folder not found
**Error:** `Model folder not found: ...`
- **Fix:** Ensure the `functiongemma-270m-it` folder is in the project root with all files (config.json, model.safetensors, tokenizer.json, etc.)

### Python not found
**Error:** `Failed to spawn Python: ...`
- **Fix:** Ensure the `.venv` folder exists at project root and is activated. Or install Python globally and add to PATH.

### transformers module not found
**Error:** `ModuleNotFoundError: No module named 'transformers'`
- **Fix:** Activate the venv and run `pip install transformers torch`
  ```powershell
  .\.venv\Scripts\Activate.ps1
  pip install transformers torch
  ```

### Model taking too long to load
**Symptom:** First run takes 2-5 minutes
- **Expected:** The model (1-2GB) loads from disk on first use. Subsequent runs are faster.
- **Tip:** You'll see "Model loaded successfully" in the Debug Console when done.

### venv not being used
**Error:** Python error occurs despite venv setup
- **Fix:** Ensure `.venv` folder path is correct. You can also set `PYTHON_VENV` in `.env`:
  ```dotenv
  PYTHON_VENV=C:\Users\palpr\Programming_Projects\Hackathon\VSCode-TheHelper\tell-me\.venv
  ```

### Extension not appearing in sidebar
**Fix:** 
1. Press Ctrl+Shift+P and type "Tell-me"
2. Ensure "Tell-me" is enabled in the Activity Bar
3. Check the Debug Console (View → Debug Console) for activation errors

---

## Optional: Using a Global Python Instead of venv

If you prefer not to use a venv:

1. Install globally:
   ```powershell
   pip install transformers torch
   ```

2. The extension will default to global `python` if `.venv` doesn't exist

3. Still set `GEMMA_MODEL_DIR` in `.env`

---

## Summary of Folder Structure

After setup, your folder should look like:

```
tell-me/
├── .venv/                          ← Python virtual environment
│   ├── Scripts/
│   │   ├── python.exe
│   │   └── ...
│   └── Lib/
├── functiongemma-270m-it/          ← Gemma model (from Colab)
│   ├── config.json
│   ├── model.safetensors
│   ├── tokenizer.json
│   ├── tokenizer.model
│   ├── tokenizer_config.json
│   └── ...
├── src/
│   ├── extension.ts
│   ├── diagnosticsViewProvider.mts
│   └── test/
├── out/                            ← Compiled JS (auto-generated)
├── package.json
├── tsconfig.json
├── .env                            ← Environment variables
├── .env.example
├── SETUP_STEPS.md                  ← This file
├── Gemma_Transformers_Example.ipynb
└── ...
```

---

## Quick Reference Commands

```powershell
# Create and activate venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install Python dependencies
pip install transformers torch

# Install Node dependencies
npm install

# Compile extension
npm run compile

# Launch extension (F5 in VS Code)
# Or run: code --extensionDevelopmentPath=. 

# Deactivate venv
deactivate
```

---

## Need Help?

If you encounter issues:
1. Check the **Debug Console** (View → Debug Console) for error messages
2. Verify the model folder exists and contains all files
3. Ensure `.venv` is activated and has `transformers` installed
4. Check `.env` file has the correct paths
5. Re-run `npm run compile` and restart the extension (F5)

