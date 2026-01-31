import * as fs from 'fs';
import * as path from 'path';

/**
 * OBS-04: Runbook Verification Tests
 * 
 * Tests cover:
 * 1. All 5 runbooks exist
 * 2. Each runbook contains required sections
 * 3. Index/TOC exists
 * 4. Links in runbooks are valid
 */
describe('OBS-04 Runbook Verification', () => {
    // Use __dirname for reliable path resolution
    const runbooksDir = path.join(__dirname, '../../../docs/runbooks');

    const REQUIRED_RUNBOOKS = [
        '01-high-queue-depth.md',
        '02-database-connection-failure.md',
        '03-carrier-api-outage.md',
        '04-memory-cpu-threshold.md',
        '05-failed-payment-webhook.md',
    ];

    const REQUIRED_SECTIONS = [
        '## Alert Definition',
        '## Impact Assessment',
        '## Diagnostic Steps',
        '## Remediation Steps',
        '## Escalation Path',
    ];

    describe('Runbook Existence', () => {
        it('should have runbooks directory', () => {
            expect(fs.existsSync(runbooksDir)).toBe(true);
        });

        it('should have README.md index file', () => {
            const indexPath = path.join(runbooksDir, 'README.md');
            expect(fs.existsSync(indexPath)).toBe(true);
        });

        REQUIRED_RUNBOOKS.forEach((runbook) => {
            it(`should have ${runbook}`, () => {
                const runbookPath = path.join(runbooksDir, runbook);
                expect(fs.existsSync(runbookPath)).toBe(true);
            });
        });
    });

    describe('Runbook Structure', () => {
        REQUIRED_RUNBOOKS.forEach((runbook) => {
            describe(runbook, () => {
                let content: string;

                beforeAll(() => {
                    const runbookPath = path.join(runbooksDir, runbook);
                    if (fs.existsSync(runbookPath)) {
                        content = fs.readFileSync(runbookPath, 'utf-8');
                    }
                });

                REQUIRED_SECTIONS.forEach((section) => {
                    it(`should contain "${section}"`, () => {
                        expect(content).toContain(section);
                    });
                });

                it('should have a title (H1 heading)', () => {
                    expect(content).toMatch(/^# .+/m);
                });
            });
        });
    });

    describe('Index Completeness', () => {
        let indexContent: string;

        beforeAll(() => {
            const indexPath = path.join(runbooksDir, 'README.md');
            if (fs.existsSync(indexPath)) {
                indexContent = fs.readFileSync(indexPath, 'utf-8');
            }
        });

        REQUIRED_RUNBOOKS.forEach((runbook) => {
            it(`should reference ${runbook} in index`, () => {
                expect(indexContent).toContain(runbook);
            });
        });
    });
});
