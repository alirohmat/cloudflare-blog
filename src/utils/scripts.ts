/**
 * Client-side scripts for the admin interface
 */

export const POST_EDITOR_SCRIPT = `
  // Auto-generate slug from title
  const titleInput = document.getElementById('titleInput');
  const slugInput = document.getElementById('slugInput');
  
  titleInput.addEventListener('input', (e) => {
    const title = e.target.value;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\\s-]/g, '') // Remove special characters
      .trim()
      .replace(/\\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Remove consecutive hyphens
    slugInput.value = slug;
  });
  
  // Upload cover image
  const uploadCoverBtn = document.getElementById('uploadCoverBtn');
  const coverImageInput = document.getElementById('coverImageInput');
  const coverImageKey = document.getElementById('coverImageKey');
  const coverPreview = document.getElementById('coverPreview');
  const coverPreviewImg = document.getElementById('coverPreviewImg');
  
  uploadCoverBtn.addEventListener('click', async () => {
    const file = coverImageInput.files[0];
    if (!file) {
      showStatus('Pilih gambar terlebih dahulu', 'error');
      return;
    }
    
    await uploadImage(file, (result) => {
      coverImageKey.value = result.filename;
      coverPreviewImg.src = result.url;
      coverPreview.classList.remove('hidden');
      showStatus('Cover image berhasil diupload!', 'success');
    });
  });
  
  // Upload and insert content image
  const uploadContentImageBtn = document.getElementById('uploadContentImageBtn');
  const contentImageInput = document.getElementById('contentImageInput');
  const contentArea = document.getElementById('contentArea');
  
  uploadContentImageBtn.addEventListener('click', async () => {
    const file = contentImageInput.files[0];
    if (!file) {
      showStatus('Pilih gambar terlebih dahulu', 'error');
      return;
    }
    
    await uploadImage(file, (result) => {
      const imgTag = \`<img src="\${result.url}" alt="Image" class="w-full max-w-2xl rounded-lg my-4" />\`;
      contentArea.value += '\\n' + imgTag + '\\n';
      contentImageInput.value = ''; // Clear file input
      showStatus('Gambar berhasil disisipkan ke konten!', 'success');
    });
  });
  
  // Upload image helper function
  async function uploadImage(file, onSuccess) {
    const formData = new FormData();
    formData.append('image', file);
    
    showStatus('Uploading...', 'info');
    
    try {
      const response = await fetch('/admin/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        onSuccess(result);
      } else {
        showStatus('Error: ' + (result.error || 'Upload gagal'), 'error');
      }
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  }
  
  // Show status message
  function showStatus(message, type) {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.textContent = message;
    statusDiv.className = 'p-3 rounded-lg';
    
    if (type === 'success') {
      statusDiv.className += ' bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    } else if (type === 'error') {
      statusDiv.className += ' bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    } else {
      statusDiv.className += ' bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
    
    statusDiv.classList.remove('hidden');
    
    if (type !== 'info') {
      setTimeout(() => {
        statusDiv.classList.add('hidden');
      }, 3000);
    }
  }
`;
