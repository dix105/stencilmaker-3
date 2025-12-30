document.addEventListener('DOMContentLoaded', () => {
    
    /* =========================================
       1. EXISTING UI LOGIC (Mobile Menu, Scroll, FAQ, Modals)
       ========================================= */
       
    // MOBILE MENU
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('header nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.textContent = nav.classList.contains('active') ? '✕' : '☰';
        });

        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                menuToggle.textContent = '☰';
            });
        });
    }

    // SCROLL ANIMATIONS
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // FAQ ACCORDION
    const faqButtons = document.querySelectorAll('.faq-question');
    faqButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const answer = btn.nextElementSibling;
            btn.classList.toggle('active');
            if (btn.classList.contains('active')) {
                answer.style.maxHeight = answer.scrollHeight + "px";
            } else {
                answer.style.maxHeight = null;
            }
            faqButtons.forEach(otherBtn => {
                if (otherBtn !== btn) {
                    otherBtn.classList.remove('active');
                    otherBtn.nextElementSibling.style.maxHeight = null;
                }
            });
        });
    });

    // MODAL LOGIC
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    document.querySelectorAll('[data-modal-target]').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const modalId = trigger.getAttribute('data-modal-target');
            openModal(modalId);
        });
    });

    document.querySelectorAll('[data-modal-close]').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const modalId = trigger.getAttribute('data-modal-close');
            closeModal(modalId);
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });

    // MOUSE TRACKING
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        document.documentElement.style.setProperty('--mouse-x', x);
        document.documentElement.style.setProperty('--mouse-y', y);
    });

    /* =========================================
       2. API & BACKEND INTEGRATION
       ========================================= */

    // CONSTANTS & STATE
    const USER_ID = 'DObRu1vyStbUynoQmTcHBlhs55z2';
    const EFFECT_ID = 'stencilMaker';
    const POLL_INTERVAL = 2000;
    const MAX_POLLS = 60;
    
    let currentUploadedUrl = null;

    // --- HELPER FUNCTIONS ---

    // Generate nanoid for unique filename
    function generateNanoId(length = 21) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Upload file to CDN storage
    async function uploadFile(file) {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const uniqueId = generateNanoId();
        const fileName = uniqueId + '.' + fileExtension;
        
        // Step 1: Get signed URL
        const signedUrlResponse = await fetch(
            'https://api.chromastudio.ai/get-emd-upload-url?fileName=' + encodeURIComponent(fileName),
            { method: 'GET' }
        );
        
        if (!signedUrlResponse.ok) {
            throw new Error('Failed to get signed URL: ' + signedUrlResponse.statusText);
        }
        
        const signedUrl = await signedUrlResponse.text();
        console.log('Got signed URL');
        
        // Step 2: PUT file to signed URL
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file: ' + uploadResponse.statusText);
        }
        
        // Step 3: Return download URL
        const downloadUrl = 'https://contents.maxstudio.ai/' + fileName;
        console.log('Uploaded to:', downloadUrl);
        return downloadUrl;
    }

    // Submit generation job
    async function submitImageGenJob(imageUrl) {
        // Hardcoded for Image Effects based on config
        const isVideo = false; // 'image-effects' === 'video-effects'
        const endpoint = 'https://api.chromastudio.ai/image-gen';
        
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
            'sec-ch-ua-mobile': '?0'
        };

        const body = {
            model: 'image-effects',
            toolType: 'image-effects',
            effectId: EFFECT_ID,
            imageUrl: imageUrl,
            userId: USER_ID,
            removeWatermark: true,
            isPrivate: true
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit job: ' + response.statusText);
        }
        
        const data = await response.json();
        console.log('Job submitted:', data.jobId, 'Status:', data.status);
        return data;
    }

    // Poll job status
    async function pollJobStatus(jobId) {
        const baseUrl = 'https://api.chromastudio.ai/image-gen';
        let polls = 0;
        
        while (polls < MAX_POLLS) {
            const response = await fetch(
                `${baseUrl}/${USER_ID}/${jobId}/status`,
                {
                    method: 'GET',
                    headers: { 'Accept': 'application/json, text/plain, */*' }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to check status: ' + response.statusText);
            }
            
            const data = await response.json();
            console.log('Poll', polls + 1, '- Status:', data.status);
            
            if (data.status === 'completed') {
                console.log('Job completed! Result:', data.result);
                return data;
            }
            
            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Job processing failed');
            }
            
            updateStatus('PROCESSING... (' + (polls + 1) + ')');
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
            polls++;
        }
        
        throw new Error('Job timed out after ' + MAX_POLLS + ' polls');
    }

    // --- UI HELPERS ---

    function showLoading() {
        const loader = document.getElementById('loading-state');
        const resultContainer = document.getElementById('result-container');
        const resultPlaceholder = document.querySelector('.result-placeholder');
        
        if (loader) {
            loader.classList.remove('hidden');
            loader.style.display = 'flex'; // Ensure flex layout
        }
        if (resultPlaceholder) resultPlaceholder.classList.add('hidden');
        if (resultContainer) resultContainer.classList.add('loading');
    }

    function hideLoading() {
        const loader = document.getElementById('loading-state');
        const resultContainer = document.getElementById('result-container');
        
        if (loader) {
            loader.classList.add('hidden');
            loader.style.display = 'none';
        }
        if (resultContainer) resultContainer.classList.remove('loading');
    }

    function updateStatus(text) {
        // Update button text
        const generateBtn = document.getElementById('generate-btn');
        if (generateBtn) {
            if (text.includes('PROCESSING') || text.includes('UPLOADING') || text.includes('SUBMITTING')) {
                generateBtn.disabled = true;
                generateBtn.textContent = text;
                generateBtn.classList.add('disabled');
            } else if (text === 'READY') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate';
                generateBtn.classList.remove('disabled');
            } else if (text === 'COMPLETE') {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Again';
                generateBtn.classList.remove('disabled');
            }
        }
    }

    function showError(msg) {
        alert('Error: ' + msg);
    }

    function showPreview(url) {
        const img = document.getElementById('preview-image');
        const uploadPlaceholder = document.querySelector('.upload-placeholder');
        if (img) {
            img.src = url;
            img.classList.remove('hidden');
            img.style.display = 'block';
        }
        if (uploadPlaceholder) {
            uploadPlaceholder.classList.add('hidden');
        }
    }

    function showResultMedia(url) {
        const resultImg = document.getElementById('result-final');
        const resultContainer = document.getElementById('result-container');
        const resultPlaceholder = document.querySelector('.result-placeholder');
        
        if (resultPlaceholder) resultPlaceholder.classList.add('hidden');
        if (resultContainer) resultContainer.classList.remove('hidden');
        
        // Hide video if present
        const video = document.getElementById('result-video');
        if (video) video.style.display = 'none';
        
        if (resultImg) {
            resultImg.classList.remove('hidden');
            resultImg.style.display = 'block';
            resultImg.src = url + '?t=' + new Date().getTime();
        }
    }

    function showDownloadButton(url) {
        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn) {
            downloadBtn.dataset.url = url;
            downloadBtn.classList.remove('disabled');
            downloadBtn.style.display = 'inline-flex';
        }
    }

    // --- LOGIC HANDLERS ---

    async function handleFileSelect(file) {
        try {
            showLoading();
            updateStatus('UPLOADING...');
            
            // Upload immediately
            const uploadedUrl = await uploadFile(file);
            currentUploadedUrl = uploadedUrl;
            
            showPreview(uploadedUrl);
            updateStatus('READY');
            hideLoading();
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    async function handleGenerate() {
        if (!currentUploadedUrl) return;
        
        try {
            showLoading();
            updateStatus('SUBMITTING...');
            
            // 1. Submit Job
            const jobData = await submitImageGenJob(currentUploadedUrl);
            
            updateStatus('PROCESSING...');
            
            // 2. Poll Status
            const result = await pollJobStatus(jobData.jobId);
            
            // 3. Extract Result
            const resultItem = Array.isArray(result.result) ? result.result[0] : result.result;
            const resultUrl = resultItem?.mediaUrl || resultItem?.image;
            
            if (!resultUrl) {
                console.error('Response:', result);
                throw new Error('No image URL in response');
            }
            
            console.log('Result URL:', resultUrl);
            currentUploadedUrl = resultUrl; // Update for next action if needed, though strictly this is output
            
            // 4. Display & Enable Download
            showResultMedia(resultUrl);
            updateStatus('COMPLETE');
            hideLoading();
            showDownloadButton(resultUrl);
            
        } catch (error) {
            hideLoading();
            updateStatus('ERROR');
            showError(error.message);
        }
    }

    // --- EVENT WIRING ---

    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const downloadBtn = document.getElementById('download-btn');

    // File Input Logic
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFileSelect(file);
        });
    }

    // Upload Zone Drag & Drop
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--primary)';
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '#000';
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '#000';
            uploadZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
        });
        
        uploadZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    }

    // Generate Button
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerate);
    }

    // Reset Button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentUploadedUrl = null;
            
            // Reset Preview
            const previewImg = document.getElementById('preview-image');
            const uploadPlaceholder = document.querySelector('.upload-placeholder');
            if (previewImg) {
                previewImg.src = "";
                previewImg.classList.add('hidden');
            }
            if (uploadPlaceholder) uploadPlaceholder.classList.remove('hidden');
            if (fileInput) fileInput.value = "";
            
            // Reset Result
            const resultImg = document.getElementById('result-final');
            const resultPlaceholder = document.querySelector('.result-placeholder');
            const resultContainer = document.getElementById('result-container');
            
            if (resultImg) {
                resultImg.classList.add('hidden');
                resultImg.src = "";
            }
            if (resultPlaceholder) resultPlaceholder.classList.remove('hidden');
            if (resultContainer) resultContainer.classList.add('hidden'); // Ensure container hides if logic requires
            
            // Reset Buttons
            if (downloadBtn) {
                downloadBtn.classList.add('disabled');
                downloadBtn.style.display = 'none'; // Or inline-flex based on CSS, keeping logic consistent
            }
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.classList.add('disabled');
                generateBtn.textContent = 'Generate';
            }
            
            hideLoading();
        });
    }

    // ROBUST DOWNLOAD BUTTON LOGIC
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = downloadBtn.dataset.url;
            if (!url) return;
            
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.disabled = true;
            
            function downloadBlob(blob, filename) {
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }
            
            function getExtension(url, contentType) {
                if (contentType) {
                    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
                    if (contentType.includes('png')) return 'png';
                    if (contentType.includes('webp')) return 'webp';
                }
                const match = url.match(/\.(jpe?g|png|webp)/i);
                return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
            }
            
            try {
                // Strategy 1: ChromaStudio Proxy
                const proxyUrl = 'https://api.chromastudio.ai/download-proxy?url=' + encodeURIComponent(url);
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Proxy failed');
                
                const blob = await response.blob();
                const ext = getExtension(url, response.headers.get('content-type'));
                downloadBlob(blob, 'stencil_art_' + generateNanoId(8) + '.' + ext);
                
            } catch (proxyErr) {
                console.warn('Proxy download failed, trying direct:', proxyErr.message);
                
                // Strategy 2: Direct Fetch
                try {
                    const fetchUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
                    const response = await fetch(fetchUrl, { mode: 'cors' });
                    if (response.ok) {
                        const blob = await response.blob();
                        const ext = getExtension(url, response.headers.get('content-type'));
                        downloadBlob(blob, 'stencil_art_' + generateNanoId(8) + '.' + ext);
                        return;
                    }
                    throw new Error('Direct fetch failed');
                } catch (fetchErr) {
                    console.warn('Direct fetch failed:', fetchErr.message);
                    
                    // Strategy 3: Canvas Fallback
                    const img = document.getElementById('result-final');
                    
                    function tryCanvasWithCORS() {
                        const tempImg = new Image();
                        tempImg.crossOrigin = 'anonymous';
                        tempImg.onload = function() {
                            const canvas = document.createElement('canvas');
                            canvas.width = tempImg.naturalWidth;
                            canvas.height = tempImg.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(tempImg, 0, 0);
                            canvas.toBlob((blob) => {
                                if (blob) {
                                    downloadBlob(blob, 'stencil_art_' + generateNanoId(8) + '.png');
                                } else {
                                    forceDownloadLink();
                                }
                            }, 'image/png');
                        };
                        tempImg.onerror = forceDownloadLink;
                        tempImg.src = url + '?crossorigin=' + Date.now();
                    }

                    function forceDownloadLink() {
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'stencil_art_' + generateNanoId(8) + '.png';
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }
                    
                    if (img && img.complete && img.naturalWidth > 0) {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth;
                            canvas.height = img.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            canvas.toBlob((blob) => {
                                if (blob) downloadBlob(blob, 'stencil_art_' + generateNanoId(8) + '.png');
                                else tryCanvasWithCORS();
                            }, 'image/png');
                        } catch (e) { tryCanvasWithCORS(); }
                    } else {
                        tryCanvasWithCORS();
                    }
                }
            } finally {
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
        });
    }
});