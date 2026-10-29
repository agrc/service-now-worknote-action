import { HttpClient } from '@actions/http-client';

export interface OAuthTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

const ALLOWED_DOMAINS = ['dts.utah.gov', 'service-now.com', 'servicenowservices.com'] as const;

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_DOMAINS.some((domain) => hostname.endsWith(`.${domain}`));
}

function getHostname(input: string): string {
  try {
    return new URL(input.includes('://') ? input : `https://${input}`).hostname.toLowerCase();
  } catch {
    throw new Error(`Invalid ServiceNow host: "${input}"`);
  }
}

export function validateInstanceName(instanceName?: string): string {
  const target = instanceName?.trim() || 'workspaces.dts.utah.gov';
  const hostname = getHostname(target);

  if (!isAllowedHost(hostname)) {
    throw new Error(
      `Invalid ServiceNow host: "${hostname}". Host must belong to dts.utah.gov, service-now.com, or servicenowservices.com.`,
    );
  }

  return hostname;
}

export function getOAuthTokenUrl(instanceName?: string): string {
  const host = validateInstanceName(instanceName);

  return `https://${host}/oauth_token.do`;
}

export async function getOAuthToken(
  httpClient: HttpClient,
  clientId: string,
  clientSecret: string,
  instanceName?: string,
): Promise<string> {
  const tokenUrl = getOAuthTokenUrl(instanceName);

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await httpClient.post(tokenUrl, params.toString(), {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  const responseBody = await response.readBody();

  if (response.message.statusCode !== 200) {
    throw new Error(
      `Failed to obtain OAuth token from ServiceNow at ${tokenUrl} (status ${response.message.statusCode}): ${responseBody}`,
    );
  }

  let tokenData: OAuthTokenResponse | null;
  try {
    tokenData = JSON.parse(responseBody) as OAuthTokenResponse | null;
  } catch {
    throw new Error(`Failed to parse OAuth token response from ${tokenUrl}: ${responseBody}`);
  }

  if (!tokenData || typeof tokenData.access_token !== 'string' || !tokenData.access_token.trim()) {
    throw new Error(`OAuth token response from ${tokenUrl} did not contain an access_token: ${responseBody}`);
  }

  return tokenData.access_token;
}
