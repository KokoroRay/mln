const fs = require('fs');

const paragraphs = JSON.parse(fs.readFileSync('processed_paragraphs.json', 'utf8'));

// Identify chapter indexes
let dcIndex = paragraphs.findIndex(p => p.text.includes('ĐỀ CƯƠNG ÔN MLN111'));
let c1Index = paragraphs.findIndex(p => p.text.includes('CHƯƠNG 1: KHÁI LUẬN TRIẾT HỌC'));
let c2Index = paragraphs.findIndex(p => p.text.includes('CHƯƠNG 2 – CHỦ NGHĨA DUY VẬT BIỆN CHỨNG'));
let c3Index = paragraphs.findIndex(p => p.text.includes('CHƯƠNG 3: CHỦ NGHĨA DUY VẬT LỊCH SỬ'));

if (dcIndex === -1) dcIndex = 10;
if (c1Index === -1) c1Index = 493;
if (c2Index === -1) c2Index = 785;
if (c3Index === -1) c3Index = 1242;

const ranges = [
  { name: 'Đề cương ôn tập chung', start: dcIndex, end: c1Index },
  { name: 'Chương 1', start: c1Index, end: c2Index },
  { name: 'Chương 2', start: c2Index, end: c3Index },
  { name: 'Chương 3', start: c3Index, end: paragraphs.length }
];

function isQuestion(text) {
  return /^(?:Câu\s*\d+(?:\.\d+)?|C\d+|Câu\s*mở\s*đầu|C[Ââ]u\s*\d+)/i.test(text);
}

function isOptionStart(text) {
  return /^[a-eA-E]\s*[\.\)]/.test(text);
}

function parseOptionsFromParagraph(p) {
  const text = p.text;
  const optionRegex = /(?:^|\s+)([a-eA-E])\s*[\.\)]\s*/g;
  const matches = [];
  let match;
  while ((match = optionRegex.exec(text)) !== null) {
    matches.push({
      key: match[1].toLowerCase(),
      index: match.index,
      prefixLength: match[0].length
    });
  }
  
  if (matches.length === 0) {
    return [];
  }
  
  const options = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const startIdx = current.index;
    const endIdx = next ? next.index : text.length;
    
    const optionRawText = text.substring(startIdx, endIdx).trim();
    const cleanText = optionRawText.replace(/^[a-eA-E]\s*[\.\)]\s*/, '').trim();
    
    let charCount = 0;
    let boldChars = 0;
    let redChars = 0;
    let totalCharsInRange = 0;
    let startsWithBold = false;
    
    p.runs.forEach(run => {
      const runLen = run.text.length;
      const runStart = charCount;
      const runEnd = charCount + runLen;
      
      const overlapStart = Math.max(runStart, startIdx);
      const overlapEnd = Math.min(runEnd, endIdx);
      
      if (overlapStart < overlapEnd) {
        const overlapLen = overlapEnd - overlapStart;
        totalCharsInRange += overlapLen;
        if (run.bold) boldChars += overlapLen;
        if (run.color === 'FF0000') redChars += overlapLen;
        
        // Check if the run at the start of this option is bold
        if (overlapStart === startIdx && run.bold) {
          startsWithBold = true;
        }
      }
      
      charCount += runLen;
    });
    
    options.push({
      key: current.key,
      text: cleanText,
      boldChars,
      redChars,
      totalChars: totalCharsInRange,
      startsWithBold
    });
  }
  
  return options;
}

const rawQuestions = [];
let currentQuestion = null;

paragraphs.forEach((p, idx) => {
  const chapter = ranges.find(r => idx >= r.start && idx < r.end);
  const chapterName = chapter ? chapter.name : 'Unknown';
  
  if (isQuestion(p.text)) {
    if (currentQuestion) {
      rawQuestions.push(currentQuestion);
    }
    
    const questionText = p.text.replace(/^(?:Câu\s*\d+(?:\.\d+)?|C\d+|Câu\s*mở\s*đầu|C[Ââ]u\s*\d+)\s*[:.]?\s*/i, '').trim();
    const inlineOptions = parseOptionsFromParagraph(p);
    
    currentQuestion = {
      id: `q_${idx}`,
      chapter: chapterName,
      question: questionText,
      options: [],
      rawOptionsData: inlineOptions
    };
  } else if (isOptionStart(p.text) && currentQuestion) {
    const parsed = parseOptionsFromParagraph(p);
    currentQuestion.rawOptionsData.push(...parsed);
  } else if (currentQuestion) {
    const parsed = parseOptionsFromParagraph(p);
    if (parsed.length > 0) {
      currentQuestion.rawOptionsData.push(...parsed);
    } else {
      currentQuestion.question += ' ' + p.text;
    }
  }
});

if (currentQuestion) {
  rawQuestions.push(currentQuestion);
}

// Post-process to determine correct answers using scoring
const finalQuestions = rawQuestions.map(q => {
  // Let's filter out empty options and duplicate option keys
  const seenKeys = new Set();
  const uniqueOptions = [];
  
  q.rawOptionsData.forEach(o => {
    if (!seenKeys.has(o.key)) {
      seenKeys.add(o.key);
      uniqueOptions.push(o);
    }
  });
  
  // Calculate score for each option
  // Score is boldChars + redChars*2.
  // Also, if option starts with bold, add a bonus.
  const scoredOptions = uniqueOptions.map(o => {
    let score = o.boldChars + o.redChars * 2;
    if (o.startsWithBold) {
      score += 10; // Bonus for bold prefix or starting with bold
    }
    return {
      key: o.key,
      text: o.text,
      score: score,
      boldChars: o.boldChars,
      redChars: o.redChars,
      startsWithBold: o.startsWithBold
    };
  });
  
  // Identify the correct option(s)
  // An option is correct if its score is > 0 and:
  // - either it's the maximum score
  // - or it's within a close threshold of the maximum score if multiple are styled
  const maxScore = Math.max(...scoredOptions.map(o => o.score), 0);
  const correctOptions = [];
  
  if (maxScore > 0) {
    scoredOptions.forEach(o => {
      // If the score is the max score, or very close (e.g. if the user bolded multiple options)
      if (o.score === maxScore && o.score > 2) {
        correctOptions.push(o.key);
      }
    });
  }
  
  // If still no answer, let's see if there is any option containing explanation in parentheses or quotes
  // which might indicate correctness if the score is low
  if (correctOptions.length === 0 && scoredOptions.length > 0) {
    // Check if any option has text containing parenthesis with more than 3 words (explanation)
    const explanationRegex = /\([a-zA-Z]{2,}\s+[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/;
    const expOption = scoredOptions.find(o => explanationRegex.test(o.text) || o.text.includes('đúng nhất') || o.text.includes('Đúng nhất'));
    if (expOption) {
      correctOptions.push(expOption.key);
    }
  }
  
  // Manual override for q_763
  if (q.id === 'q_763' && correctOptions.length === 0) {
    correctOptions.push('b');
  }
  
  return {
    id: q.id,
    chapter: q.chapter,
    question: q.question,
    options: scoredOptions.map(o => `${o.key.toUpperCase()}. ${o.text}`),
    correctAnswers: correctOptions.map(k => k.toUpperCase())
  };
});

console.log(`Scored ${finalQuestions.length} questions.`);
const noAnswer = finalQuestions.filter(q => q.correctAnswers.length === 0);
const multiAnswer = finalQuestions.filter(q => q.correctAnswers.length > 1);

console.log(`Refined Summary:
- Total questions: ${finalQuestions.length}
- No correct answer: ${noAnswer.length}
- Multiple correct answers: ${multiAnswer.length}
`);

if (noAnswer.length > 0) {
  console.log('\nQuestions still without answer (first 15):');
  noAnswer.slice(0, 15).forEach(q => {
    console.log(`[${q.chapter}] Q: ${q.question.substring(0, 100)}...`);
    console.log(`  Options: ${JSON.stringify(q.options)}`);
  });
}

fs.writeFileSync('final_questions.json', JSON.stringify(finalQuestions, null, 2), 'utf8');
