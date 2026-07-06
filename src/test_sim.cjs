const fs = require("fs");
let code = fs.readFileSync("src/pages/Dashboard.tsx", "utf8");
const lines = code.split("\n");

// Modify lines in memory (0-indexed in JS)
// Lines 5219 and 5220 are at indices 5218 and 5219. We will replace them with empty strings.
lines[5218] = ""; // 5219
lines[5219] = ""; // 5220

// Line 5389 is at index 5388. Replace with empty string.
lines[5388] = ""; // 5389

const simCode = lines.join("\n");

// Now let's run the tag analyzer logic on simCode
const startIndex = simCode.lastIndexOf("const renderCard = ");
const endIndex = simCode.indexOf("return group.isGroup ?", startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find start/end of renderCard in simCode");
  process.exit(1);
}

const subCode = simCode.substring(startIndex, endIndex);
const preCode = simCode.substring(0, startIndex);
const lineOffset = preCode.split("\n").length;

let pos = 0;
const len = subCode.length;
const stack = [];
let errors = 0;

function getLineNum(index) {
  return lineOffset + subCode.substring(0, index).split("\n").length - 1;
}

while (pos < len) {
  const char = subCode[pos];
  
  if (char === "{") {
    let braceCount = 1;
    pos++;
    while (pos < len && braceCount > 0) {
      if (subCode[pos] === "{") braceCount++;
      else if (subCode[pos] === "}") braceCount--;
      else if (subCode[pos] === "\"" || subCode[pos] === "'" || subCode[pos] === "`") {
        const quote = subCode[pos];
        pos++;
        while (pos < len && subCode[pos] !== quote) {
          if (subCode[pos] === "\\") pos++;
          pos++;
        }
      }
      pos++;
    }
    continue;
  }
  
  if (subCode.substring(pos, pos + 4) === "{/*") {
    pos += 4;
    while (pos < len && subCode.substring(pos, pos + 3) !== "*/}") {
      pos++;
    }
    pos += 3;
    continue;
  }
  
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
      const isSelfClosing = tagContent.endsWith("/>");
      
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

console.log("Simulated Analyzer Errors:", errors);
console.log("Final simulated stack:", stack);
