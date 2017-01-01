const sessionId = Date.now() + '_' + Math.random().toString().replace('0.', '');

// init code mirror
const sourceCodeTX = document.querySelector('#source');
const sourceCodeCM = CodeMirror(function(elt) {
  sourceCodeTX.parentNode.replaceChild(elt, sourceCodeTX);
}, {mode: 'javascript', lineNumbers: true, value: sourceCodeTX.value});

const testCodeTX = document.querySelector('#test');
const testCodeCM = CodeMirror(function(elt) {
  testCodeTX.parentNode.replaceChild(elt, testCodeTX);
}, {mode: 'javascript', lineNumbers: true, value: testCodeTX.value});

const manualTX = document.querySelector('#manual');
const manualCM = CodeMirror(function(elt) {
  manualTX.parentNode.replaceChild(elt, manualTX);
}, {mode: 'markdown', lineNumbers: true, value:manualTX.value});

// handle tab buttons
const tabs = document.querySelectorAll('.tab-container > div');
const tabButtons = document.querySelectorAll('.tab-buttons [data-target]');
for (const tabButton of Array.from(tabButtons)) {
  tabButton.addEventListener('click', (ev)=>{
    const targetId = ev.target.dataset.target;
    for (const tab of Array.from(tabs)) {
      if (tab.id === targetId) {
        tab.style.zIndex = 100;
      } else {
        tab.style.zIndex = 0;
      }
    }
  });
}

// handle try button
const tryEl = document.querySelector('#tryButton');
const inputErrorMessageEl = document.querySelector('#inputErrorMessage');
const outputErrorMessageEl = document.querySelector('#outputErrorMessage');
const inputPaneEl = document.querySelector('#inputPane');
const outputPaneEl = document.querySelector('#outputPane');
const viewerEl = document.querySelector('#viewer');

function showInputError(message) {
  inputErrorMessageEl.style.display = null;
  inputErrorMessageEl.textContent = message;
}

function showOutputError(message) {
  outputErrorMessageEl.style.display = null;
  outputErrorMessageEl.textContent = message;
}

tryEl.addEventListener('click', ()=>{
  const sourceCode = sourceCodeCM.getValue();
  const testCode = testCodeCM.getValue();
  const manual = manualCM.getValue();

  outputPaneEl.classList.add('loading');
  viewerEl.removeAttribute('src');

  inputErrorMessageEl.style.display = 'none';
  outputErrorMessageEl.style.display = 'none';

  // check syntax: source code
  {
    const [error, errorMessage] = checkSyntax(sourceCode);
    if (error) {
      showInputError(errorMessage);
      return;
    }
  }

  // check syntax: test code
  {
    const [error, errorMessage] = checkSyntax(testCode);
    if (error) {
      showInputError(errorMessage);
      return;
    }
  }

  // generate
  window.ESDoc.post({sourceCode, testCode, manual, sessionId}, (error, res)=>{
    if (error) {
      showOutputError(res);
      return;
    }

    let destURL;
    try {
      destURL = JSON.parse(res).path;
    } catch (e) {
      showOutputError(e.message);
      return;
    }

    // polling
    const outputPath = JSON.parse(res).path;
    window.ESDoc.polling(outputPath + '/.finish.json', 10000, (error, resText)=>{
      if (error) {
        showOutputError(error.message);
        return;
      }

      try {
        const res = JSON.parse(resText);
        if (res.success) {
          viewerEl.src = destURL;
          outputPaneEl.classList.remove('loading');
        } else {
          showOutputError(res.message);
        }
      } catch (e) {
        showOutputError(e.message);
      }
    });
  });
});

// check syntax of codes
function checkSyntax(code) {
  const babylon = window.exports.parse;
  const option = {
    sourceType: 'module',
    plugins: [
      'jsx',
      'flow',
      'doExpressions',
      'objectRestSpread',
      'decorators',
      'classProperties',
      'exportExtensions',
      'asyncGenerators',
      'functionBind',
      'functionSent',
      'dynamicImport'
    ]
  };

  try {
    babylon(code, option);
    return [null, null];
  } catch (e) {
    const lineNumber = e.loc.line - 1;
    const columnNumber = e.loc.column;
    const codeLines = code.split('\n');
    const errorMessages = [e.message];
    for (let i = lineNumber, counter = 0; counter < 5 && i < codeLines.length; i++, counter++) {
      const l = (i + 1) < 10 ? ` ${i + 1}` : `${i + 1}`;
      if (counter === 0) {
        errorMessages.push(`> ${l} | ${codeLines[i]}`);
        errorMessages.push('       ' + ' '.repeat(columnNumber) + '^');
      } else {
        errorMessages.push(`  ${l} | ${codeLines[i]}`);
      }
    }
    return [e, errorMessages.join('\n')];
  }
}

// handle resizer
document.querySelector('.resizer').addEventListener('click', (ev)=>{
  if (inputPaneEl.style.display) {
    inputPaneEl.style.display = null;
    ev.target.textContent = '< >';
  } else {
    inputPaneEl.style.display = 'none';
    ev.target.textContent = '> <';
  }
});
