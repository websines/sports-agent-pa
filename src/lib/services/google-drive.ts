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

// List files in a folder (for syncing)
export async function listFilesInFolder(
  folderId?: string,
  folderName: string = 'Receipts-Inbox'
): Promise<Array<{ id: string; name: string; mimeType: string; createdTime: string }>> {
  if (!tokens) {
    throw new Error('Not authenticated with Google Drive');
  }

  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  let targetFolderId = folderId;

  // Find the folder by name if no ID provided
  if (!targetFolderId) {
    const folderSearch = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (!folderSearch.data.files || folderSearch.data.files.length === 0) {
      // Create the inbox folder if it doesn't exist
      const folder = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      targetFolderId = folder.data.id!;
      return []; // New folder, no files yet
    }

    targetFolderId = folderSearch.data.files[0].id!;
  }

  // List image files in the folder
  const response = await drive.files.list({
    q: `'${targetFolderId}' in parents and (mimeType contains 'image/') and trashed=false`,
    fields: 'files(id, name, mimeType, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 50,
  });

  return (response.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    createdTime: f.createdTime!,
  }));
}

// Download a file from Drive
export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  if (!tokens) {
    throw new Error('Not authenticated with Google Drive');
  }

  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

// Move a file to a different folder
export async function moveFileToDrive(
  fileId: string,
  newFolderId: string,
  newName?: string
): Promise<void> {
  if (!tokens) {
    throw new Error('Not authenticated with Google Drive');
  }

  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Get current parents
  const file = await drive.files.get({
    fileId,
    fields: 'parents',
  });

  const previousParents = (file.data.parents || []).join(',');

  // Move to new folder
  await drive.files.update({
    fileId,
    addParents: newFolderId,
    removeParents: previousParents,
    requestBody: newName ? { name: newName } : undefined,
  });
}

// Get or create processed folder
export async function getProcessedFolderId(): Promise<string> {
  if (!tokens) {
    throw new Error('Not authenticated with Google Drive');
  }

  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Look for Expenses folder
  let expensesFolderId: string;
  const expensesSearch = await drive.files.list({
    q: "name='Expenses' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id)',
  });

  if (expensesSearch.data.files && expensesSearch.data.files.length > 0) {
    expensesFolderId = expensesSearch.data.files[0].id!;
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: 'Expenses',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    expensesFolderId = folder.data.id!;
  }

  // Get or create year subfolder
  const year = new Date().getFullYear().toString();
  const yearSearch = await drive.files.list({
    q: `name='${year}' and '${expensesFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (yearSearch.data.files && yearSearch.data.files.length > 0) {
    return yearSearch.data.files[0].id!;
  }

  const yearFolder = await drive.files.create({
    requestBody: {
      name: year,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [expensesFolderId],
    },
    fields: 'id',
  });

  return yearFolder.data.id!;
}
