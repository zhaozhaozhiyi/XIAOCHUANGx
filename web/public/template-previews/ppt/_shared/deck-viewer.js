(function () {
  const slides = Array.from(document.querySelectorAll(".slide"));
  let index = 0;

  function show(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((el, n) => {
      el.hidden = n !== index;
    });
    const badge = document.getElementById("page-badge");
    if (badge) badge.textContent = `${index + 1} / ${slides.length}`;
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data === "preview-next") show(index + 1);
    if (data === "preview-prev") show(index - 1);
    if (data === "preview-first") show(0);
    if (typeof data === "object" && data?.type === "preview-goto") {
      show(Number(data.page) || 0);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") show(index + 1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") show(index - 1);
  });

  show(0);
})();
