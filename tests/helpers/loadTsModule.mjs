import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const Module = require('node:module');

export function loadTsModule(relativePath) {
  const sourceUrl = new URL(relativePath, import.meta.url);
  const filename = fileURLToPath(sourceUrl);
  const source = readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const testModule = new Module(filename);
  testModule.filename = filename;
  testModule.paths = Module._nodeModulePaths(dirname(filename));
  testModule._compile(outputText, filename);

  return testModule.exports;
}
