import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService, AlertSeverity } from '../../src/modules/alerts/alerts.service';
import { PagerDutyClient } from '../../src/modules/alerts/clients/pagerduty.client';
import { SlackClient } from '../../src/modules/alerts/clients/slack.client';
import { EmailClient } from '../../src/modules/alerts/clients/email.client';
import { ConfigService } from '@nestjs/config';

/**
 * OBS-02: Alerting Tests
 * 
 * Tests cover:
 * 1. Critical alert triggers PagerDuty
 * 2. Warning alert sends Slack message
 * 3. Info alert queues email
 * 4. Alert deduplication
 * 5. Rate limiting
 * 6. Retry with backoff on failure
 * 7. No sensitive data in payloads
 */
describe('OBS-02 Alerting', () => {
    let service: AlertsService;
    let pagerDutyClient: PagerDutyClient;
    let slackClient: SlackClient;
    let emailClient: EmailClient;

    const orgId = 'org-123';

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AlertsService,
                {
                    provide: PagerDutyClient,
                    useValue: {
                        sendAlert: jest.fn().mockResolvedValue({ success: true }),
                    },
                },
                {
                    provide: SlackClient,
                    useValue: {
                        sendMessage: jest.fn().mockResolvedValue({ success: true }),
                    },
                },
                {
                    provide: EmailClient,
                    useValue: {
                        queueEmail: jest.fn().mockResolvedValue({ success: true }),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'alerts.deduplicationWindowMs') return 300000; // 5 min
                            if (key === 'alerts.rateLimitPerHour') return 100;
                            return undefined;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<AlertsService>(AlertsService);
        pagerDutyClient = module.get<PagerDutyClient>(PagerDutyClient);
        slackClient = module.get<SlackClient>(SlackClient);
        emailClient = module.get<EmailClient>(EmailClient);
        jest.clearAllMocks();
    });

    describe('Severity Routing', () => {
        it('should trigger PagerDuty for CRITICAL alerts', async () => {
            await service.sendAlert({
                severity: AlertSeverity.CRITICAL,
                title: 'Database connection failure',
                message: 'Unable to connect to primary database',
                organizationId: orgId,
                correlationId: 'corr-123',
            });

            expect(pagerDutyClient.sendAlert).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: 'critical',
                    title: 'Database connection failure',
                }),
            );
        });

        it('should send Slack message for WARNING alerts', async () => {
            await service.sendAlert({
                severity: AlertSeverity.WARNING,
                title: 'Queue depth increasing',
                message: 'Orders queue depth at 500',
                organizationId: orgId,
                correlationId: 'corr-456',
            });

            expect(slackClient.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Queue depth increasing',
                }),
            );
        });

        it('should queue email for INFO alerts', async () => {
            await service.sendAlert({
                severity: AlertSeverity.INFO,
                title: 'Weekly summary',
                message: 'Orders processed: 1000',
                organizationId: orgId,
                correlationId: 'corr-789',
            });

            expect(emailClient.queueEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Weekly summary',
                }),
            );
        });
    });

    describe('Alert Content', () => {
        it('should include required fields in alert payload', async () => {
            await service.sendAlert({
                severity: AlertSeverity.CRITICAL,
                title: 'Test alert',
                message: 'Test message',
                organizationId: orgId,
                correlationId: 'corr-test',
            });

            expect(pagerDutyClient.sendAlert).toHaveBeenCalledWith(
                expect.objectContaining({
                    severity: 'critical',
                    title: 'Test alert',
                    message: 'Test message',
                    organizationId: orgId,
                    correlationId: 'corr-test',
                    timestamp: expect.any(String),
                }),
            );
        });
    });

    describe('Deduplication', () => {
        it('should deduplicate same alert within 5 minute window', async () => {
            const alertPayload = {
                severity: AlertSeverity.CRITICAL,
                title: 'Duplicate alert',
                message: 'Same error occurred',
                organizationId: orgId,
                correlationId: 'corr-dup',
            };

            await service.sendAlert(alertPayload);
            await service.sendAlert(alertPayload);
            await service.sendAlert(alertPayload);

            expect(pagerDutyClient.sendAlert).toHaveBeenCalledTimes(1);
        });

        it('should allow different alerts within deduplication window', async () => {
            await service.sendAlert({
                severity: AlertSeverity.CRITICAL,
                title: 'Alert 1',
                message: 'Error 1',
                organizationId: orgId,
            });

            await service.sendAlert({
                severity: AlertSeverity.CRITICAL,
                title: 'Alert 2',
                message: 'Error 2',
                organizationId: orgId,
            });

            expect(pagerDutyClient.sendAlert).toHaveBeenCalledTimes(2);
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limit of 100 alerts per hour per org', async () => {
            // Simulate hitting rate limit
            for (let i = 0; i < 101; i++) {
                try {
                    await service.sendAlert({
                        severity: AlertSeverity.WARNING,
                        title: `Alert ${i}`,
                        message: `Message ${i}`,
                        organizationId: orgId,
                    });
                } catch (e) {
                    // Expected after 100
                }
            }

            // First 100 should succeed, 101st should be rate limited
            expect(slackClient.sendMessage).toHaveBeenCalledTimes(100);
        });
    });

    describe('Failure Handling', () => {
        it('should retry PagerDuty on failure with backoff', async () => {
            (pagerDutyClient.sendAlert as jest.Mock)
                .mockRejectedValueOnce(new Error('API timeout'))
                .mockResolvedValueOnce({ success: true });

            await service.sendAlert({
                severity: AlertSeverity.CRITICAL,
                title: 'Retry test',
                message: 'Test retry',
                organizationId: orgId,
            });

            expect(pagerDutyClient.sendAlert).toHaveBeenCalledTimes(2);
        });

        it('should fallback to email when Slack fails', async () => {
            (slackClient.sendMessage as jest.Mock).mockRejectedValue(new Error('Webhook failed'));

            await service.sendAlert({
                severity: AlertSeverity.WARNING,
                title: 'Fallback test',
                message: 'Test fallback',
                organizationId: orgId,
            });

            expect(emailClient.queueEmail).toHaveBeenCalled();
        });
    });

    describe('Security', () => {
        it('should NOT include sensitive data in alert payloads', async () => {
            await service.sendAlert({
                severity: AlertSeverity.CRITICAL,
                title: 'Security test',
                message: 'Error with password=secret123',
                organizationId: orgId,
                metadata: { apiKey: 'sk-12345' },
            });

            const callArgs = (pagerDutyClient.sendAlert as jest.Mock).mock.calls[0][0];

            expect(callArgs.message).not.toContain('secret123');
            expect(callArgs.metadata).not.toHaveProperty('apiKey');
        });

        it('should mask sensitive patterns in messages', async () => {
            await service.sendAlert({
                severity: AlertSeverity.WARNING,
                title: 'Masked test',
                message: 'Failed with token=abc123xyz and key=sk-secret',
                organizationId: orgId,
            });

            const callArgs = (slackClient.sendMessage as jest.Mock).mock.calls[0][0];

            expect(callArgs.message).toContain('[REDACTED]');
        });
    });
});
