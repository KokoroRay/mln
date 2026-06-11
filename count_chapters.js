const fs = require('fs');

const questions = JSON.parse(fs.readFileSync('final_questions.json', 'utf8'));

const counts = {};
questions.forEach(q => {
  counts[q.chapter] = (counts[q.chapter] || 0) + 1;
});

console.log('Question counts by chapter:', counts);
console.log('Total questions:', questions.length);

// Let's verify the no-answer question override
const noAnswerIndex = questions.findIndex(q => q.correctAnswers.length === 0);
if (noAnswerIndex !== -1) {
  console.log('No answer question:', questions[noAnswerIndex]);
}
