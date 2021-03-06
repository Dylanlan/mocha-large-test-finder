'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const isTestFile = (fileName) => {
    return fileName && fileName.toLowerCase().endsWith('test.js') || fileName.toLowerCase().endsWith('spec.js');
};

const isDirectory = (path) => {
    return fs.existsSync(path) && fs.lstatSync(path).isDirectory();
};

const getTestFiles = (directory) => {
    const files = fs.readdirSync(directory);
    let testFiles = files.filter(f => isTestFile(f)).map(f => path.join(directory, f));
    const directories = files.filter(f => isDirectory(f) && !f.startsWith('.'));
    directories.forEach(dir => {
        const subFiles = getTestFiles(dir);
        testFiles = testFiles.concat(subFiles);
    });

    return testFiles;
};

const isTestLine = (line) => {
    const regex = /^\s*it\(/;
    return regex.test(line);
};

const isTestBlock = (line) => {
    const regex = /^\s*(it|describe|beforeEach|afterEach)\(/;
    return regex.test(line);
};

const findLargeTests = (testFile, lengths) => {
    const testText = fs.readFileSync(testFile).toString();
    if (!testText) {
        return;
    }

    const lines = testText.split('\n');
    if (!lines || !lines.length) {
        return;
    }

    const numLines = lines.length;
    let testLength = 0;
    let currentTest = '';
    let fileLine;
    for (let i = 0; i < numLines; i++) {
        const line = lines[i];
        const lineNumber = i + 1;
        fileLine = `${testFile}:${lineNumber} - ${line.trim()}`.trim();
        const isTest = isTestLine(line);
        const isBlock = isTestBlock(line);

        if (!isBlock) {
            if (currentTest) {
                // if found regular code, and we're in a test, increment line count
                testLength++;
            }
        } else {
            if (currentTest) {
                // if we found a block and we're in a test, let's end the line count
                lengths[currentTest] = testLength;
                testLength = 0;
                currentTest = '';
            }
            
            if (isTest) {
                // found a new test block
                currentTest = fileLine;
            }
        }
    }

    if (currentTest) {
        // if we reached end of file, end line count for any ongoing test
        lengths[currentTest] = testLength;
        testLength = 0;
        currentTest = '';
    }
};

const validateInputs = (dir, lines, numTests) => {
    if (!isDirectory(dir)) {
        console.error(`${dir} is not a directory`);
        process.exit(1);
    }

    if (lines < 0) {
        console.error(`Number of lines (${lines}) cannot be negative`);
        process.exit(1);
    }

    if (numTests < 0) {
        console.error(`Number of tests (${numTests}) cannot be negative`);
        process.exit(1);
    }
}

exports.getLargeTests = (dir, lines, numTests) => {
    validateInputs(dir, lines, numTests);

    const allTestFiles = getTestFiles(dir);

    const lengths = {};
    allTestFiles.forEach(file => {
        findLargeTests(file, lengths);
    });
    
    const testsWithManyLines = _.toPairs(lengths).filter(pair => pair[1] >= lines);
    const topLargeTests = testsWithManyLines.slice(0, numTests);
    const sorted = _.sortBy(topLargeTests, 1).reverse();

    return {
        largeTests: sorted,
        numTotalTests: testsWithManyLines.length
    };
};
