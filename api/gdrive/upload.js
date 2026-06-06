export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  try {
    const formData = await request.formData();
    const accessToken = formData.get('accessToken');
    const accountId = formData.get('accountId');
    const file = formData.get('file');
    const parentFolderId = formData.get('parentFolderId');

    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, error: 'Access token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Build the file metadata
    const fileMetadata = {
      name: file.name || 'unnamed_file',
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    // Use multipart upload for Google Drive
    // Build the multipart/related body manually
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(fileMetadata);

    const fileBytes = await file.arrayBuffer();
    const mediaPart = delimiter +
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

    // Combine all parts
    const encoder = new TextEncoder();
    const metadataBytes = encoder.encode(metadataPart);
    const mediaHeaderBytes = encoder.encode(mediaPart);
    const closeBytes = encoder.encode(closeDelimiter);

    // Concatenate all parts into a single Uint8Array
    const totalLength = metadataBytes.length + mediaHeaderBytes.length + fileBytes.byteLength + closeBytes.length;
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    combined.set(metadataBytes, offset); offset += metadataBytes.length;
    combined.set(mediaHeaderBytes, offset); offset += mediaHeaderBytes.length;
    combined.set(new Uint8Array(fileBytes), offset); offset += fileBytes.byteLength;
    combined.set(closeBytes, offset);

    // Determine upload type based on file size
    // Simple upload for small files, multipart for larger
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files' +
      '?uploadType=multipart&supportsAllDrives=true';

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    });

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: result.error?.message || 'Upload failed',
        details: result,
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      driveFileId: result.id,
      driveFileName: result.name,
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (error) {
    console.error('[GDrive Upload Error]', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
