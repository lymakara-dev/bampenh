const fs = require('fs');
const path = require('path');

const formsDir = '/home/makara/Documents/work@misti/public-service-user-web/src/forms';
const outputJson = '/home/makara/Documents/side-projects/bampenh/sample-data.json';

const oldData = JSON.parse(fs.readFileSync(outputJson, 'utf-8'));

function scanDir(dir, regexes, matches = new Set()) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath, regexes, matches);
    } else if (fullPath.endsWith('.vue') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const rx of regexes) {
        let m;
        while ((m = rx.exec(content)) !== null) {
          matches.add(m[1].trim());
        }
      }
    }
  }
  return matches;
}

const vModelRx = /v-model="[^"]*\.([^."]+)"/g;
const vModelSimpleRx = /v-model="([^."]+)"/g;
const labelRx = /label="([^"]+)"/g;
const translateRx = /:label="translate\('[^|]+\|\|\s*([^']+)'\)"/g;

const models = scanDir(formsDir, [vModelRx, vModelSimpleRx]);
const labels = scanDir(formsDir, [labelRx, translateRx]);

const newData = { ...oldData };

const generateDummy = (key) => {
  const kl = key.toLowerCase();
  if (kl.includes('phone') || kl.includes('contact') || kl.includes('ទូរស័ព្ទ')) return '012345678';
  if (kl.includes('email') || kl.includes('ម៉ែល')) return 'test@example.com';
  if (kl.includes('date') || kl.includes('កាលបរិច្ឆេទ')) return '2025-01-01';
  if (kl.includes('id') && !kl.includes('province') && !kl.includes('district') && !kl.includes('commune') && !kl.includes('village')) return '123456789';
  if (kl.includes('province') || kl.includes('ខេត្ត')) return '1'; // Assuming ID is 1
  if (kl.includes('district') || kl.includes('ស្រុក')) return '1';
  if (kl.includes('commune') || kl.includes('ឃុំ')) return '1';
  if (kl.includes('village') || kl.includes('ភូមិ')) return '1';
  if (kl.includes('gender') || kl.includes('ភេទ')) return 'M';
  if (kl.includes('name_en') || kl.includes('ឡាតាំង')) return 'Test Name';
  if (kl.includes('name') || kl.includes('ឈ្មោះ')) return 'ឈ្មោះសាកល្បង';
  if (kl.includes('fax') || kl.includes('ទូរសារ')) return '023456789';
  if (kl.includes('price') || kl.includes('តម្លៃ')) return '1000';
  if (kl.includes('number') || kl.includes('លេខ')) return '123';
  return 'ទិន្នន័យសាកល្បង';
};

for (const m of models) {
  if (!newData[m]) newData[m] = generateDummy(m);
}
for (const l of labels) {
  if (!newData[l]) newData[l] = generateDummy(l);
}

fs.writeFileSync(outputJson, JSON.stringify(newData, null, 2));
console.log('Done updating sample-data.json with', models.size, 'models and', labels.size, 'labels');
