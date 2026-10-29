import type { HttpClient, HttpClientResponse } from '@actions/http-client';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { getOAuthToken, getOAuthTokenUrl, validateInstanceName } from './auth';

describe('validateInstanceName', () => {
  it('returns default host workspaces.dts.utah.gov when undefined or empty', () => {
    expect(validateInstanceName()).toBe('workspaces.dts.utah.gov');
    expect(validateInstanceName('')).toBe('workspaces.dts.utah.gov');
  });

  it('validates and accepts DTS hosts', () => {
    expect(validateInstanceName('dev.workspaces.dts.utah.gov')).toBe('dev.workspaces.dts.utah.gov');
    expect(validateInstanceName('https://dev.workspaces.dts.utah.gov/')).toBe('dev.workspaces.dts.utah.gov');
    expect(validateInstanceName('test.workspaces.dts.utah.gov')).toBe('test.workspaces.dts.utah.gov');
    expect(validateInstanceName('https://test.workspaces.dts.utah.gov')).toBe('test.workspaces.dts.utah.gov');
    expect(validateInstanceName('workspaces.dts.utah.gov')).toBe('workspaces.dts.utah.gov');
    expect(validateInstanceName('https://workspaces.dts.utah.gov')).toBe('workspaces.dts.utah.gov');
  });

  it('preserves full domain if explicit servicenowservices.com, service-now.com, or dts.utah.gov host is passed', () => {
    expect(validateInstanceName('https://utah.servicenowservices.com/')).toBe('utah.servicenowservices.com');
    expect(validateInstanceName('utah.service-now.com')).toBe('utah.service-now.com');
    expect(validateInstanceName('http://utah.service-now.com')).toBe('utah.service-now.com');
    expect(validateInstanceName('https://utah.service-now.com/some/path')).toBe('utah.service-now.com');
    expect(validateInstanceName('https://custom.dts.utah.gov/')).toBe('custom.dts.utah.gov');
  });

  it('throws an error for attacker domains and invalid hosts', () => {
    expect(() => validateInstanceName('utah.service-now.com.attacker.example')).toThrowError(
      'Invalid ServiceNow host: "utah.service-now.com.attacker.example". Host must belong to dts.utah.gov, service-now.com, or servicenowservices.com.',
    );
    expect(() => validateInstanceName('attacker.com')).toThrowError(
      'Invalid ServiceNow host: "attacker.com". Host must belong to dts.utah.gov, service-now.com, or servicenowservices.com.',
    );
    expect(() => validateInstanceName('service-now.com')).toThrowError(
      'Invalid ServiceNow host: "service-now.com". Host must belong to dts.utah.gov, service-now.com, or servicenowservices.com.',
    );
    expect(() => validateInstanceName('custom')).toThrowError(
      'Invalid ServiceNow host: "custom". Host must belong to dts.utah.gov, service-now.com, or servicenowservices.com.',
    );
    expect(() => validateInstanceName('http://[::invalid]')).toThrowError(
      'Invalid ServiceNow host: "http://[::invalid]"',
    );
  });
});

describe('getOAuthTokenUrl', () => {
  it('generates the token URL for default and DTS hosts', () => {
    expect(getOAuthTokenUrl()).toBe('https://workspaces.dts.utah.gov/oauth_token.do');
    expect(getOAuthTokenUrl('workspaces.dts.utah.gov')).toBe('https://workspaces.dts.utah.gov/oauth_token.do');
    expect(getOAuthTokenUrl('dev.workspaces.dts.utah.gov')).toBe('https://dev.workspaces.dts.utah.gov/oauth_token.do');
    expect(getOAuthTokenUrl('test.workspaces.dts.utah.gov')).toBe(
      'https://test.workspaces.dts.utah.gov/oauth_token.do',
    );
  });

  it('generates the token URL for explicit service-now.com and servicenowservices.com hosts', () => {
    expect(getOAuthTokenUrl('utah.service-now.com')).toBe('https://utah.service-now.com/oauth_token.do');
    expect(getOAuthTokenUrl('https://utah.servicenowservices.com/')).toBe(
      'https://utah.servicenowservices.com/oauth_token.do',
    );
  });
});

describe('getOAuthToken', () => {
  it('successfully retrieves and returns the access token for default host', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      message: { statusCode: 200 } as IncomingMessage,
      readBody: vi.fn().mockResolvedValue(
        JSON.stringify({
          access_token: 'test-token-123',
          token_type: 'Bearer',
          expires_in: 1800,
        }),
      ),
    } as unknown as HttpClientResponse);

    const mockHttpClient = {
      post: mockPost,
    } as unknown as HttpClient;

    const token = await getOAuthToken(
      mockHttpClient,
      'my-client-id',
      'my-client-secret',
      'dev.workspaces.dts.utah.gov',
    );

    expect(token).toBe('test-token-123');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      'https://dev.workspaces.dts.utah.gov/oauth_token.do',
      'grant_type=client_credentials&client_id=my-client-id&client_secret=my-client-secret',
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    );
  });

  it('successfully retrieves and returns the access token for custom service-now host', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      message: { statusCode: 200 } as IncomingMessage,
      readBody: vi.fn().mockResolvedValue(
        JSON.stringify({
          access_token: 'custom-token-456',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      ),
    } as unknown as HttpClientResponse);

    const mockHttpClient = {
      post: mockPost,
    } as unknown as HttpClient;

    const token = await getOAuthToken(mockHttpClient, 'my-client-id', 'my-client-secret', 'utah.service-now.com');

    expect(token).toBe('custom-token-456');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      'https://utah.service-now.com/oauth_token.do',
      'grant_type=client_credentials&client_id=my-client-id&client_secret=my-client-secret',
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    );
  });

  it('throws an error when ServiceNow returns a non-200 status code', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      message: { statusCode: 401 } as IncomingMessage,
      readBody: vi.fn().mockResolvedValue(
        JSON.stringify({
          error: 'invalid_client',
          error_description: 'OAuth client authentication failed',
        }),
      ),
    } as unknown as HttpClientResponse);

    const mockHttpClient = {
      post: mockPost,
    } as unknown as HttpClient;

    await expect(
      getOAuthToken(mockHttpClient, 'my-client-id', 'invalid-secret', 'workspaces.dts.utah.gov'),
    ).rejects.toThrowError(
      'Failed to obtain OAuth token from ServiceNow at https://workspaces.dts.utah.gov/oauth_token.do (status 401): {"error":"invalid_client","error_description":"OAuth client authentication failed"}',
    );
  });

  it('throws an error when ServiceNow response is not valid JSON', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      message: { statusCode: 200 } as IncomingMessage,
      readBody: vi.fn().mockResolvedValue('<html>502 Bad Gateway</html>'),
    } as unknown as HttpClientResponse);

    const mockHttpClient = {
      post: mockPost,
    } as unknown as HttpClient;

    await expect(
      getOAuthToken(mockHttpClient, 'my-client-id', 'my-secret', 'workspaces.dts.utah.gov'),
    ).rejects.toThrowError(
      'Failed to parse OAuth token response from https://workspaces.dts.utah.gov/oauth_token.do: <html>502 Bad Gateway</html>',
    );
  });

  it('throws an error when ServiceNow response does not contain access_token', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      message: { statusCode: 200 } as IncomingMessage,
      readBody: vi.fn().mockResolvedValue(JSON.stringify({ scope: 'read' })),
    } as unknown as HttpClientResponse);

    const mockHttpClient = {
      post: mockPost,
    } as unknown as HttpClient;

    await expect(
      getOAuthToken(mockHttpClient, 'my-client-id', 'my-secret', 'workspaces.dts.utah.gov'),
    ).rejects.toThrowError(
      'OAuth token response from https://workspaces.dts.utah.gov/oauth_token.do did not contain an access_token',
    );
  });
});
