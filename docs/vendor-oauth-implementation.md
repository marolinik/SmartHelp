# Vendor OAuth 2.0 Implementation Documentation

## Overview

The OAuth 2.0 implementation for the PIO Help Desk system provides secure authentication with external vendor ticketing systems. The system supports multiple vendors (JIRA, ServiceNow, Zendesk, Freshdesk) with full Serbian language support for error messages and user interfaces.

## Architecture Components

### 1. OAuth Service (`oauthService.ts`)

The core OAuth service handles all authentication operations:

- **Token Management**: Secure storage and retrieval of access/refresh tokens
- **Token Refresh**: Automatic refresh when tokens expire
- **Error Handling**: Serbian language error messages for all OAuth errors
- **Vendor Configuration**: Pre-configured settings for popular vendors

### 2. OAuth Routes (`oauthRoutes.ts`)

RESTful API endpoints for OAuth operations:

- `POST /api/vendor-integration/oauth/authorize/:connectionId` - Initiate OAuth flow
- `GET /api/vendor-integration/oauth/callback` - Handle OAuth callback
- `POST /api/vendor-integration/oauth/refresh/:connectionId` - Manually refresh token
- `GET /api/vendor-integration/oauth/test/:connectionId` - Test connection
- `DELETE /api/vendor-integration/oauth/revoke/:connectionId` - Revoke OAuth access

### 3. Security Features

#### Token Storage
- All tokens encrypted using AES-256 encryption
- Stored in `VendorConnection.authConfig` field
- Automatic cleanup of expired tokens

#### CSRF Protection
- Random state parameter for each OAuth flow
- State validation on callback
- Automatic cleanup of old states (30 minutes)

#### Error Handling
- Comprehensive error types with Serbian messages
- Graceful fallback for network issues
- Detailed logging for debugging

## Implementation Details

### Supported Vendors

#### JIRA (Atlassian)
```javascript
{
  authorizationUrl: 'https://auth.atlassian.com/authorize',
  tokenUrl: 'https://auth.atlassian.com/oauth/token',
  scope: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
  additionalParams: {
    audience: 'api.atlassian.com',
    prompt: 'consent'
  }
}
```

#### ServiceNow
```javascript
{
  authorizationUrl: `${instanceUrl}/oauth_auth.do`,
  tokenUrl: `${instanceUrl}/oauth_token.do`,
  scope: ['useraccount']
}
```

#### Zendesk
```javascript
{
  authorizationUrl: `${subdomain}.zendesk.com/oauth/authorizations/new`,
  tokenUrl: `${subdomain}.zendesk.com/oauth/tokens`,
  scope: ['read', 'write']
}
```

#### Freshdesk
```javascript
{
  authorizationUrl: `${domain}/oauth/authorize`,
  tokenUrl: `${domain}/oauth/token`,
  scope: ['read', 'write']
}
```

### Serbian Error Messages

All OAuth errors are translated to Serbian:

```javascript
{
  invalid_grant: 'Неважећа дозвола за приступ. Проверите корисничке податке.',
  invalid_client: 'Неважећи клијент. Проверите клијентски ID и тајни кључ.',
  invalid_request: 'Неважећи захтев. Недостају обавезни параметри.',
  unauthorized_client: 'Клијент није овлашћен за овај тип захтева.',
  access_denied: 'Корисник је одбио приступ апликацији.',
  unsupported_response_type: 'Неподржан тип одговора.',
  invalid_scope: 'Захтевани опсег дозвола није важећи.',
  server_error: 'Vendor сервер је пријавио грешку.',
  temporarily_unavailable: 'Vendor сервис је привремено недоступан.',
  network_error: 'Грешка у мрежној комуникацији са vendor системом.',
  token_expired: 'Токен за приступ је истекао.',
  refresh_failed: 'Није могуће освежити токен за приступ.'
}
```

## Usage Guide

### 1. Setting Up a Vendor Connection

```javascript
// Create vendor system
const vendorSystem = await prisma.vendorSystem.create({
  data: {
    name: 'jira',
    displayName: 'Atlassian JIRA',
    vendorType: 'jira',
    supportsBidirectional: true,
    supportsWebhooks: true
  }
});

// Create connection
const connection = await prisma.vendorConnection.create({
  data: {
    vendorSystemId: vendorSystem.id,
    connectionName: 'JIRA Produkcija',
    authType: 'oauth2',
    environment: 'production'
  }
});
```

### 2. Initiating OAuth Flow

```javascript
// Client initiates OAuth
const response = await fetch(`/api/vendor-integration/oauth/authorize/${connectionId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});

const { authUrl } = await response.json();
// Redirect user to authUrl
window.open(authUrl, 'oauth-window', 'width=600,height=700');
```

### 3. Handling OAuth Callback

The callback automatically:
1. Validates the state parameter
2. Exchanges code for tokens
3. Encrypts and stores tokens
4. Updates connection status
5. Returns user-friendly HTML page

### 4. Using Authenticated Connection

```javascript
// Get valid access token (auto-refreshes if needed)
const accessToken = await oauthService.getAccessToken(connectionId, oauthConfig);

// Make API call to vendor
const response = await axios.get(`${vendorUrl}/api/tickets`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

## Environment Variables

Required environment variables for each vendor:

```env
# JIRA
JIRA_CLIENT_ID=your_jira_client_id
JIRA_CLIENT_SECRET=your_jira_client_secret

# ServiceNow
SERVICENOW_CLIENT_ID=your_servicenow_client_id
SERVICENOW_CLIENT_SECRET=your_servicenow_client_secret

# Zendesk
ZENDESK_CLIENT_ID=your_zendesk_client_id
ZENDESK_CLIENT_SECRET=your_zendesk_client_secret

# Freshdesk
FRESHDESK_CLIENT_ID=your_freshdesk_client_id
FRESHDESK_CLIENT_SECRET=your_freshdesk_client_secret

# API Base URL for callbacks
API_BASE_URL=https://your-domain.com
```

## Security Considerations

1. **Client Credentials**: Store in environment variables, never in code
2. **Token Storage**: Always encrypted using AES-256
3. **CSRF Protection**: State parameter validation required
4. **Access Control**: Admin/Manager roles required for OAuth operations
5. **Token Expiry**: Automatic refresh 5 minutes before expiry
6. **Connection Status**: Track and update connection health

## Error Recovery

The system handles various failure scenarios:

1. **Network Failures**: Retry with exponential backoff
2. **Token Expiry**: Automatic refresh using refresh token
3. **Invalid Credentials**: Clear error messages in Serbian
4. **Vendor Downtime**: Graceful degradation with status updates

## Testing

### Unit Tests
```javascript
describe('OAuth Service', () => {
  it('should generate valid authorization URL', () => {
    const url = oauthService.generateAuthorizationUrl(config, state);
    expect(url).toContain('client_id=');
    expect(url).toContain('state=');
  });

  it('should handle Serbian error messages', () => {
    const error = oauthService.handleOAuthError({ 
      response: { data: { error: 'invalid_grant' } } 
    });
    expect(error).toBe('Неважећа дозвола за приступ. Проверите корисничке податке.');
  });
});
```

### Integration Tests
1. Test full OAuth flow with mock vendor
2. Verify token refresh mechanism
3. Test error scenarios
4. Verify Serbian character preservation

## Monitoring

Key metrics to monitor:
- OAuth flow completion rate
- Token refresh success rate
- Connection uptime per vendor
- Error frequency by type
- Average response time for vendor APIs

## Future Enhancements

1. Support for OAuth 2.1
2. PKCE (Proof Key for Code Exchange) support
3. Additional vendor support
4. Token rotation strategies
5. Multi-tenant OAuth support 