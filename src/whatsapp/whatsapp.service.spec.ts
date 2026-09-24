import { WhatsAppService } from './whatsapp.service';

describe('WhatsApp Cloud API payloads', () => {
  const config = {
    enabled: true,
    graphVersion: 'v26.0',
    accessToken: 'test-token',
    phoneNumberId: '123456',
    businessAccountId: '987654',
    language: 'en_US',
  };
  const service = new WhatsAppService(config as never);
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid.test' }] }),
    } as Response);
  });

  afterEach(() => fetchMock.mockRestore());

  it('sends hello_world without body parameters', async () => {
    await service.sendTemplate('+15551234567', 'hello_world', [], 'en_US');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as {
      to: string;
      template: { name: string; components?: unknown };
    };
    expect(body.to).toBe('15551234567');
    expect(body.template.name).toBe('hello_world');
    expect(body.template.components).toBeUndefined();
  });

  it('sends the quote number without adding a second hash prefix', async () => {
    await service.sendTemplate(
      '+15551234567',
      'quote_received',
      ['John', 'CB-1024'],
      'en',
    );
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as {
      template: {
        language: { code: string };
        components: Array<{ parameters: Array<{ text: string }> }>;
      };
    };
    expect(body.template.language.code).toBe('en');
    expect(
      body.template.components[0].parameters.map((item) => item.text),
    ).toEqual(['John', 'CB-1024']);
  });

  it('looks up approval in the configured Business Account', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [{ name: 'quote_received', language: 'en', status: 'PENDING' }],
        }),
    });
    expect(await service.templateStatus('quote_received', 'en')).toBe(
      'PENDING',
    );
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toContain('/987654/message_templates');
  });
});
