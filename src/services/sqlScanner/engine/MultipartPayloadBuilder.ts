/**
 * Sentinel RFC 7578 Multipart & Polyglot File Synthesizer
 *
 * Solves file upload parameter testing by:
 * 1. Building valid RFC 7578 multipart/form-data bodies with exact boundaries.
 * 2. Synthesizing valid magic bytes for PDF, PNG, JPEG, and ZIP to satisfy MIME validators.
 * 3. Allowing payload injection into file names, text fields, and file contents.
 */

export interface MultipartField {
  name: string;
  value: string;
}

export interface MultipartFile {
  fieldName: string;
  fileName: string;
  mimeType: string;
  content: string | Uint8Array;
}

export class MultipartPayloadBuilder {
  public static generateBoundary(): string {
    return `---------------------------sentinel${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
  }

  public static getMagicFileContent(format: 'png' | 'pdf' | 'jpg' | 'zip', appendPayload: string = ''): string {
    switch (format) {
      case 'png':
        return `\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4${appendPayload}`;
      case 'pdf':
        return `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n${appendPayload}`;
      case 'zip':
        return `PK\x03\x04\x14\x00\x00\x00\x08\x00${appendPayload}`;
      case 'jpg':
      default:
        return `\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x0048\x0048\x00\x00${appendPayload}`;
    }
  }

  public static build(
    fields: MultipartField[] = [],
    files: MultipartFile[] = [],
    boundary?: string
  ): { body: string; contentType: string; boundary: string } {
    const bound = boundary || MultipartPayloadBuilder.generateBoundary();
    const parts: string[] = [];

    for (const f of fields) {
      parts.push(`--${bound}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}`);
    }

    for (const file of files) {
      const contentStr = typeof file.content === 'string' ? file.content : new TextDecoder().decode(file.content);
      parts.push(
        `--${bound}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\nContent-Type: ${file.mimeType}\r\n\r\n${contentStr}`
      );
    }

    const body = `${parts.join('\r\n')}\r\n--${bound}--\r\n`;
    const contentType = `multipart/form-data; boundary=${bound}`;

    return { body, contentType, boundary: bound };
  }
}
