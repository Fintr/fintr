export const formDataWithFile = (data: any) => {
  const formData = new FormData();
      
  // Add all transaction data to FormData
  Object.entries(data).forEach(([key, value]) => {
    // Skip undefined or null values
    if (value === undefined || value === null) return;
    
    // Handle file separately
    if (key === 'file') {
      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      }
    } else {
      formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  });

  return formData;
}
