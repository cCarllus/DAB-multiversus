import { resolveApiBaseUrl } from './api-base-url';
import { AppApiError } from './api-error';

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

interface BackendApiRequestOptions {
  accessToken?: string;
  body?: BodyInit;
  headers?: HeadersInit;
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST';
}

interface BackendApiRequestMessages {
  failureCode: string;
  failureMessage: string;
  networkCode?: string;
  networkMessage: string;
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') ?? false;
}

export class BackendApiClient {
  constructor(protected readonly baseUrl = resolveApiBaseUrl()) {}

  public resolveAssetUrl(assetPath: string | null): string | null {
    if (!assetPath) {
      return null;
    }

    if (/^https?:\/\//i.test(assetPath)) {
      return assetPath;
    }

    return `${this.baseUrl}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
  }

  protected async request<T>(
    path: string,
    options: BackendApiRequestOptions,
    messages: BackendApiRequestMessages,
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        body: options.body,
        headers: {
          Accept: 'application/json',
          ...(options.accessToken
            ? {
                Authorization: `Bearer ${options.accessToken}`,
              }
            : {}),
          ...(options.body && !(options.body instanceof FormData)
            ? {
                'Content-Type': 'application/json',
              }
            : {}),
          ...(options.headers ?? {}),
        },
        method: options.method,
      });

      const payload = isJsonResponse(response)
        ? ((await response.json()) as unknown)
        : undefined;

      if (!response.ok) {
        const errorEnvelope = (payload ?? {}) as ErrorEnvelope;

        throw new AppApiError(
          errorEnvelope.error?.code ?? messages.failureCode,
          errorEnvelope.error?.message ?? messages.failureMessage,
          response.status,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return payload as T;
    } catch (error) {
      if (error instanceof AppApiError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new AppApiError(
          messages.networkCode ?? 'BACKEND_UNAVAILABLE',
          messages.networkMessage,
        );
      }

      throw new AppApiError(messages.failureCode, messages.failureMessage);
    }
  }
}
