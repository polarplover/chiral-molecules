// Preserve the project's conventional ?chapter=chirality share URL.
if (new URLSearchParams(location.search).get('chapter') === 'chirality') {
  location.replace(new URL('./chirality.html', location.href));
}
