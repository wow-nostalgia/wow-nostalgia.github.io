$(function () {
  const $container = $(".info-tabs");
  const $blocks = $container.find(".collapsible");

  // Спочатку видаляємо клас open у всіх
  $blocks.removeClass("open");
  // Потім додаємо лише першому
  $blocks.first().addClass("open");

  // Обробка кліку
  $blocks.children(".heading").on("click", function () {
    $blocks.removeClass("open");
    $(this).parent(".collapsible").addClass("open");
  });
});