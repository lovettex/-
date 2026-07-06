const fs = require("fs");
const code = fs.readFileSync("src/pages/Dashboard.tsx", "utf8");
const lines = code.split("\n");

// Get lines from 5221 to 5384 (0-indexed 5220 to 5383)
const subCode = lines.slice(5220, 5384).join("\n");
const lineOffset = 5221;

let pos = 0;
const len = subCode.length;
const stack = [];
let errors = 0;

function getLineNum(index) {
  return lineOffset + subCode.substring(0, index).split("\n").length - 1;
}

while (pos < len) {
  const char = subCode[pos];
  
  // Ignore typescript-specific braces for mapping, but let's parse tags
  if (char === "<") {
    const nextChar = subCode[pos + 1];
    if (nextChar === "/" || /[a-zA-Z]/.test(nextChar) || nextChar === ">") {
      let tagEnd = pos;
      let inQuote = false;
      let quoteChar = "";
      while (tagEnd < len) {
        const c = subCode[tagEnd];
        if (inQuote) {
          if (c === quoteChar) inQuote = false;
          else if (c === "\\") tagEnd++;
        } else {
          if (c === "\"" || c === "'" || c === "`") {
            inQuote = true;
            quoteChar = c;
          } else if (c === ">") {
            break;
          }
        }
        tagEnd++;
      }
      
      const tagContent = subCode.substring(pos, tagEnd + 1);
      const isClosing = tagContent.startsWith("</");
      const isSelfClosing = tagContent.endsWith("/>") || tagContent.includes("ShieldCheck") || tagContent.includes("Gamepad2") || tagContent.includes("ChevronDown") || tagContent.includes("ChevronUp");
      
      let tagName = "";
      if (isClosing) {
        tagName = tagContent.substring(2, tagContent.length - 1).trim();
      } else {
        tagName = tagContent.substring(1, tagContent.length - 1).trim();
      }
      tagName = tagName.split(/\s+/)[0];
      if (tagName.endsWith("/")) tagName = tagName.slice(0, -1);
      if (tagName === "") tagName = "fragment";
      
      const lineNum = getLineNum(pos);
      
      if (!isSelfClosing) {
        if (isClosing) {
          const popped = stack.pop();
          if (!popped) {
            console.log(`[Line ${lineNum}] Error: closed </${tagName}> but stack is empty.`);
            errors++;
          } else if (popped.name !== tagName) {
            console.log(`[Line ${lineNum}] Error: closed </${tagName}>, but expected </${popped.name}> (opened on line ${popped.line})`);
            errors++;
            stack.push(popped);
          }
        } else {
          stack.push({ name: tagName, line: lineNum });
        }
      }
      pos = tagEnd + 1;
      continue;
    }
  }
  
  pos++;
}

console.log("Expanded Block Errors:", errors);
console.log("Expanded Block Final Stack:", stack);
