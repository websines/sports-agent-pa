import { google, Auth } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
);

// Store tokens in memory (in production, store in DB)
let tokens: Auth.Credentials | null = null;

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent',
  });
}

export async function handleCallback(code: string) {
  const { tokens: newTokens } = await oauth2Client.getToken(code);
  tokens = newTokens;
  oauth2Client.setCredentials(newTokens);
  return newTokens;
}

export function setTokens(newTokens: Auth.Credentials | null) {
  tokens = newTokens;
  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }
}

export function isAuthenticated() {
  return !!tokens?.access_token;
}

export async function uploadFileToDrive(
  filename: string,
  content: Buffer,
  mimeType: string = 'image/jpeg',
  folderId?: string
): Promise<{ id: string; webViewLink: string }> {
  if (!tokens) {
    throw new Error('Not authenticated with Google Drive');
  }

  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Find or create the Expenses folder
  let targetFolderId = folderId;

  if (!targetFolderId) {
    // Look for Expenses folder
    const folderSearch = await drive.files.list({
      q: "name='Expenses' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)',
    });

    if (folderSearch.data.files && folderSearch.data.files.length > 0) {
      targetFolderId = folderSearch.data.files[0].id!;
    } else {
      // Create Expenses folder
      const folder = await drive.files.create({
        requestBody: {
          name: 'Expenses',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      targetFolderId = folder.data.id!;
    }

    // Look for or create year subfolder
    const year = new Date().getFullYear().toString();
    const yearFolderSearch = await drive.files.list({
      q: `name='${year}' and '${targetFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (yearFolderSearch.data.files && yearFolderSearch.data.files.length > 0) {
      targetFolderId = yearFolderSearch.data.files[0].id!;
    } else {
      // Create year subfolder
      const yearFolder = await drive.files.create({
        requestBody: {
          name: year,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [targetFolderId],
        },
        fields: 'id',
      });
      targetFolderId = yearFolder.data.id!;
    }
  }

  // Upload the file
  const { Readable } = await import('stream');
  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: targetFolderId ? [targetFolderId] : undefined,
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, webViewLink',
  });

  return {
    id: response.data.id!,
    webViewLink: response.data.webViewLink!,
  };
}
