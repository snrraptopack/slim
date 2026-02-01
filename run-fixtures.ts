/**
 * AUWGENT YAML-Lite — Fixture Test Runner
 * 
 * Reads all YAML files from fixtures/ and outputs their JSON conversion.
 * Tests both complete and partial/incomplete files.
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { parseToJSON, parse, createStreamingParser } from './src/index';

const FIXTURES_DIR = './fixtures';
const OUTPUT_DIR = './output';

interface TestResult {
    file: string;
    success: boolean;
    isPartial: boolean;
    inputLines: number;
    json: unknown;
    errors: string[];
    parseTime: number;
}

async function ensureOutputDir(): Promise<void> {
    try {
        await mkdir(OUTPUT_DIR, { recursive: true });
    } catch {
        // Directory exists
    }
}

async function processFixture(filePath: string): Promise<TestResult> {
    const fileName = basename(filePath);
    const content = await readFile(filePath, 'utf-8');
    const isPartial = fileName.includes('partial');
    const inputLines = content.split('\n').length;

    const startTime = performance.now();

    try {
        // Use regular parser for complete files, streaming for partial
        let json: unknown;
        let errors: string[] = [];

        if (isPartial) {
            // Use streaming parser to handle partial content
            const stream = createStreamingParser();
            stream.write(content);
            json = stream.peek(); // Get partial result without closing
            // Also try to end it to see errors
            try {
                json = stream.end();
            } catch {
                // Partial files may fail on end()
            }
        } else {
            const result = parse(content);
            errors = result.errors.map(e => e.message);
            json = parseToJSON(content);
        }

        const parseTime = performance.now() - startTime;

        return {
            file: fileName,
            success: true,
            isPartial,
            inputLines,
            json,
            errors,
            parseTime,
        };
    } catch (error) {
        const parseTime = performance.now() - startTime;
        return {
            file: fileName,
            success: false,
            isPartial,
            inputLines,
            json: null,
            errors: [error instanceof Error ? error.message : String(error)],
            parseTime,
        };
    }
}

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  AUWGENT YAML-Lite — Fixture Test Runner');
    console.log('═══════════════════════════════════════════════════════════════\n');

    await ensureOutputDir();

    // Get all YAML files
    const files = await readdir(FIXTURES_DIR);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).sort();

    console.log(`Found ${yamlFiles.length} fixture files\n`);

    const results: TestResult[] = [];

    for (const file of yamlFiles) {
        const filePath = join(FIXTURES_DIR, file);
        console.log(`Processing: ${file}`);

        const result = await processFixture(filePath);
        results.push(result);

        // Save JSON output
        const outputPath = join(OUTPUT_DIR, file.replace(/\.ya?ml$/, '.json'));
        await writeFile(outputPath, JSON.stringify(result.json, null, 2), 'utf-8');

        // Display summary
        const status = result.success ? '✓' : '✗';
        const partial = result.isPartial ? ' (PARTIAL)' : '';
        const time = result.parseTime.toFixed(2);
        console.log(`  ${status} ${result.inputLines} lines → JSON${partial} [${time}ms]`);

        if (result.errors.length > 0) {
            console.log(`    Errors: ${result.errors.join(', ')}`);
        }
        console.log();
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const partial = results.filter(r => r.isPartial).length;
    const totalTime = results.reduce((sum, r) => sum + r.parseTime, 0);

    console.log(`  Total files:    ${results.length}`);
    console.log(`  Successful:     ${successful}`);
    console.log(`  Failed:         ${failed}`);
    console.log(`  Partial files:  ${partial}`);
    console.log(`  Total time:     ${totalTime.toFixed(2)}ms`);
    console.log(`\n  Output saved to: ${OUTPUT_DIR}/`);
    console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
