#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const HISTORY_FILE = path.join(os.homedir(), '.book.json');

function formatTimestamp(epochMs) {
  const date = new Date(Number(epochMs));

  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';

  hours = hours % 12;
  hours = hours ? hours : 12;
  const hh = String(hours).padStart(2, '0');

  return `${yy}-${mm}-${dd} ${hh}:${minutes} ${ampm}`;
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    return {};
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
}

function printHistory(entriesObj) {
  const entries = Object.entries(entriesObj);

  if (entries.length === 0) {
    console.log('No entries found.');
    return;
  }

  entries
    .sort(([a], [b]) => Number(b) - Number(a))
    .forEach(([epochMs, text]) => {
      console.log(`[${formatTimestamp(epochMs)}] ${text}`);
    })
	;
}

function exportHistory(targetPath, history) {
  const resolvedPath = path.resolve(targetPath || 'book-export.json');
  const count = Object.keys(history).length;
  fs.writeFileSync(resolvedPath, JSON.stringify(history, null, 2), 'utf8');
  console.log(`Exported ${count} entries to ${resolvedPath}`);
}

function importHistory(sourcePath, currentHistory, overwrite = false) {
  if (!sourcePath) {
    console.error('Please provide a file path. Example: log --import backup.json');
    process.exit(1);
  }

  const resolvedPath = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(resolvedPath, 'utf8');
    const importedData = JSON.parse(rawData);

    const isValidObject =
      importedData &&
      typeof importedData === 'object' &&
      !Array.isArray(importedData) &&
      Object.entries(importedData).every(
        ([key, val]) => !Number.isNaN(Number(key)) && typeof val === 'string'
      );

    if (!isValidObject) {
      console.error('Invalid JSON format. Expected an object mapping Date.now() keys to text strings.');
      process.exit(1);
    }

    const importedEntries = Object.entries(importedData);

    if (overwrite) {
      saveHistory(importedData);
      console.log(`Overwrote history with ${importedEntries.length} entries from ${resolvedPath}`);
      return;
    }

    let addedCount = 0;
    importedEntries.forEach(([epochMs, text]) => {
      if (!Object.prototype.hasOwnProperty.call(currentHistory, epochMs)) {
        currentHistory[epochMs] = text;
        addedCount++;
      }
    });

    saveHistory(currentHistory);
    console.log(`Imported ${addedCount} new entries (${importedEntries.length - addedCount} duplicates skipped).`);
  } catch (err) {
    console.error(`Failed to import JSON: ${err.message}`);
    process.exit(1);
  }
}

function run() {
  const args = process.argv.slice(2);
  let history = loadHistory();


  const exportIndex = args.findIndex((arg) => arg === '--export' || arg === '-e');
  if (exportIndex !== -1) {
    const filePath = args[exportIndex + 1];
    exportHistory(filePath, history);
    return;
  }

  const importIndex = args.findIndex((arg) => arg === '--import' || arg === '-i');
  if (importIndex !== -1) {
    const filePath = args[importIndex + 1];
    const overwrite = args.includes('--overwrite');
    importHistory(filePath, history, overwrite);
    return;
  }

  const searchIndex = args.findIndex((arg) => arg === '--search' || arg === '-s');
  if (searchIndex !== -1) {
    const query = args.slice(searchIndex + 1).join(' ').toLowerCase();
    if (!query) {
      console.error('Please provide a search term. Example: log --search groceries');
      process.exit(1);
    }

    const filteredEntries = Object.entries(history).filter(([epochMs, text]) => {
      const humanDate = formatTimestamp(epochMs).toLowerCase();
      return text.toLowerCase().includes(query) || humanDate.includes(query);
    });



printHistory(Object.fromEntries(filteredEntries));
    return;
  }

  if (args.length === 0) {
    printHistory(history);
    return;
  }

  const text = args.join(' ');
  let timestampInt = Date.now();

  while (Object.prototype.hasOwnProperty.call(history, String(timestampInt))) {
    timestampInt += 1;
  }

  history[timestampInt] = text;
  saveHistory(history);
  console.log(`Saved: [${formatTimestamp(timestampInt)}] ${text}`);
}

run();
