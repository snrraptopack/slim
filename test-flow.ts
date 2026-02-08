import { parseToJSON } from './src/index';
import { readFileSync } from 'fs';

// Load large YAML fixture
const yaml = readFileSync('./fixtures/large-benchmark.yaml', 'utf-8');
const sizeMB = (Buffer.byteLength(yaml) / 1024 / 1024).toFixed(2);

console.log(`\nLoaded YAML: ${sizeMB} MB, ${yaml.split('\n').length} lines\n`);

// Benchmark
const start = performance.now();
const result = parseToJSON<{ users: unknown[]; total: number }>(yaml);
const elapsed = performance.now() - start;

console.log(`Parse time: ${elapsed.toFixed(2)} ms`);
console.log(`Throughput: ${(parseFloat(sizeMB) / (elapsed / 1000)).toFixed(2)} MB/s`);
console.log(`Users parsed: ${result.users?.length}`);
