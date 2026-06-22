const fs = require('fs');
const vm = require('vm');
try {
  const code = fs.readFileSync('logic.js', 'utf8');
  new vm.Script(code);
  console.log('SYNTAX_OK');
} catch (e) {
  console.log('SYNTAX_ERROR: ' + e.message);
}
