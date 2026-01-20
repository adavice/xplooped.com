document.addEventListener("DOMContentLoaded", function () {
    initCustomCursor();
// Custom Cursor Implementation
function initCustomCursor() {
  // Create cursor elements
  const cursorDot = document.createElement('div');
  cursorDot.className = 'custom-cursor';
  document.body.appendChild(cursorDot);

  const cursorCircle = document.createElement('div');
  cursorCircle.className = 'custom-cursor-circle';
  document.body.appendChild(cursorCircle);

  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  let circleX = 0, circleY = 0;

  // Track mouse position
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Smooth animation for cursor
  function animate() {
    // Dot follows immediately
    cursorX = mouseX;
    cursorY = mouseY;
    cursorDot.style.left = cursorX + 'px';
    cursorDot.style.top = cursorY + 'px';

    // Circle follows with slight delay for smooth effect
    circleX += (mouseX - circleX) * 0.15;
    circleY += (mouseY - circleY) * 0.15;
    cursorCircle.style.left = circleX + 'px';
    cursorCircle.style.top = circleY + 'px';

    requestAnimationFrame(animate);
  }
  animate();

  // Add hover effects for interactive elements
  const interactiveElements = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [onclick]');
  
  interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('cursor-hover');
    });
    
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('cursor-hover');
    });
  });

  // Add click effect
  document.addEventListener('mousedown', () => {
    document.body.classList.add('cursor-click');
  });

  document.addEventListener('mouseup', () => {
    document.body.classList.remove('cursor-click');
  });

  // Text selection cursor effect
  const textElements = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, li');
  textElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      document.body.classList.add('cursor-text');
    });
    
    el.addEventListener('mouseleave', () => {
      document.body.classList.remove('cursor-text');
    });
  });
}
});