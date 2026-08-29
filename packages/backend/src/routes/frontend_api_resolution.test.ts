import fs from 'fs';
import path from 'path';

describe('Frontend Production API URL Resolution Test Suite', () => {
  const frontendDistDir = path.resolve(process.cwd(), '../frontend/dist');

  it('1. Production frontend dist folder exists after build', () => {
    expect(fs.existsSync(frontendDistDir)).toBe(true);
  });

  it('2. Production frontend dist bundle contains zero localhost:3000 references', () => {
    if (!fs.existsSync(frontendDistDir)) {
      return;
    }

    const files = fs.readdirSync(frontendDistDir, { recursive: true });
    let totalLocalhost3000Matches = 0;

    for (const file of files) {
      const filePath = path.join(frontendDistDir, file.toString());
      if (fs.statSync(filePath).isFile() && (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css'))) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('localhost:3000')) {
          totalLocalhost3000Matches++;
        }
      }
    }

    expect(totalLocalhost3000Matches).toBe(0);
  });

  it('3. Production frontend dist bundle contains zero localhost:7070 references', () => {
    if (!fs.existsSync(frontendDistDir)) {
      return;
    }

    const files = fs.readdirSync(frontendDistDir, { recursive: true });
    let totalLocalhost7070Matches = 0;

    for (const file of files) {
      const filePath = path.join(frontendDistDir, file.toString());
      if (fs.statSync(filePath).isFile() && (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css'))) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.includes('localhost:7070')) {
          totalLocalhost7070Matches++;
        }
      }
    }

    expect(totalLocalhost7070Matches).toBe(0);
  });
});
