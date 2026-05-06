/**
 * Creates a display file object from a remote file attachment
 * This is used for showing images in forms without fetching the blob
 */
export const createDisplayFileFromAttachment = (fileAttachment: {
  id: string;
  url: string;
  filename: string;
  contentType: string;
}) => {
  return {
    name: fileAttachment.filename,
    type: fileAttachment.contentType,
    size: 0, // We don't have the size, but the form doesn't use it for display
    
    // Add the URL for preview generation
    url: fileAttachment.url,
    
    // Add a flag to indicate this is a remote file (not a local File object)
    isRemoteFile: true,
    
    // Store the file ID for backend processing
    fileId: fileAttachment.id
  } as any;
};

/**
 * Creates a display file object from draft file data
 * This is used for showing images from draft files
 */
export const createDisplayFileFromDraft = (draftFile: {
  id: string;
  url: string;
  name: string;
  contentType: string;
}) => {
  return {
    name: draftFile.name,
    type: draftFile.contentType,
    size: 0,
    url: draftFile.url,
    isRemoteFile: true,
    fileId: draftFile.id
  } as any;
};
