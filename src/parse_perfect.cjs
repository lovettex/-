const ts = require("typescript");
const fs = require("fs");

const filePath = "src/pages/Dashboard.tsx";
const sourceCode = fs.readFileSync(filePath, "utf8");

// Parse the file using TypeScript AST parser
const sourceFile = ts.createSourceFile(
  filePath,
  sourceCode,
  ts.ScriptTarget.Latest,
  true // setParentNodes
);

console.log("TS Source File parsed successfully.");

// Let's traverse the AST to find JSX elements and print their structure,
// or let's find JSX diagnostics!
const program = ts.createProgram([filePath], {
  noEmit: true,
  jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
});

const diagnostics = ts.getPreEmitDiagnostics(program);

console.log(`Found ${diagnostics.length} diagnostic messages:`);
diagnostics.forEach((diag) => {
  if (diag.messageText) {
    const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
    if (diag.file) {
      const { line, character } = diag.file.getLineAndCharacterOfPosition(diag.start);
      console.log(`[Line ${line + 1}, Col ${character + 1}] ${message}`);
    } else {
      console.log(message);
    }
  }
});
