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

const UNSAVED_WARNING = "Вы что-то напечатали в форме. Все введенные данные будут потеряны при закрытии страницы.";

window.setupFormWithSpinner = function(options) {
  const startSpinner = ($form) => {
    const spinner = $("<i class='icon-spin spinner' style='margin-left: 0.5em'>");
    $form.find(".form-actions .btn").last().after(spinner);
  };

  $script.ready("plugins", function() {
    $(function() {
      const $form = $(options.formSelector);
      const $textarea = $(options.textareaSelector);
      let submitted = false;

      const warnOnUnload = (e) => {
        if ($textarea.val() !== '' && !submitted) {
          e.preventDefault();
          e.returnValue = UNSAVED_WARNING;
          return e.returnValue;
        }
      };

      window.addEventListener('beforeunload', warnOnUnload);

      let clickedButton = null;
      $form.find(".form-actions button[type=submit]").on('click', function() {
        clickedButton = this;
      });

      const validateOpts = {
        ...options.validateOptions,
        submitHandler: (form) => {
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
      };

      $form.validate(validateOpts);
    });
  });
};

$script.ready('jquery', function() {
  'use strict';

  if (window._formWithSpinnerActive) {
    return;
  }

  $(function() {
    const commentForm = $("#commentForm");
    if (!commentForm.length) {
      return;
    }

    const getCookie = (name) => {
      const cookies = Object.fromEntries(
        document.cookie.split('; ').map(c => {
          const [key, ...val] = c.split('=');
          return [key, val.join('=')];
        })
      );
      return cookies[name] ?? null;
    };

    const startSpinner = ($form) => {
      const spinner = $("<i class='icon-spin spinner' style='margin-left: 0.5em'>");
      $form.find(".form-actions .btn").last().after(spinner);
    };

    const stopSpinner = ($form) => {
      $form.find(".spinner").remove();
    };

    const clearErrors = ($form) => {
      $form.find("div[error]").remove();
    };

    const scrollToPreview = ($preview) => {
      $preview.show();

      const scrollTop = $(window).scrollTop();
      const viewportBottom = scrollTop + window.innerHeight;
      const previewTop = $preview.offset().top;

      if (previewTop < scrollTop || previewTop > viewportBottom) {
        $('html,body').animate({scrollTop: previewTop - window.innerHeight / 3}, 500);
      }
    };

    commentForm.append($('<div id="commentPreview">').hide());
    const commentPreview = $('#commentPreview');
    const commentFormContainer = commentForm.parent();
    const isInline = commentFormContainer.is(':hidden');

    const csrf = (getCookie("CSRF_TOKEN") || '').replace(/(^")|("$)/g, "");

    let captchaLoaded = false;
    let captchaRendered = false;

    const loadCaptcha = () => {
      const lazyCaptcha = commentFormContainer.find('[data-lazy-captcha]')[0];
      if (!lazyCaptcha || captchaLoaded) {
        return;
      }

      captchaLoaded = true;
      const sitekey = lazyCaptcha.getAttribute('data-sitekey');
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        if (typeof hcaptcha !== 'undefined' && !captchaRendered) {
          hcaptcha.render(lazyCaptcha, {sitekey: sitekey});
          captchaRendered = true;
          lazyCaptcha.removeAttribute('data-lazy-captcha');
        }
      };
      document.head.appendChild(script);
    };

    const resetCaptcha = () => {
      if (captchaRendered && typeof hcaptcha !== 'undefined') {
        hcaptcha.reset?.();
      }
    };

    const updateCsrf = () => {
      if (csrf) {
        $("input[name='csrf']", commentForm).val(csrf);
      }
    };

    if (isInline) {
      const updateAuthorReadonlyNote = (authorReadonly) => {
        $('#author-readonly-note').text(
          authorReadonly
            ? "Внимание! Вы отвечаете на комментарий, автора которого не может создавать новые комментарии в этом топике."
            : ""
        );
      };

      const REPLY_TYPE = 1;
      const TOPIC_TYPE = 0;

      const moveAndShowForm = (selector, replyToValue) => {
        const replyTo = $("input[name='replyto']", commentFormContainer);
        if (replyTo.val() !== String(replyToValue)) {
          commentFormContainer.hide();
        }

        if (commentFormContainer.is(':hidden')) {
          const reply = $('div.reply', $('div.msg_body', $(selector)));
          reply.after(commentFormContainer);
          replyTo.val(replyToValue);
          loadCaptcha();
          commentFormContainer.slideDown('slow', () => {
            const formTop = commentFormContainer.offset().top;
            const formHeight = commentFormContainer.outerHeight();
            const viewportHeight = window.innerHeight;

            const formBottom = formTop + formHeight;
            const currentScrollTop = $(window).scrollTop();
            const currentViewportBottom = currentScrollTop + viewportHeight;

            let needsScroll;

            if (formHeight <= viewportHeight) {
              needsScroll = formTop < currentScrollTop || formBottom + 32 > currentViewportBottom;
            } else {
              const msgTop = $("#msg").offset().top;
              needsScroll = msgTop < currentScrollTop || msgTop > currentViewportBottom;
            }

            if (needsScroll) {
              let targetScrollTop;
              if (formHeight <= viewportHeight) {
                targetScrollTop = formBottom - viewportHeight + 32;
              } else {
                targetScrollTop = formTop - 16;
              }
              targetScrollTop = Math.max(0, targetScrollTop);

              $('html,body').animate({scrollTop: targetScrollTop}, 300, () => {
                $("#msg").focus();
              });
            } else {
              $("#msg").focus();
            }
          });
        } else {
          commentFormContainer.slideUp('slow');
        }
      };

      const toggleCommentForm = (type, id, authorReadonly) => {
        updateCsrf();
        updateAuthorReadonlyNote(authorReadonly);

        if (type === REPLY_TYPE) {
          moveAndShowForm(`#comment-${id}`, id);
        } else if (type === TOPIC_TYPE) {
          const topicId = $("input[name='topic']", commentFormContainer).val();
          moveAndShowForm(`#topic-${topicId}`, 0);
        }
      };

      $('div.reply').each((_i, container) => {
        $('a[href^="comment-message.jsp"]', container).on("click", (e) => {
          e.preventDefault();
          toggleCommentForm(TOPIC_TYPE, 0, false);
        });

        const lnk = $('a[href^="add_comment.jsp"]', container);
        if (lnk.length > 0) {
          const ids = lnk.attr('href').match(/\d+/g);
          const commentId = ids[1];
          lnk.on("click", (e) => {
            e.preventDefault();
            toggleCommentForm(REPLY_TYPE, commentId, lnk.attr('data-author-readonly') === "true");
          });
        }
      });
    } else {
      loadCaptcha();
      updateCsrf();
    }

    const warnOnUnloadComment = (e) => {
      const hasContent = $("#msg").val() !== '';
      const isVisible = isInline ? !commentFormContainer.is(":hidden") : true;
      if (hasContent && isVisible) {
        e.preventDefault();
        e.returnValue = UNSAVED_WARNING;
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', warnOnUnloadComment);

    if (isInline) {
      commentForm.on("reset", () => {
        commentFormContainer.slideUp('slow');
        commentPreview.hide().empty();
      });
    } else {
      commentForm.on("reset", () => {
        commentPreview.hide().empty();
      });
    }

    const previewButton = commentForm.find("button[name=preview]");
    previewButton.attr("type", "button");

    const displayPreview = (data) => {
      commentPreview.html('<h2>Предпросмотр</h2>' + data.preview);

      $script.ready('hljs', function() {
        $('pre code', commentPreview).each((_i, block) => {
          hljs.highlightBlock(block);
        });
      });

      if (data.errors) {
        const errors = $('<div class="error">');
        data.errors.forEach((v) => {
          errors.append($("<span>").text(v));
          errors.append($("<br>"));
        });
        commentPreview.prepend(errors);
        resetCaptcha();
      }

      scrollToPreview(commentPreview);
    };

    const ajaxError = (jqXHR, textStatus, errorThrown) => {
      commentPreview.empty().append(
        $('<div class="error">')
          .text(`Не удалось выполнить запрос, попробуйте повторить еще раз. ${errorThrown}`)
      );
      resetCaptcha();
      scrollToPreview(commentPreview);
    };

    previewButton.on("click", () => {
      previewButton.prop("disabled", true);
      const form = commentForm.serialize() + "&preview=preview";

      startSpinner(commentForm);
      clearErrors(commentForm);

      $.ajax({
        method: "POST",
        url: "/add_comment_ajax",
        data: form,
        timeout: 10000
      }).always(() => {
        previewButton.prop("disabled", false);
        stopSpinner(commentForm);
      }).fail(ajaxError).done(displayPreview);
    });

    let submitInProcess = false;

    commentForm.on("submit", (e) => {
      e.preventDefault();

      if (submitInProcess) {
        return;
      }

      submitInProcess = true;
      window._commentSubmitting = true;
      window.removeEventListener('beforeunload', warnOnUnloadComment);

      const form = commentForm.serialize();

      startSpinner(commentForm);
      clearErrors(commentForm);

      $.ajax({
        method: "POST",
        url: "/add_comment_ajax",
        data: form,
        timeout: 30000
      }).always(() => {
        submitInProcess = false;
        stopSpinner(commentForm);
      }).fail((jqXHR, textStatus, errorThrown) => {
        window._commentSubmitting = false;
        window.addEventListener('beforeunload', warnOnUnloadComment);
        ajaxError(jqXHR, textStatus, errorThrown);
      }).done((data) => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          window._commentSubmitting = false;
          window.addEventListener('beforeunload', warnOnUnloadComment);
          displayPreview(data);
        }
      });
    });
  });
});