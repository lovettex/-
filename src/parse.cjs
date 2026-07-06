const fs = require("fs");
const code = fs.readFileSync("src/pages/Dashboard.tsx", "utf8");

const startIndex = code.lastIndexOf("const renderCard = ");
const endIndex = code.indexOf("return group.isGroup ?", startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not find start/end indices!");
  process.exit(1);
}

console.log(`Analyzing renderCard from line ${code.substring(0, startIndex).split("\n").length}`);

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
  
  // Skip strings in general to avoid matching tags in strings
  if (char === "\"" || char === "'" || char === "`") {
    const quote = char;
    pos++;
    while (pos < len && subCode[pos] !== quote) {
      if (subCode[pos] === "\\") pos++;
      pos++;
    }
    pos++;
    continue;
  }
  
  // Detect JSX comments {/* ... */}
  if (subCode.substring(pos, pos + 4) === "{/*") {
    pos += 4;
    while (pos < len && subCode.substring(pos, pos + 3) !== "*/}") {
      pos++;
    }
    pos += 3;
    continue;
  }
  
  // Detect standard HTML comments <!-- ... -->
  if (subCode.substring(pos, pos + 4) === "<!--") {
    pos += 4;
    while (pos < len && subCode.substring(pos, pos + 3) !== "-->") {
      pos++;
    }
    pos += 3;
    continue;
  }
  
  if (char === "<") {
    const nextChar = subCode[pos + 1];
    
    // Check if it looks like a tag
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
          } else {
            // console.log(`[Line ${lineNum}] Closed </${tagName}> (opened on line ${popped.line})`);
          }
        } else {
          // console.log(`[Line ${lineNum}] Opened <${tagName}>`);
          stack.push({ name: tagName, line: lineNum });
        }
      }
      pos = tagEnd + 1;
      continue;
    }
  }
  
  pos++;
}

console.log("\nErrors:", errors);
console.log("Final stack:", stack);
