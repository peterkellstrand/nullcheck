/**
 * OpenAPI 3.1 Specification for nullcheck API
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'nullcheck API',
    description: 'Risk-first token analysis API for DeFi agents and applications',
    version: '1.0.0',
    contact: {
      name: 'nullcheck',
      url: 'https://nullcheck.io',
    },
  },
  servers: [
    {
      url: 'https://api.nullcheck.io',
      description: 'Production',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development',
    },
  ],
  security: [
    { apiKey: [] },
  ],
  paths: {
    '/api/tokens': {
      get: {
        summary: 'Get trending tokens',
        description: 'Returns a list of trending tokens with metrics and optional risk scores',
        operationId: 'getTrendingTokens',
        tags: ['Tokens'],
        parameters: [
          {
            name: 'chain',
            in: 'query',
            description: 'Filter by blockchain',
            schema: {
              type: 'string',
              enum: ['ethereum', 'base', 'solana', 'arbitrum', 'polygon', 'bsc', 'avalanche'],
            },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of tokens to return (max 100)',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TokensResponse',
                },
              },
            },
          },
          '400': {
            $ref: '#/components/responses/BadRequest',
          },
          '429': {
            $ref: '#/components/responses/RateLimited',
          },
        },
      },
    },
    '/api/token/{chain}/{address}': {
      get: {
        summary: 'Get token details',
        description: 'Returns detailed information about a specific token',
        operationId: 'getToken',
        tags: ['Tokens'],
        parameters: [
          {
            name: 'chain',
            in: 'path',
            required: true,
            description: 'Blockchain network',
            schema: {
              type: 'string',
              enum: ['ethereum', 'base', 'solana', 'arbitrum', 'polygon', 'bsc', 'avalanche'],
            },
          },
          {
            name: 'address',
            in: 'path',
            required: true,
            description: 'Token contract address',
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TokenDetailResponse',
                },
              },
            },
          },
          '404': {
            $ref: '#/components/responses/NotFound',
          },
        },
      },
    },
    '/api/risk/{chain}/{address}': {
      get: {
        summary: 'Get risk analysis',
        description: 'Returns cached risk analysis for a token if available',
        operationId: 'getRiskAnalysis',
        tags: ['Risk'],
        parameters: [
          {
            name: 'chain',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'address',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Risk analysis found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RiskResponse',
                },
              },
            },
          },
          '404': {
            description: 'No cached analysis available',
          },
        },
      },
      post: {
        summary: 'Analyze token risk',
        description: 'Performs risk analysis on a token. Cached results returned if fresh.',
        operationId: 'analyzeRisk',
        tags: ['Risk'],
        parameters: [
          {
            name: 'chain',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'address',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  symbol: { type: 'string' },
                  name: { type: 'string' },
                  poolAddress: { type: 'string' },
                  force: { type: 'boolean', description: 'Force fresh analysis' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Risk analysis complete',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RiskResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/risk/batch': {
      post: {
        summary: 'Batch risk analysis',
        description: 'Analyze multiple tokens in a single request (max 10)',
        operationId: 'batchRiskAnalysis',
        tags: ['Risk'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tokens'],
                properties: {
                  tokens: {
                    type: 'array',
                    maxItems: 10,
                    items: {
                      type: 'object',
                      required: ['address', 'chainId'],
                      properties: {
                        address: { type: 'string' },
                        chainId: { type: 'string' },
                        symbol: { type: 'string' },
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Batch analysis complete',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/BatchRiskResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/search': {
      get: {
        summary: 'Search tokens',
        description: 'Search for tokens by name, symbol, or address',
        operationId: 'searchTokens',
        tags: ['Tokens'],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: 'Search query',
            schema: { type: 'string', minLength: 2 },
          },
          {
            name: 'chain',
            in: 'query',
            description: 'Filter by chain',
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SearchResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/ohlcv/{chain}/{address}': {
      get: {
        summary: 'Get OHLCV data',
        description: 'Returns candlestick data for charting',
        operationId: 'getOHLCV',
        tags: ['Market Data'],
        parameters: [
          {
            name: 'chain',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'address',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'timeframe',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
              default: '1h',
            },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100 },
          },
        ],
        responses: {
          '200': {
            description: 'OHLCV data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/OHLCVResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/webhooks': {
      get: {
        summary: 'List webhook subscriptions',
        description: 'Returns all webhook subscriptions for the authenticated API key',
        operationId: 'listWebhooks',
        tags: ['Webhooks'],
        responses: {
          '200': {
            description: 'Webhook subscriptions',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebhooksListResponse',
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create webhook subscription',
        description: 'Subscribe to webhook events',
        operationId: 'createWebhook',
        tags: ['Webhooks'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WebhookCreateRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Webhook created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebhookResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/usage': {
      get: {
        summary: 'Get API usage',
        description: 'Returns usage statistics for the authenticated API key',
        operationId: 'getUsage',
        tags: ['Account'],
        responses: {
          '200': {
            description: 'Usage statistics',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UsageResponse',
                },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        summary: 'Health check',
        description: 'Returns API health status',
        operationId: 'healthCheck',
        tags: ['System'],
        security: [],
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok'] },
                    version: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for agent authentication',
      },
    },
    schemas: {
      Token: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          chainId: { type: 'string' },
          symbol: { type: 'string' },
          name: { type: 'string' },
          decimals: { type: 'integer' },
          logoUrl: { type: 'string', nullable: true },
        },
      },
      TokenMetrics: {
        type: 'object',
        properties: {
          price: { type: 'number' },
          priceChange1h: { type: 'number' },
          priceChange24h: { type: 'number' },
          volume24h: { type: 'number' },
          liquidity: { type: 'number' },
          marketCap: { type: 'number', nullable: true },
          txns24h: { type: 'integer' },
          buys24h: { type: 'integer' },
          sells24h: { type: 'integer' },
        },
      },
      RiskScore: {
        type: 'object',
        properties: {
          totalScore: { type: 'integer', minimum: 0, maximum: 100 },
          level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          liquidity: { $ref: '#/components/schemas/LiquidityRisk' },
          holders: { $ref: '#/components/schemas/HolderRisk' },
          contract: { $ref: '#/components/schemas/ContractRisk' },
          honeypot: { $ref: '#/components/schemas/HoneypotRisk' },
          warnings: {
            type: 'array',
            items: { $ref: '#/components/schemas/RiskWarning' },
          },
          analyzedAt: { type: 'string', format: 'date-time' },
        },
      },
      LiquidityRisk: {
        type: 'object',
        properties: {
          score: { type: 'integer' },
          liquidity: { type: 'number' },
          lpLocked: { type: 'boolean' },
          lpLockedPercent: { type: 'number' },
        },
      },
      HolderRisk: {
        type: 'object',
        properties: {
          score: { type: 'integer' },
          totalHolders: { type: 'integer' },
          top10Percent: { type: 'number' },
          creatorHoldingPercent: { type: 'number' },
        },
      },
      ContractRisk: {
        type: 'object',
        properties: {
          score: { type: 'integer' },
          verified: { type: 'boolean' },
          renounced: { type: 'boolean' },
          hasMintFunction: { type: 'boolean' },
          maxTaxPercent: { type: 'number' },
        },
      },
      HoneypotRisk: {
        type: 'object',
        properties: {
          score: { type: 'integer' },
          isHoneypot: { type: 'boolean' },
          buyTax: { type: 'number' },
          sellTax: { type: 'number' },
          cannotSell: { type: 'boolean' },
        },
      },
      RiskWarning: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          message: { type: 'string' },
        },
      },
      TokensResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              tokens: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/Token' },
                    {
                      type: 'object',
                      properties: {
                        metrics: { $ref: '#/components/schemas/TokenMetrics' },
                        risk: { $ref: '#/components/schemas/RiskScore' },
                      },
                    },
                  ],
                },
              },
              meta: {
                type: 'object',
                properties: {
                  count: { type: 'integer' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
      TokenDetailResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            allOf: [
              { $ref: '#/components/schemas/Token' },
              {
                type: 'object',
                properties: {
                  metrics: { $ref: '#/components/schemas/TokenMetrics' },
                  risk: { $ref: '#/components/schemas/RiskScore' },
                },
              },
            ],
          },
        },
      },
      RiskResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/components/schemas/RiskScore' },
          cached: { type: 'boolean' },
        },
      },
      BatchRiskResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'object',
                additionalProperties: { $ref: '#/components/schemas/RiskScore' },
              },
              meta: {
                type: 'object',
                properties: {
                  requested: { type: 'integer' },
                  analyzed: { type: 'integer' },
                  cached: { type: 'integer' },
                  failed: { type: 'integer' },
                },
              },
            },
          },
        },
      },
      SearchResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: { $ref: '#/components/schemas/Token' },
              },
              count: { type: 'integer' },
            },
          },
        },
      },
      OHLCVResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              ohlcv: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    timestamp: { type: 'integer' },
                    open: { type: 'number' },
                    high: { type: 'number' },
                    low: { type: 'number' },
                    close: { type: 'number' },
                    volume: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
      WebhooksListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              subscriptions: {
                type: 'array',
                items: { $ref: '#/components/schemas/WebhookSubscription' },
              },
            },
          },
        },
      },
      WebhookSubscription: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: { type: 'string' },
          },
          enabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      WebhookCreateRequest: {
        type: 'object',
        required: ['url', 'events'],
        properties: {
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['risk.high', 'risk.critical', 'risk.honeypot', 'whale.buy', 'whale.sell', 'price.increase', 'price.decrease'],
            },
          },
          secret: { type: 'string', description: 'Custom secret for HMAC signing' },
        },
      },
      WebhookResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { $ref: '#/components/schemas/WebhookSubscription' },
        },
      },
      UsageResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              today: {
                type: 'object',
                properties: {
                  requests: { type: 'integer' },
                  limit: { type: 'integer' },
                  remaining: { type: 'integer' },
                },
              },
              month: {
                type: 'object',
                properties: {
                  requests: { type: 'integer' },
                },
              },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - invalid or missing API key',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        headers: {
          'X-RateLimit-Limit': {
            description: 'Daily request limit',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Remaining': {
            description: 'Remaining requests today',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Reset': {
            description: 'Unix timestamp when limit resets',
            schema: { type: 'integer' },
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
  tags: [
    { name: 'Tokens', description: 'Token data and metrics' },
    { name: 'Risk', description: 'Token risk analysis' },
    { name: 'Market Data', description: 'Price and OHLCV data' },
    { name: 'Webhooks', description: 'Webhook subscriptions' },
    { name: 'Account', description: 'API key and usage management' },
    { name: 'System', description: 'System health and status' },
  ],
};
