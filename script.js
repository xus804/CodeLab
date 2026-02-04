const samples = {
    javascript: 'console.log("Hello World!");',
    python: 'print("Hello World!")',
    java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello World!");\n  }\n}',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello World!";\n  return 0;\n}',
    csharp: 'using System;\n\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello World!");\n  }\n}',
    php: '<?php\necho "Hello World!";\n?>',
    ruby: 'puts "Hello World!"',
    go: 'package main\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello World!")\n}',
    swift: 'print("Hello World!")',
    rust: 'fn main() {\n  println!("Hello World!");\n}'
};

const modes = {
    javascript: 'javascript',
    python: 'python',
    java: 'text/x-java',
    cpp: 'text/x-c++src',
    csharp: 'text/x-csharp',
    php: 'php',
    ruby: 'ruby',
    go: 'go',
    swift: 'swift',
    rust: 'rust'
};

const ed = CodeMirror.fromTextArea(document.getElementById('code'), {
    mode: 'javascript',
    theme: 'material-ocean',
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2
});

ed.setValue(samples.javascript);

const ls = document.getElementById('lang');
const out = document.getElementById('out');
const runBtn = document.getElementById('run');

ls.onchange = () => {
    const l = ls.value;
    ed.setOption('mode', modes[l]);
    ed.setValue(samples[l]);
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

runBtn.onclick = async () => {
    const lang = ls.value;
    const code = ed.getValue();
    out.innerHTML = '<div class="loading"><div class="spinner"></div><span>Executing code...</span></div>';
    runBtn.disabled = true;

    try {
        const response = await fetch('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: lang, code: code })
        });

        const result = await response.json();
        out.innerHTML = '';

        if (result.success) {
            if (result.output) {
                out.innerHTML += '<div class="output-success">✓ Execution successful</div>';
                out.innerHTML += `<div class="output-log">${escapeHtml(result.output)}</div>`;
            } else {
                out.innerHTML = '<div class="output-info">Code executed successfully (no output)</div>';
            }
            if (result.stderr) {
                out.innerHTML += `<div class="output-error">${escapeHtml(result.stderr)}</div>`;
            }
        } else {
            out.innerHTML = `<div class="output-error">Error: ${escapeHtml(result.error || 'Unknown error')}`;
            if (result.stderr) {
                out.innerHTML += `\n\n${escapeHtml(result.stderr)}`;
            }
            out.innerHTML += '</div>';
        }
    } catch (error) {
        out.innerHTML = `<div class="output-error">Error: ${escapeHtml(error.message)}</div>`;
    } finally {
        runBtn.disabled = false;
    }
};

document.getElementById('clear').onclick = () => {
    ed.setValue('');
    out.innerHTML = '';
};

document.getElementById('reset').onclick = () => {
    ed.setValue(samples[ls.value]);
    out.innerHTML = '';
};

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runBtn.click();
    }
});
