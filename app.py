# app.py (Flask application)

from flask import Flask, render_template, request, jsonify
import subprocess
import os

app = Flask(__name__)

CODE_DIR = "user_code"
os.makedirs(CODE_DIR, exist_ok=True)

@app.route('/')
def index():
    files = [f for f in os.listdir(CODE_DIR) if f.endswith(".py")]
    return render_template('index.html', files=files)

@app.route('/run', methods=['POST'])
def run_code():
    code = request.form['code']
    try:
        process = subprocess.Popen(['python', '-c', code], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        output, error = process.communicate()
        if error:
            return jsonify({'output': error, 'error': True})
        return jsonify({'output': output, 'error': False})
    except Exception as e:
        return jsonify({'output': str(e), 'error': True})

@app.route('/save', methods=['POST'])
def save_code():
    filename = request.form['filename']
    code = request.form['code']
    filepath = os.path.join(CODE_DIR, filename)
    try:
        with open(filepath, 'w') as f:
            f.write(code)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/load', methods=['POST'])
def load_code():
    filename = request.form['filename']
    filepath = os.path.join(CODE_DIR, filename)
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        return jsonify({'code': code})
    except FileNotFoundError:
        return jsonify({'error': 'File not found'})
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True)
