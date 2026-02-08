// Generate a large YAML benchmark file
import { writeFileSync } from 'fs';

const lines: string[] = ['users:'];

for (let i = 0; i < 5000; i++) {
    lines.push(`  - id: ${i}`);
    lines.push(`    name: "User ${i}"`);
    lines.push(`    email: "user${i}@example.com"`);
    lines.push(`    active: ${i % 2 === 0}`);
    lines.push(`    score: ${(Math.random() * 100).toFixed(2)}`);
    lines.push(`    tags:`);
    lines.push(`      - tag_${i}_a`);
    lines.push(`      - tag_${i}_b`);
    lines.push(`      - tag_${i}_c`);
    lines.push(`    metadata:`);
    lines.push(`      created: "2024-01-${(i % 28) + 1}"`);
    lines.push(`      region: "${['us-east', 'us-west', 'eu-central', 'ap-south'][i % 4]}"`);
    lines.push(`      tier: "${['free', 'pro', 'enterprise'][i % 3]}"`);
}

lines.push(`total: 5000`);
lines.push(`generated: true`);
lines.push(`version: "1.0.0"`);

const content = lines.join('\n');
writeFileSync('fixtures/large-benchmark.yaml', content);

const sizeMB = (Buffer.byteLength(content) / 1024 / 1024).toFixed(2);
console.log(`Created fixtures/large-benchmark.yaml: ${sizeMB} MB`);
