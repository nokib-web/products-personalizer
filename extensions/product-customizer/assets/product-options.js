class ProductOptions {
  constructor(container) {
    this.container = container;
    this.shop = container.dataset.shop;
    this.productId = container.dataset.productId;
    this.basePrice = parseFloat(container.dataset.basePrice) || 0;
    
    // Attempt to extract collections and tags
    this.collections = container.dataset.productCollections ? container.dataset.productCollections.split(',').filter(Boolean) : [];
    this.tags = container.dataset.productTags ? container.dataset.productTags.split(',').map(t => t.trim()).filter(Boolean) : [];
    this.vendor = container.dataset.productVendor;
    
    this.optionsContainer = container.querySelector('#pxl-options-container');
    this.priceSummary = container.querySelector('#pxl-options-price-summary');
    this.optionsPriceDisplay = container.querySelector('#pxl-options-price-display');
    this.finalPriceDisplay = container.querySelector('#pxl-final-price-display');
    
    this.currencySymbol = container.dataset.currencySymbol || '$';
    
    this.state = {};
    
    this.init();
  }
  
  async init() {
    try {
      // Build query string
      const params = new URLSearchParams({
        shop: this.shop,
        productId: this.productId,
        vendor: this.vendor
      });
      
      this.collections.forEach(c => params.append('collection', c));
      this.tags.forEach(t => params.append('tag', t));
      
      // The App Proxy is configured with subpath 'customizer'
      const response = await fetch(`/apps/customizer/options?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load options');
      
      const data = await response.json();
      
      if (!data.optionSets || data.optionSets.length === 0) {
        this.optionsContainer.innerHTML = '';
        return;
      }
      
      this.renderOptions(data.optionSets);
      this.attachEventListeners();
    } catch (e) {
      console.error('[Products Personalizer] Error initializing:', e);
      this.optionsContainer.innerHTML = '<p class="pxl-error">Could not load personalization options.</p>';
    }
  }
  
  renderOptions(optionSets) {
    this.optionsContainer.innerHTML = '';
    
    optionSets.forEach(set => {
      set.options.forEach(option => {
        const wrapper = document.createElement('div');
        wrapper.className = 'pxl-option-wrapper';
        wrapper.dataset.optionId = option.id;
        
        let settings = {};
        try { settings = JSON.parse(option.settings); } catch (e) {}
        
        let labelHtml = `<label class="pxl-option-label" for="pxl-opt-${option.id}">
          <span>${option.label} ${option.required ? '<span class="pxl-option-required">*</span>' : ''}</span>
        </label>`;
        
        let helpTextHtml = option.helpText ? `<div class="pxl-help-text">${option.helpText}</div>` : '';
        
        let inputHtml = '';
        
        switch (option.type) {
          case 'TEXT':
            inputHtml = `<input type="text" id="pxl-opt-${option.id}" name="properties[${option.name}]" class="pxl-input-text" ${option.required ? 'required' : ''}>`;
            break;
          case 'TEXTAREA':
            inputHtml = `<textarea id="pxl-opt-${option.id}" name="properties[${option.name}]" class="pxl-input-textarea" ${option.required ? 'required' : ''}></textarea>`;
            break;
          case 'DROPDOWN':
            // Fallback for missing settings until we build the admin UI for it
            const choices = settings.choices || ['Option 1', 'Option 2'];
            inputHtml = `<select id="pxl-opt-${option.id}" name="properties[${option.name}]" class="pxl-input-select" ${option.required ? 'required' : ''}>
              <option value="">Select an option...</option>
              ${choices.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>`;
            break;
          case 'COLOR_SWATCH':
            const colors = settings.colors || ['#ff0000', '#00ff00', '#0000ff'];
            inputHtml = `<div class="pxl-swatch-container">
              ${colors.map(c => `
                <div class="pxl-swatch" style="background-color: ${c}" data-value="${c}"></div>
              `).join('')}
              <input type="hidden" id="pxl-opt-${option.id}" name="properties[${option.name}]" ${option.required ? 'required' : ''}>
            </div>`;
            break;
          case 'FILE_UPLOAD':
            inputHtml = `<div class="pxl-file-upload">
              <label for="pxl-opt-${option.id}" class="pxl-file-upload-label">Click to upload a file</label>
              <input type="file" id="pxl-opt-${option.id}" name="properties[${option.name}]" ${option.required ? 'required' : ''}>
            </div>`;
            break;
          default:
            inputHtml = `<input type="text" id="pxl-opt-${option.id}" name="properties[${option.name}]" class="pxl-input-text">`;
        }
        
        wrapper.innerHTML = labelHtml + helpTextHtml + inputHtml;
        this.optionsContainer.appendChild(wrapper);
        
        // Handle swatches
        if (option.type === 'COLOR_SWATCH') {
          const swatches = wrapper.querySelectorAll('.pxl-swatch');
          const hiddenInput = wrapper.querySelector('input[type="hidden"]');
          swatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
              swatches.forEach(s => s.classList.remove('pxl-swatch-selected'));
              swatch.classList.add('pxl-swatch-selected');
              hiddenInput.value = swatch.dataset.value;
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            });
          });
        }
        
        // Handle file uploads
        if (option.type === 'FILE_UPLOAD') {
          const fileInput = wrapper.querySelector('input[type="file"]');
          const fileLabel = wrapper.querySelector('.pxl-file-upload-label');
          if (fileInput && fileLabel) {
            fileInput.addEventListener('change', (e) => {
              if (e.target.files && e.target.files.length > 0) {
                fileLabel.textContent = 'File selected: ' + e.target.files[0].name;
              } else {
                fileLabel.textContent = 'Click to upload a file';
              }
            });
          }
        }
      });
    });
    
    // Inject inputs inside the closest form with action="/cart/add"
    const form = this.container.closest('form[action^="/cart/add"]') || document.querySelector('form[action^="/cart/add"]');
    if (form) {
      // Append our container to the form if it's not already inside
      if (!form.contains(this.container)) {
        // Find add to cart button and insert before it
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
          submitBtn.parentNode.insertBefore(this.container, submitBtn);
        } else {
          form.appendChild(this.container);
        }
      }
    }
    
    this.priceSummary.style.display = 'block';
    this.updatePrice();
  }
  
  attachEventListeners() {
    this.optionsContainer.addEventListener('change', (e) => {
      // Handle pricing updates and conditional logic here in the future
      this.updatePrice();
    });
  }
  
  updatePrice() {
    // Basic price update logic (will be expanded for complex rules)
    let optionsTotal = 0; // Currently 0, would calculate based on selected options and pricing rules
    
    const finalPrice = this.basePrice + optionsTotal;
    
    this.optionsPriceDisplay.innerText = `+ ${this.currencySymbol}${(optionsTotal / 100).toFixed(2)}`;
    this.finalPriceDisplay.innerText = `${this.currencySymbol}${(finalPrice / 100).toFixed(2)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.pxl-product-options-root').forEach(container => {
    new ProductOptions(container);
  });
});

// Support for Shopify Theme Editor
document.addEventListener('shopify:section:load', (event) => {
  const container = event.target.querySelector('.pxl-product-options-root');
  if (container) new ProductOptions(container);
});

document.addEventListener('shopify:block:select', (event) => {
  const container = event.target.closest('.pxl-product-options-root') || event.target.querySelector('.pxl-product-options-root');
  if (container && !container.dataset.initialized) {
    container.dataset.initialized = 'true';
    new ProductOptions(container);
  }
});
