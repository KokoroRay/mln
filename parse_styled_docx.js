const fs = require('fs');

const xml = fs.readFileSync('document.xml', 'utf8');

// We want to parse the w:p tags
const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
let match;
let count = 0;

console.log("Parsing first 30 paragraphs with detailed styling:\n");

while ((match = pRegex.exec(xml)) !== null && count < 60) {
  const pContent = match[1];
  
  // Let's parse runs inside this paragraph
  const rRegex = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
  let rMatch;
  let pRuns = [];
  
  while ((rMatch = rRegex.exec(pContent)) !== null) {
    const rContent = rMatch[1];
    
    // Check styling in w:rPr
    const rPrMatch = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(rContent);
    const rPr = rPrMatch ? rPrMatch[1] : '';
    
    const isBold = /<w:b\/>|<w:b\s/.test(rPr);
    const isItalic = /<w:i\/>|<w:i\s/.test(rPr);
    const isUnderline = /<w:u\s/.test(rPr);
    const colorMatch = /<w:color\s+[^>]*w:val="([^"]*)"/.exec(rPr);
    const color = colorMatch ? colorMatch[1] : null;
    
    // Check text in w:t
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tMatch;
    let tText = '';
    while ((tMatch = tRegex.exec(rContent)) !== null) {
      tText += tMatch[1];
    }
    
    tText = tText
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
      
    if (tText) {
      pRuns.push({
        text: tText,
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        color: color
      });
    }
  }
  
  if (pRuns.length > 0) {
    count++;
    console.log(`P${count}:`);
    pRuns.forEach(r => {
      const styles = [];
      if (r.bold) styles.push('bold');
      if (r.italic) styles.push('italic');
      if (r.underline) styles.push('underline');
      if (r.color) styles.push(`color:#${r.color}`);
      const styleStr = styles.length > 0 ? ` [${styles.join(',')}]` : '';
      console.log(`  "${r.text}"${styleStr}`);
    });
  }
}
