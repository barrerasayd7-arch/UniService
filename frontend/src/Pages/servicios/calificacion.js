// ═══════════════════════════════════════════
// calificacion.js - Modal flotante de calificación
// ═══════════════════════════════════════════

class RatingModal {
  constructor() {
    this.selectedRating = 0;
    this.selectedAspects = [];
    this.currentProduct = null;
    this.init();
  }

  init() {
    this.createModal();
    this.attachEventListeners();
  }

  createModal() {
    const modalHTML = `
      <!-- Modal Overlay -->
      <div class="rating-modal-overlay" id="ratingModalOverlay">
        <!-- Modal -->
        <div class="rating-modal" id="ratingModal">
          <!-- Header -->
          <div class="rating-modal-header">
            <h2 class="rating-modal-title">⭐ Calificar Servicio</h2>
            <button class="rating-modal-close" id="closeRatingModal">✕</button>
          </div>

          <!-- Product Info -->
          <div class="rating-product-info" id="productInfo">
            <div class="rating-product-icon">🎯</div>
            <div class="rating-product-details">
              <h4 id="productTitle">Servicio Seleccionado</h4>
              <p id="productProvider">Proveedor del servicio</p>
            </div>
          </div>

          <!-- Rating Form -->
          <div id="ratingForm">
            <!-- Stars Rating -->
            <div class="rating-stars-section">
              <label class="rating-stars-label">¿Cuántas estrellas merece este servicio?</label>
              <div class="rating-stars-container" id="starsContainer">
                <button class="rating-star" data-value="1" title="Muy malo">★</button>
                <button class="rating-star" data-value="2" title="Malo">★</button>
                <button class="rating-star" data-value="3" title="Regular">★</button>
                <button class="rating-star" data-value="4" title="Bueno">★</button>
                <button class="rating-star" data-value="5" title="Excelente">★</button>
              </div>
              <div class="rating-value" id="ratingValue">Selecciona una calificación</div>
            </div>

            <!-- Aspects -->
            <div class="rating-aspects">
              <label class="rating-aspects-label">¿Qué aspectos destacas?</label>
              <div class="rating-aspects-grid" id="aspectsGrid">
                <button class="rating-aspect-btn" data-aspect="puntualidad">⏰ Puntualidad</button>
                <button class="rating-aspect-btn" data-aspect="calidad">🌟 Calidad</button>
                <button class="rating-aspect-btn" data-aspect="comunicacion">💬 Comunicación</button>
                <button class="rating-aspect-btn" data-aspect="precio">💰 Precio justo</button>
              </div>
            </div>

            <!-- Textarea -->
            <textarea 
              class="rating-textarea" 
              id="ratingComment" 
              placeholder="Cuéntanos cómo fue tu experiencia con este servicio..."
            ></textarea>

            <!-- Actions -->
            <div class="rating-actions">
              <button class="rating-btn rating-btn-submit" id="submitRating">📤 Enviar Calificación</button>
              <button class="rating-btn rating-btn-cancel" id="cancelRating">Cancelar</button>
            </div>
          </div>

          <!-- Success Message -->
          <div class="rating-success" id="successMessage">
            <div class="rating-success-icon">✓</div>
            <div class="rating-success-text">
              <h3>¡Gracias por tu calificación!</h3>
              <p>Tu opinión ayuda a otros estudiantes a tomar mejores decisiones</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Floating Button -->
      <button class="floating-rating-btn" id="floatingRatingBtn" title="Calificar un servicio">⭐</button>
    `;

    // Insertar modal al body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  attachEventListeners() {
    const floatingBtn = document.getElementById('floatingRatingBtn');
    const closeBtn = document.getElementById('closeRatingModal');
    const cancelBtn = document.getElementById('cancelRating');
    const overlay = document.getElementById('ratingModalOverlay');
    const submitBtn = document.getElementById('submitRating');
    const starsContainer = document.getElementById('starsContainer');
    const aspectsGrid = document.getElementById('aspectsGrid');

    // Abrir modal
    floatingBtn.addEventListener('click', () => this.openModal());

    // Cerrar modal
    closeBtn.addEventListener('click', () => this.closeModal());
    cancelBtn.addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });

    // Manejo de estrellas
    starsContainer.addEventListener('mouseover', (e) => {
      if (e.target.classList.contains('rating-star')) {
        const value = parseInt(e.target.dataset.value);
        this.hoverStars(value);
      }
    });

    starsContainer.addEventListener('mouseout', () => {
      this.updateStarsDisplay();
    });

    starsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('rating-star')) {
        this.selectedRating = parseInt(e.target.dataset.value);
        this.updateStarsDisplay();
        this.updateRatingValue();
      }
    });

    // Manejo de aspectos
    aspectsGrid.addEventListener('click', (e) => {
      if (e.target.classList.contains('rating-aspect-btn')) {
        const aspect = e.target.dataset.aspect;
        e.target.classList.toggle('selected');
        
        if (this.selectedAspects.includes(aspect)) {
          this.selectedAspects = this.selectedAspects.filter(a => a !== aspect);
        } else {
          this.selectedAspects.push(aspect);
        }
      }
    });

    // Enviar calificación
    submitBtn.addEventListener('click', () => this.submitRating());

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  }

  openModal(product = null) {
    const overlay = document.getElementById('ratingModalOverlay');
    const form = document.getElementById('ratingForm');
    const successMsg = document.getElementById('successMessage');

    // Mostrar overlay
    overlay.classList.add('active');
    
    // Resetear formulario
    this.resetForm();
    form.style.display = 'block';
    successMsg.classList.remove('show');

    // Llenar datos del producto (si existen)
    if (product) {
      this.currentProduct = product;
      document.getElementById('productTitle').textContent = product.title || 'Servicio Seleccionado';
      document.getElementById('productProvider').textContent = product.provider || 'Proveedor del servicio';
      document.getElementById('productInfo').querySelector('.rating-product-icon').textContent = product.icon || '🎯';
    }

    document.body.style.overflow = 'hidden';
  }

  closeModal() {
    const overlay = document.getElementById('ratingModalOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    this.resetForm();
  }

  resetForm() {
    this.selectedRating = 0;
    this.selectedAspects = [];
    document.getElementById('ratingComment').value = '';
    document.querySelectorAll('.rating-star').forEach(star => {
      star.classList.remove('active', 'hovered');
    });
    document.querySelectorAll('.rating-aspect-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
    this.updateRatingValue();
  }

  hoverStars(value) {
    document.querySelectorAll('.rating-star').forEach(star => {
      const starValue = parseInt(star.dataset.value);
      star.classList.remove('hovered');

      if (starValue <= value) {
        star.classList.add('hovered');
      }
    });
  }

  updateStarsDisplay() {
    document.querySelectorAll('.rating-star').forEach(star => {
      const starValue = parseInt(star.dataset.value);
      star.classList.remove('hovered');
      
      if (starValue <= this.selectedRating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  }

  updateRatingValue() {
    const valueEl = document.getElementById('ratingValue');
    
    if (this.selectedRating === 0) {
      valueEl.textContent = 'Selecciona una calificación';
      valueEl.style.background = 'linear-gradient(135deg, rgba(14, 165, 160, 0.2) 0%, rgba(245, 200, 66, 0.1) 100%)';
      valueEl.style.color = 'var(--texto2)';
    } else {
      const labels = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];
      const colors = ['', '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#10b981'];
      
      valueEl.textContent = `${this.selectedRating} - ${labels[this.selectedRating]}`;
      valueEl.style.color = colors[this.selectedRating];
      valueEl.style.background = `linear-gradient(135deg, rgba(14, 165, 160, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%)`;
    }
  }

  submitRating() {
    if (this.selectedRating === 0) {
      alert('Por favor selecciona una calificación');
      return;
    }

    const rating = {
      stars: this.selectedRating,
      aspects: this.selectedAspects,
      comment: document.getElementById('ratingComment').value,
      product: this.currentProduct,
      date: new Date().toLocaleDateString('es-ES'),
      timestamp: new Date().getTime()
    };

    // Guardar en localStorage
    let ratings = JSON.parse(localStorage.getItem('userRatings')) || [];
    ratings.push(rating);
    localStorage.setItem('userRatings', JSON.stringify(ratings));

    // Mostrar mensaje de éxito
    this.showSuccess();

    // Cerrar después de 2 segundos
    setTimeout(() => this.closeModal(), 2000);
  }

  showSuccess() {
    const form = document.getElementById('ratingForm');
    const successMsg = document.getElementById('successMessage');
    
    form.style.display = 'none';
    successMsg.classList.add('show');
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new RatingModal();
});

// Función para abrir modal desde otros lugares
function openRatingModal(product = null) {
  // Esta función permite abrir el modal desde otros componentes
  // Ejemplo: openRatingModal({ title: 'Mi Servicio', provider: 'Juan Pérez', icon: '🎨' })
  const overlay = document.getElementById('ratingModalOverlay');
  if (overlay && overlay.parentElement.querySelector('.rating-modal')) {
    const ratingInstance = {
      openModal: () => {
        const modalClass = document.querySelector('.rating-modal');
        if (modalClass) {
          overlay.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      }
    };
    
    if (product) {
      document.getElementById('productTitle').textContent = product.title || 'Servicio';
      document.getElementById('productProvider').textContent = product.provider || '';
    }
    
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}
