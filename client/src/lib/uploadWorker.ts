// Web Worker for handling file uploads
self.onmessage = async (e) => {
  const { file, tags } = e.data;
  
  try {
    // Convert file to chunks
    const chunks = [];
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    let offset = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await chunk.arrayBuffer();
      chunks.push(new Uint8Array(buffer));
      offset += chunk.size;
      
      // Report progress
      self.postMessage({
        type: 'progress',
        progress: Math.min(100, (offset / file.size) * 100)
      });
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedArray = new Uint8Array(totalLength);
    let position = 0;
    for (const chunk of chunks) {
      combinedArray.set(chunk, position);
      position += chunk.length;
    }
    
    // Upload to server
    const response = await fetch('/api/arweave/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: {
          tags,
          data_size: totalLength,
        },
        data: Array.from(combinedArray)
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Upload failed');
    }
    
    const result = await response.json();
    self.postMessage({
      type: 'complete',
      result: {
        id: result.id,
        url: `https://arweave.net/${result.id}`
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error.message
    });
  }
};
