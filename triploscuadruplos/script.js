
const OPERATORS = {
  '+': { precedence: 1, calculate: (a, b) => a + b },
  '-': { precedence: 1, calculate: (a, b) => a - b },
  '*': { precedence: 2, calculate: (a, b) => a * b },
  '/': { precedence: 2, calculate: (a, b) => a / b },
  'u+': { precedence: 3, calculate: a => a },
  'u-': { precedence: 3, calculate: a => -a }
};

function tokenize(expression) {
  const tokens = [];
  const pattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:([eE][+-]?\d+))?|([A-Za-z_]\w*)|([+\-*/()]))/y;
  let position = 0;

  while (position < expression.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(expression);

    if (!match) {
      throw new Error(`Carácter no válido: ${expression[position]}`);
    }

    position = pattern.lastIndex;

    if (match[1]) {
      tokens.push({ type: 'number', value: Number(match[1] + (match[2] || '')) });
    } else if (match[3]) {
      tokens.push({ type: 'identifier', value: match[3] });
    } else {
      tokens.push({ type: 'operator', value: match[4] });
    }
  }

  if (!tokens.length) throw new Error('Escribe una expresión.');

  return tokens;
}

function infixToPostfix(tokens) {
  const output = [];
  const operators = [];
  let expectsOperand = true;

  for (const token of tokens) {
    if (token.type !== 'operator') {
      if (!expectsOperand) throw new Error('Falta un operador entre los valores.');
      output.push(token);
      expectsOperand = false;
      continue;
    }

    let op = token.value;

    if (op === '(') {
      if (!expectsOperand) throw new Error('Falta un operador antes del paréntesis.');
      operators.push(op);
      expectsOperand = true;
      continue;
    }

    if (op === ')') {
      if (expectsOperand) throw new Error('Revisa el contenido de los paréntesis.');

      while (operators.length && operators.at(-1) !== '(') {
        output.push({ type: 'operator', value: operators.pop() });
      }

      if (!operators.length) throw new Error('Paréntesis sin pareja.');

      operators.pop();
      expectsOperand = false;
      continue;
    }

    if (expectsOperand && ['+', '-'].includes(op)) {
      op = op === '+' ? 'u+' : 'u-';
    } else if (expectsOperand) {
      throw new Error(`Falta un valor antes de ${op}.`);
    }

    const current = OPERATORS[op];

    while (operators.length && operators.at(-1) !== '(') {
      const top = OPERATORS[operators.at(-1)];

      if (top.precedence < current.precedence ||
          (top.precedence === current.precedence && op.startsWith('u'))) break;

      output.push({ type: 'operator', value: operators.pop() });
    }

    operators.push(op);
    expectsOperand = true;
  }

  if (expectsOperand) throw new Error('La expresión está incompleta.');

  while (operators.length) {
    const op = operators.pop();
    if (op === '(') throw new Error('Falta cerrar un paréntesis.');
    output.push({ type: 'operator', value: op });
  }

  return output;
}

function parseInput(input) {
  const expression = input.trim().replace(/;$/, '').trim();
  const match = expression.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
  const target = match ? match[1] : null;
  const math = match ? match[2] : expression;

  return { target, postfix: infixToPostfix(tokenize(math)) };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) throw new Error('El resultado no es finito.');
  return Number(value.toPrecision(12)).toString();
}

function calculate(postfix, target) {
  const stack = [];
  const steps = [];
  const quadruples = [];
  const triples = [];

  postfix.forEach(token => {
    if (token.type !== 'operator') {
      stack.push({
        text: String(token.value),
        numeric: token.type === 'number',
        value: token.value,
        quadruple: String(token.value),
        triple: String(token.value)
      });
      return;
    }

    const unary = token.value.startsWith('u');
    const first = stack.pop();
    const second = unary ? null : stack.pop();

    if (!first || (!unary && !second)) {
      throw new Error('Faltan valores para realizar la operación.');
    }

    const left = unary ? first : second;
    const right = unary ? null : first;
    const op = token.value.replace('u', '');
    const operator = OPERATORS[token.value];
    const expression = unary
      ? `${op}${left.text}`
      : `(${left.text} ${op} ${right.text})`;

    const numeric = left.numeric && (unary || right.numeric);
    let value = null;

    if (numeric) {
      if (op === '/' && right.value === 0) {
        throw new Error('No se puede dividir entre cero.');
      }

      value = unary
        ? operator.calculate(left.value)
        : operator.calculate(left.value, right.value);

      if (!Number.isFinite(value)) {
        throw new Error('El resultado no es finito.');
      }
    }

    const text = numeric ? formatNumber(value) : expression;
    steps.push(`${expression} = ${text}`);

    const temp = `t${quadruples.length + 1}`;
    quadruples.push({
      op,
      op1: left.quadruple,
      op2: right ? right.quadruple : '—',
      res: temp
    });

    const index = triples.length + 1;
    triples.push({
      op,
      op1: left.triple,
      op2: right ? right.triple : '—'
    });

    stack.push({
      text,
      numeric,
      value,
      quadruple: temp,
      triple: `(${index})`
    });
  });

  if (stack.length !== 1) {
    throw new Error('Expresión inválida. Revisa los operadores y paréntesis.');
  }

  const final = stack[0];

  if (target) {
    quadruples.push({ op: '=', op1: final.quadruple, op2: '—', res: target });
    triples.push({ op: '=', op1: target, op2: final.triple });
    steps.push(`${target} = ${final.text}`);
  }

  return {
    result: final.numeric ? formatNumber(final.value) : final.text,
    target,
    steps,
    quadruples,
    triples
  };
}

function renderTable(selector, rows, columns) {
  const body = document.querySelector(`${selector} tbody`);
  body.replaceChildren();

  rows.forEach((item, index) => {
    const row = document.createElement('tr');

    [index + 1, ...columns.map(column => item[column])].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });

    body.appendChild(row);
  });
}

function render(result) {
  document.getElementById('resultado').textContent =
    result.target ? `${result.target} = ${result.result}` : result.result;

  const list = document.getElementById('lista-pasos');
  list.replaceChildren();

  result.steps.forEach((step, index) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    const text = document.createElement('span');

    number.className = 'step-number';
    number.textContent = index + 1;
    text.textContent = step;
    item.append(number, text);
    list.appendChild(item);
  });

  renderTable('#tabla-cuadruplos', result.quadruples, ['op', 'op1', 'op2', 'res']);
  renderTable('#tabla-triplos', result.triples, ['op', 'op1', 'op2']);

  const code = result.quadruples.map(item => {
    if (item.op === '=') return `let ${item.res} = ${item.op1};`;
    return item.op2 === '—'
      ? `let ${item.res} = ${item.op}${item.op1};`
      : `let ${item.res} = ${item.op1} ${item.op} ${item.op2};`;
  }).join('\n');

  document.getElementById('codigo-js').textContent = code;
  document.getElementById('alerta').hidden = true;
  document.getElementById('resultado-panel').classList.add('has-result');
}

function clearResults() {
  document.getElementById('resultado').textContent = '—';
  document.getElementById('lista-pasos').innerHTML =
    '<li class="empty-state">Los pasos aparecerán aquí al calcular.</li>';

  document.querySelector('#tabla-cuadruplos tbody').replaceChildren();
  document.querySelector('#tabla-triplos tbody').replaceChildren();
  document.getElementById('codigo-js').textContent =
    'El código aparecerá aquí al calcular.';
  document.getElementById('alerta').hidden = true;
  document.getElementById('resultado-panel').classList.remove('has-result');
}

const form = document.getElementById('formulario');
const input = document.getElementById('expresion');

form.addEventListener('submit', event => {
  event.preventDefault();

  try {
    const parsed = parseInput(input.value);
    render(calculate(parsed.postfix, parsed.target));
  } catch (error) {
    clearResults();
    document.getElementById('alerta').textContent = error.message;
    document.getElementById('alerta').hidden = false;
  }
});

document.getElementById('limpiar').addEventListener('click', () => {
  input.value = '';
  clearResults();
  input.focus();
});

input.addEventListener('input', () => {
  document.getElementById('alerta').hidden = true;
});
