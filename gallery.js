'use strict';

(function initializeGalleryCursor() {
  document.addEventListener('DOMContentLoaded', () => {
    const cursorLabelElement = document.getElementById('cursor-label');
    if (!cursorLabelElement) return;

    // follow mouse globally
    const onMouseMove = (event) => {
      cursorLabelElement.style.left = `${event.clientX}px`;
      cursorLabelElement.style.top  = `${event.clientY}px`;
    };
    (window.Utils && Utils.on ? Utils.on(document, 'mousemove', onMouseMove, { passive: true }) : document.addEventListener('mousemove', onMouseMove, { passive: true }));

    // show/hide and set text based on hovered gallery item
    const galleryItems = (window.Utils && Utils.qsa) ? Utils.qsa('.gallery-item') : document.querySelectorAll('.gallery-item');
    galleryItems.forEach((galleryItem) => {
      const enter = () => {
        const text = galleryItem.dataset.cursor || '';
        cursorLabelElement.textContent = text;
        cursorLabelElement.style.opacity = text ? '1' : '0';
      };
      const leave = () => {
        cursorLabelElement.style.opacity = '0';
      };
      const move = (event) => {
        // minor offset to avoid overlapping pointer
        cursorLabelElement.style.left = `${event.clientX + 12}px`;
        cursorLabelElement.style.top  = `${event.clientY + 8}px`;
      };
      (window.Utils && Utils.on ? Utils.on(galleryItem, 'mouseenter', enter) : galleryItem.addEventListener('mouseenter', enter));
      (window.Utils && Utils.on ? Utils.on(galleryItem, 'mouseleave', leave) : galleryItem.addEventListener('mouseleave', leave));
      (window.Utils && Utils.on ? Utils.on(galleryItem, 'mousemove', move, { passive: true }) : galleryItem.addEventListener('mousemove', move, { passive: true }));
    });
  });
})();


