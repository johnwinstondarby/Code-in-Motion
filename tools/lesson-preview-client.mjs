const status = document.getElementById('preview-error');
try {
  const response = await fetch('/lesson.json', { cache: 'no-store' });
  const data = await response.json();
  status.textContent = response.ok ? 'Validation passed. Save and refresh to see edits.' : data.error;
} catch (error) { status.textContent = error.message; }
