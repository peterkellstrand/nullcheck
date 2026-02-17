'use client';

import { useState } from 'react';
import { openApiSpec } from '@/lib/openapi';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface PathOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: Record<string, unknown>;
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses?: Record<string, { description?: string }>;
  security?: Array<Record<string, string[]>>;
}

export default function DocsPage() {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const methodColors: Record<string, string> = {
    get: 'bg-green-600',
    post: 'bg-blue-600',
    put: 'bg-yellow-600',
    patch: 'bg-orange-600',
    delete: 'bg-red-600',
  };

  const paths = openApiSpec.paths as Record<string, Partial<Record<HttpMethod, PathOperation>>>;
  const tags = openApiSpec.tags as Array<{ name: string; description: string }>;

  // Group endpoints by tag
  const endpointsByTag: Record<string, Array<{ path: string; method: string; operation: PathOperation }>> = {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const tag = operation.tags?.[0] || 'Other';
      if (!endpointsByTag[tag]) {
        endpointsByTag[tag] = [];
      }
      endpointsByTag[tag].push({ path, method, operation });
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-4">{openApiSpec.info.title}</h1>
          <p className="text-xl text-gray-300 mb-4">{openApiSpec.info.description}</p>
          <div className="flex gap-4 text-sm">
            <span className="px-3 py-1 bg-gray-700 rounded">Version {openApiSpec.info.version}</span>
            <a
              href="/api/openapi"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded"
              target="_blank"
            >
              OpenAPI JSON
            </a>
          </div>
        </header>

        {/* Authentication */}
        <section className="mb-12 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
          <p className="text-gray-300 mb-4">
            All API requests require authentication via API key header:
          </p>
          <pre className="bg-gray-900 p-4 rounded font-mono text-sm overflow-x-auto">
            X-API-Key: your_api_key_here
          </pre>
          <p className="text-gray-400 mt-4 text-sm">
            Get your API key from the <a href="/keys" className="text-blue-400 hover:underline">API Keys</a> page.
          </p>
        </section>

        {/* Base URL */}
        <section className="mb-12 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Base URL</h2>
          <div className="space-y-2">
            {openApiSpec.servers.map((server) => (
              <div key={server.url} className="flex items-center gap-4">
                <code className="bg-gray-900 px-3 py-2 rounded font-mono">{server.url}</code>
                <span className="text-gray-400">{server.description}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Endpoints by Tag */}
        {tags.map((tag) => (
          <section key={tag.name} className="mb-12">
            <h2 className="text-2xl font-semibold mb-2">{tag.name}</h2>
            <p className="text-gray-400 mb-6">{tag.description}</p>

            <div className="space-y-4">
              {endpointsByTag[tag.name]?.map(({ path, method, operation }) => {
                const key = `${method}-${path}`;
                const isExpanded = expandedPaths.has(key);

                return (
                  <div key={key} className="bg-gray-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => togglePath(key)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-gray-700 transition-colors"
                    >
                      <span
                        className={`px-3 py-1 rounded text-xs font-bold uppercase ${methodColors[method]}`}
                      >
                        {method}
                      </span>
                      <code className="font-mono text-sm">{path}</code>
                      <span className="text-gray-400 text-sm flex-1 text-left">
                        {operation.summary}
                      </span>
                      <span className="text-gray-500">{isExpanded ? '-' : '+'}</span>
                    </button>

                    {isExpanded && (
                      <div className="p-4 border-t border-gray-700 space-y-6">
                        {operation.description && (
                          <p className="text-gray-300">{operation.description}</p>
                        )}

                        {/* Parameters */}
                        {operation.parameters && operation.parameters.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-3">Parameters</h4>
                            <div className="bg-gray-900 rounded overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-800">
                                  <tr>
                                    <th className="text-left p-3">Name</th>
                                    <th className="text-left p-3">In</th>
                                    <th className="text-left p-3">Type</th>
                                    <th className="text-left p-3">Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {operation.parameters.map((param) => (
                                    <tr key={param.name} className="border-t border-gray-800">
                                      <td className="p-3 font-mono">
                                        {param.name}
                                        {param.required && (
                                          <span className="text-red-400 ml-1">*</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-gray-400">{param.in}</td>
                                      <td className="p-3 text-gray-400">
                                        {(param.schema as { type?: string })?.type || 'string'}
                                      </td>
                                      <td className="p-3 text-gray-400">{param.description}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Request Body */}
                        {operation.requestBody && (
                          <div>
                            <h4 className="font-semibold mb-3">
                              Request Body
                              {operation.requestBody.required && (
                                <span className="text-red-400 ml-2 text-sm">required</span>
                              )}
                            </h4>
                            <pre className="bg-gray-900 p-4 rounded font-mono text-sm overflow-x-auto">
                              {JSON.stringify(
                                operation.requestBody.content?.['application/json']?.schema || {},
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        )}

                        {/* Responses */}
                        {operation.responses && (
                          <div>
                            <h4 className="font-semibold mb-3">Responses</h4>
                            <div className="space-y-2">
                              {Object.entries(operation.responses).map(([code, response]) => (
                                <div
                                  key={code}
                                  className="flex items-center gap-4 bg-gray-900 p-3 rounded"
                                >
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-mono ${
                                      code.startsWith('2')
                                        ? 'bg-green-900 text-green-300'
                                        : code.startsWith('4')
                                        ? 'bg-yellow-900 text-yellow-300'
                                        : 'bg-red-900 text-red-300'
                                    }`}
                                  >
                                    {code}
                                  </span>
                                  <span className="text-gray-400">{response.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Example cURL */}
                        <div>
                          <h4 className="font-semibold mb-3">Example Request</h4>
                          <pre className="bg-gray-900 p-4 rounded font-mono text-sm overflow-x-auto">
                            {generateCurlExample(path, method, operation)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Rate Limits */}
        <section className="mb-12 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Rate Limits</h2>
          <p className="text-gray-300 mb-4">
            Rate limits are applied per API key based on your subscription tier:
          </p>
          <table className="w-full text-sm">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Daily Limit</th>
                <th className="text-left p-3">Overage</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-700">
                <td className="p-3">Starter</td>
                <td className="p-3">1,000 requests</td>
                <td className="p-3 text-gray-400">Not available</td>
              </tr>
              <tr className="border-t border-gray-700">
                <td className="p-3">Builder</td>
                <td className="p-3">10,000 requests</td>
                <td className="p-3">$0.25 / 1,000 requests</td>
              </tr>
              <tr className="border-t border-gray-700">
                <td className="p-3">Scale</td>
                <td className="p-3">100,000 requests</td>
                <td className="p-3">$0.10 / 1,000 requests</td>
              </tr>
            </tbody>
          </table>
          <p className="text-gray-400 mt-4 text-sm">
            Rate limit headers are included in all API responses:
            X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
          </p>
        </section>

        {/* Errors */}
        <section className="mb-12 p-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Error Handling</h2>
          <p className="text-gray-300 mb-4">
            All errors follow a consistent format:
          </p>
          <pre className="bg-gray-900 p-4 rounded font-mono text-sm overflow-x-auto">
{`{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}`}
          </pre>
          <div className="mt-4 space-y-2">
            <div className="flex gap-4 text-sm">
              <code className="bg-gray-900 px-2 py-1 rounded">400</code>
              <span className="text-gray-400">Bad Request - Invalid parameters</span>
            </div>
            <div className="flex gap-4 text-sm">
              <code className="bg-gray-900 px-2 py-1 rounded">401</code>
              <span className="text-gray-400">Unauthorized - Invalid or missing API key</span>
            </div>
            <div className="flex gap-4 text-sm">
              <code className="bg-gray-900 px-2 py-1 rounded">404</code>
              <span className="text-gray-400">Not Found - Resource does not exist</span>
            </div>
            <div className="flex gap-4 text-sm">
              <code className="bg-gray-900 px-2 py-1 rounded">429</code>
              <span className="text-gray-400">Rate Limited - Daily limit exceeded</span>
            </div>
            <div className="flex gap-4 text-sm">
              <code className="bg-gray-900 px-2 py-1 rounded">500</code>
              <span className="text-gray-400">Internal Error - Server error</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function generateCurlExample(path: string, method: string, operation: PathOperation): string {
  const baseUrl = 'https://api.nullcheck.io';
  const hasAuth = !operation.security || operation.security.length > 0;

  let curl = `curl -X ${method.toUpperCase()} "${baseUrl}${path}"`;

  if (hasAuth) {
    curl += ` \\\n  -H "X-API-Key: your_api_key"`;
  }

  if (operation.requestBody) {
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -d '{"example": "data"}'`;
  }

  return curl;
}
