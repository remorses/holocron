import type { 
  EyecrestFile,
  DeleteFilesRequest,
  UpsertDatasetRequest,
  GetFileContentsQuery,
  SearchSectionsQuery,
  SearchSectionsResponse 
} from './worker.js';

// Re-export types for convenience
export type { EyecrestFile, SearchSectionsResponse, UpsertDatasetRequest };

export class EyecrestClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor({ token, baseUrl = 'https://eyecrest.org' }: { token: string; baseUrl?: string }) {
    this.token = token;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed with status ${response.status}: ${errorText}`);
    }

    return response;
  }

  async upsertDataset(
    params: { datasetId: string } & UpsertDatasetRequest
  ): Promise<void> {
    const { datasetId, ...options } = params;
    await this.request(`/v1/datasets/${datasetId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
  }

  async upsertFiles(params: { datasetId: string; files: EyecrestFile[] }): Promise<void> {
    const { datasetId, files } = params;
    await this.request(`/v1/datasets/${datasetId}/files`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    });
  }

  async deleteFiles(params: { datasetId: string; filenames: string[] }): Promise<void> {
    const { datasetId, filenames } = params;
    await this.request(`/v1/datasets/${datasetId}/files`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filenames }),
    });
  }

  async getFile(params: { 
    datasetId: string; 
    filePath: string; 
    showLineNumbers?: boolean;
    start?: number;
    end?: number;
  }): Promise<{ content: string; sha: string; metadata?: any }> {
    const { datasetId, filePath, showLineNumbers, start, end } = params;
    const queryParams = new URLSearchParams();
    if (showLineNumbers !== undefined) {
      queryParams.set('showLineNumbers', showLineNumbers ? 'true' : 'false');
    }
    if (start !== undefined) {
      queryParams.set('start', start.toString());
    }
    if (end !== undefined) {
      queryParams.set('end', end.toString());
    }

    const queryString = queryParams.toString();
    const path = `/v1/datasets/${datasetId}/files/${filePath}${queryString ? `?${queryString}` : ''}`;
    
    const response = await this.request(path);
    return response.json();
  }

  // Overload for JSON response (default)
  async search(params: { 
    datasetId: string; 
    query: string;
    page?: number;
    perPage?: number;
    maxChunksPerFile?: number;
    snippetLength?: number;
    returnAsText?: false;
  }): Promise<SearchSectionsResponse>;
  
  // Overload for text response
  async search(params: { 
    datasetId: string; 
    query: string;
    page?: number;
    perPage?: number;
    maxChunksPerFile?: number;
    snippetLength?: number;
    returnAsText: true;
  }): Promise<string>;
  
  // Implementation
  async search(params: { 
    datasetId: string; 
    query: string;
    page?: number;
    perPage?: number;
    maxChunksPerFile?: number;
    snippetLength?: number;
    returnAsText?: boolean;
  }): Promise<SearchSectionsResponse | string> {
    const { 
      datasetId, 
      query, 
      page = 0, 
      perPage = 20, 
      maxChunksPerFile = 5,
      snippetLength = 300,
      returnAsText = false
    } = params;
    const queryParams = new URLSearchParams({
      query,
      page: page.toString(),
      perPage: perPage.toString(),
      maxChunksPerFile: maxChunksPerFile.toString(),
      snippetLength: snippetLength.toString(),
    });

    const endpoint = returnAsText 
      ? `/v1/datasets/${datasetId}/search.txt?${queryParams}`
      : `/v1/datasets/${datasetId}/search?${queryParams}`;
    
    const response = await this.request(endpoint);
    return returnAsText ? response.text() : response.json();
  }
}