const fs = require("fs");
const code = fs.readFileSync("src/pages/Dashboard.tsx", "utf8");

const startIndex = code.indexOf('className={`card-back');
const endIndex = code.indexOf('{tab.isNew && (', startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find start/end indices!");
  process.exit(1);
}

console.log(`Analyzing card-back from index ${startIndex} to ${endIndex}`);

const subCode = code.substring(startIndex, endIndex);
const preCode = code.substring(0, startIndex);
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
  
  // Skip JavaScript expressions inside curly braces but process JSX elements inside them
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

console.log("Card Back Errors:", errors);
console.log("Card Back Final Stack:", stack);
