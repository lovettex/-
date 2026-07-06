const ts = require("typescript");
const fs = require("fs");

console.log("Parsing Dashboard.tsx with TypeScript Compiler API...");

const fileName = "src/pages/Dashboard.tsx";
const sourceCode = fs.readFileSync(fileName, "utf8");

// Parse the source file
const sourceFile = ts.createSourceFile(
  fileName,
  sourceCode,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

// Get syntax diagnostics
const diagnostics = ts.createProgram([fileName], {
  jsx: ts.JsxEmit.React,
  noEmit: true,
  target: ts.ScriptTarget.Latest,
}).getSemanticDiagnostics().concat(
  ts.createProgram([fileName], {
    jsx: ts.JsxEmit.React,
    noEmit: true,
    target: ts.ScriptTarget.Latest,
  }).getSyntacticDiagnostics()
);

if (diagnostics.length === 0) {
  console.log("No AST or compilation errors found in Dashboard.tsx!");
} else {
  console.log(`Found ${diagnostics.length} diagnostic messages:`);
  diagnostics.forEach((diag) => {
    if (diag.file && diag.start) {
      const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
      const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
      console.log(`[Line ${line + 1}, Col ${character + 1}] Code ${diag.code}: ${message}`);
    } else {
      console.log(`Code ${diag.code}: ${ts.flattenDiagnosticMessageText(diag.messageText, "\n")}`);
    }
  });
}
