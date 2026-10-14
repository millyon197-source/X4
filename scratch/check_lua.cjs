const fs = require('fs');
const content = fs.readFileSync('lua/encyclopedia_bridge.lua', 'utf8');

// Use a simple lua tokenizer / parser
// Match tokens
const tokenRegex = /(--\[\[[\s\S]*?\]\]|--[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[\[[\s\S]*?\]\])|\b(function|if|then|elseif|else|while|for|do|repeat|until|end)\b|([a-zA-Z_]\w*)/g;

let stack = [];
let match;
let lines = [0];
for (let i = 0; i < content.length; i++) {
  if (content[i] === '\n') lines.push(i);
}
function getLine(pos) {
  let low = 0, high = lines.length - 1;
  while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    if (lines[mid] <= pos) low = mid + 1;
    else high = mid - 1;
  }
  return high + 1;
}

while ((match = tokenRegex.exec(content)) !== null) {
  const comment = match[1];
  const str = match[2];
  const kw = match[3];
  if (comment || str || !kw) continue;
  const line = getLine(match.index);

  if (kw === 'function' || kw === 'while' || kw === 'repeat') {
    stack.push({ kw, line });
  } else if (kw === 'for') {
    stack.push({ kw, line });
  } else if (kw === 'if') {
    stack.push({ kw, line });
  } else if (kw === 'do') {
    // If previous was 'for' or 'while', it pairs with it
    const top = stack[stack.length - 1];
    if (top && (top.kw === 'for' || top.kw === 'while')) {
      top.kw = top.kw + '_do';
    } else {
      stack.push({ kw: 'do', line });
    }
  } else if (kw === 'then') {
    const top = stack[stack.length - 1];
    if (top && top.kw === 'if') {
      top.kw = 'if_then';
    }
  } else if (kw === 'elseif' || kw === 'else') {
    // doesn't push a new block
  } else if (kw === 'end') {
    if (stack.length === 0) {
      console.log('Unexpected "end" at line', line);
    } else {
      const popped = stack.pop();
    }
  } else if (kw === 'until') {
    if (stack.length === 0) {
      console.log('Unexpected "until" at line', line);
    } else {
      stack.pop();
    }
  }
}

console.log('Remaining unclosed blocks:', stack.length);
stack.forEach(s => console.log(`Unclosed ${s.kw} at line ${s.line}`));
