/*
 * Copyright 1998-2026 Linux.org.ru
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

window.setupFormWithSpinner = function(options) {
  function startSpinner($form) {
    const spinner = $("<i class='icon-spin spinner' style='margin-left: 0.5em'>");
    $form.find(".form-actions .btn").last().after(spinner);
  }

  $script.ready("plugins", function() {
    $(function() {
      const $form = $(options.formSelector);
      const $textarea = $(options.textareaSelector);
      let submitted = false;

      function warnOnUnload(e) {
        if ($textarea.val() !== '' && !submitted) {
          e.returnValue = "Вы что-то напечатали в форме. Все введенные данные будут потеряны при закрытии страницы.";
          return e.returnValue;
        }
      }

      window.addEventListener('beforeunload', warnOnUnload);

      let clickedButton = null;
      $form.find(".form-actions button[type=submit]").on('click', function() {
        clickedButton = this;
      });

      const validateOpts = $.extend({}, options.validateOptions, {
        submitHandler: function(form) {
          if (submitted) { return; }
          submitted = true;
          window.removeEventListener('beforeunload', warnOnUnload);

          if (clickedButton && clickedButton.name) {
            $(form).append($('<input>').attr({
              type: 'hidden', name: clickedButton.name, value: $(clickedButton).val() || clickedButton.name
            }));
          }

          startSpinner($form);
          $form.find(".form-actions button").prop("disabled", true);
          form.submit();
        }
      });

      $form.validate(validateOpts);
    });
  });
};

$script.ready(['jquery', 'hljs'], function() {
  'use strict';

  if (window._formWithSpinnerActive) {
    return;
  }

  $(function() {
  var commentForm = $("#commentForm");
  if (!commentForm.length) {
    return;
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return match ? match[2] : null;
  }

  function startSpinner($form) {
    var spinner = $("<i class='icon-spin spinner' style='margin-left: 0.5em'>");
    $form.find(".form-actions .btn").last().after(spinner);
  }

  function stopSpinner($form) {
    $form.find(".spinner").remove();
  }

  function clearErrors($form) {
    $form.find("div[error]").remove();
  }

  function scrollToPreview($preview) {
    $preview.show();

    var scrollTop = $(window).scrollTop();
    var viewportBottom = scrollTop + window.innerHeight;
    var previewTop = $preview.offset().top;

    if (previewTop < scrollTop || previewTop > viewportBottom) {
      $('html,body').animate({scrollTop: previewTop - window.innerHeight / 3}, 500);
    }
  }

  commentForm.append($('<div id="commentPreview">').hide());
  var commentPreview = $('#commentPreview');
  var commentFormContainer = commentForm.parent();

  var csrf = (getCookie("CSRF_TOKEN") || '').replace(/(^")|("$)/g, "");

  var captchaLoaded = false;
  var captchaRendered = false;

  function loadCaptcha() {
    var lazyCaptcha = commentFormContainer.find('[data-lazy-captcha]')[0];
    if (!lazyCaptcha || captchaLoaded) {
      return;
    }

    captchaLoaded = true;
    var sitekey = lazyCaptcha.getAttribute('data-sitekey');
    var script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    script.async = true;
    script.onload = function() {
      if (typeof hcaptcha !== 'undefined' && !captchaRendered) {
        hcaptcha.render(lazyCaptcha, {sitekey: sitekey});
        captchaRendered = true;
        lazyCaptcha.removeAttribute('data-lazy-captcha');
      }
    };
    document.head.appendChild(script);
  }

  function resetCaptcha() {
    if (captchaRendered && typeof hcaptcha !== 'undefined') {
      try { hcaptcha.reset(); } catch(e) { /* ignore */ }
    }
  }

  function updateCsrf() {
    if (csrf) {
      $("input[name='csrf']", commentForm).val(csrf);
    }
  }

  function updateAuthorReadonlyNote(authorReadonly) {
    $('#author-readonly-note').text(
      authorReadonly
        ? "Внимание! Вы отвечаете на комментарий, автора которого не может создавать новые комментарии в этом топике."
        : ""
    );
  }

  var REPLY_TYPE = 1;
  var TOPIC_TYPE = 0;

  function moveAndShowForm(selector, replyToValue) {
    var replyTo = $("input[name='replyto']", commentFormContainer);
    if (replyTo.val() !== String(replyToValue)) {
      commentFormContainer.hide();
    }

    if (commentFormContainer.is(':hidden')) {
      var reply = $('div.reply', $('div.msg_body', $(selector)));
      reply.after(commentFormContainer);
      replyTo.val(replyToValue);
      loadCaptcha();
      commentFormContainer.slideDown('slow', function() {
        var formTop = commentFormContainer.offset().top;
        var formHeight = commentFormContainer.outerHeight();
        var viewportHeight = window.innerHeight;

        var formBottom = formTop + formHeight;
        var currentScrollTop = $(window).scrollTop();
        var currentViewportBottom = currentScrollTop + viewportHeight;

        var needsScroll;

        if (formHeight <= viewportHeight) {
          needsScroll = formTop < currentScrollTop || formBottom + 32 > currentViewportBottom;
        } else {
          var msgTop = $("#msg").offset().top;
          needsScroll = msgTop < currentScrollTop || msgTop > currentViewportBottom;
        }

        if (needsScroll) {
          var targetScrollTop;
          if (formHeight <= viewportHeight) {
            targetScrollTop = formBottom - viewportHeight + 32;
          } else {
            targetScrollTop = formTop - 16;
          }
          targetScrollTop = Math.max(0, targetScrollTop);

          $('html,body').animate({scrollTop: targetScrollTop}, 300, function() {
            $("#msg").focus();
          });
        } else {
          $("#msg").focus();
        }
      });
    } else {
      commentFormContainer.slideUp('slow');
    }
  }

  function toggleCommentForm(type, id, authorReadonly) {
    updateCsrf();
    updateAuthorReadonlyNote(authorReadonly);

    if (type === REPLY_TYPE) {
      moveAndShowForm('#comment-' + id, id);
    } else if (type === TOPIC_TYPE) {
      var topicId = $("input[name='topic']", commentFormContainer).val();
      moveAndShowForm('#topic-' + topicId, 0);
    }
  }

  $('div.reply').each(function() {
    var container = this;

    $('a[href^="comment-message.jsp"]', container).on("click", function(e) {
      e.preventDefault();
      toggleCommentForm(TOPIC_TYPE, 0, false);
    });

    var lnk = $('a[href^="add_comment.jsp"]', container);
    if (lnk.length > 0) {
      var ids = lnk.attr('href').match(/\d+/g);
      var commentId = ids[1];
      lnk.on("click", function(e) {
        e.preventDefault();
        toggleCommentForm(REPLY_TYPE, commentId, lnk.attr('data-author-readonly') === "true");
      });
    }
  });

  function warnOnUnloadComment(e) {
    if ($("#msg").val() !== '' && !commentFormContainer.is(":hidden")) {
      e.returnValue = "Вы что-то напечатали в форме. Все введенные данные будут потеряны при закрытии страницы.";
      return e.returnValue;
    }
  }

  window.addEventListener('beforeunload', warnOnUnloadComment);

  commentForm.on("reset", function() {
    commentFormContainer.slideUp('slow');
    commentPreview.hide().empty();
  });

  var previewButton = commentForm.find("button[name=preview]");
  previewButton.attr("type", "button");

  function displayPreview(data) {
    commentPreview.html('<h2>Предпросмотр</h2>' + data['preview']);
    $('pre code', commentPreview).each(function(_i, block) {
      hljs.highlightBlock(block);
    });

    if (data['errors']) {
      var errors = $('<div class="error">');
      $.each(data['errors'], function(_idx, v) {
        errors.append($("<span>").text(v));
        errors.append($("<br>"));
      });
      commentPreview.prepend(errors);
      resetCaptcha();
    }

    scrollToPreview(commentPreview);
  }

  function ajaxError(jqXHR, textStatus, errorThrown) {
    commentPreview.empty().append(
      $('<div class="error">')
        .text("Не удалось выполнить запрос, попробуйте повторить еще раз. " + errorThrown)
    );
    resetCaptcha();
    scrollToPreview(commentPreview);
  }

  previewButton.on("click", function() {
    previewButton.prop("disabled", true);
    var form = commentForm.serialize() + "&preview=preview";

    startSpinner(commentForm);
    clearErrors(commentForm);

    $.ajax({
      method: "POST",
      url: "/add_comment_ajax",
      data: form,
      timeout: 10000
    }).always(function() {
      previewButton.prop("disabled", false);
      stopSpinner(commentForm);
    }).fail(ajaxError).done(displayPreview);
  });

  var submitInProcess = false;

  commentForm.on("submit", function(e) {
    e.preventDefault();

    if (submitInProcess) {
      return;
    }

    submitInProcess = true;
    window._commentSubmitting = true;
    window.removeEventListener('beforeunload', warnOnUnloadComment);

    var form = commentForm.serialize();

    startSpinner(commentForm);
    clearErrors(commentForm);

    $.ajax({
      method: "POST",
      url: "/add_comment_ajax",
      data: form,
      timeout: 30000
    }).always(function() {
      submitInProcess = false;
      stopSpinner(commentForm);
    }).fail(function() {
      window._commentSubmitting = false;
      window.addEventListener('beforeunload', warnOnUnloadComment);
      ajaxError.apply(this, arguments);
    }).done(function(data) {
      if (data['url']) {
        window.location.href = data['url'];
      } else {
        window._commentSubmitting = false;
        window.addEventListener('beforeunload', warnOnUnloadComment);
        displayPreview(data);
      }
    });
  });
  });
});