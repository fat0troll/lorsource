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

function getCsrf() {
  const cookies = Object.fromEntries(
    document.cookie.split('; ').map(c => {
      const [key, ...val] = c.split('=');
      return [key, val.join('=')];
    })
  );
  return (cookies["CSRF_TOKEN"] || '').replace(/(^")|("$)/g, "");
}

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

      initPreviewTabs($form[0], false);

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

function initPreviewTabs(formElement, hidePreviewButton) {
  const formatGroup = formElement.querySelector('[data-format-mode]');
  if (!formatGroup) return;

  const formatMode = formatGroup.dataset.formatMode;
  const textarea = formatGroup.querySelector('textarea');
  if (!textarea) return;

  const nav = formatGroup.querySelector('.markup-tabs__nav');
  if (!nav) return;

  const panelsContainer = formatGroup.querySelector('.markup-tabs__content');
  if (!panelsContainer) return;

  const editorTab = nav.querySelector('[data-tab="editor"]');
  if (!editorTab) return;

  const editorPanel = panelsContainer.querySelector('[data-panel="editor"]');
  if (!editorPanel) return;

  const previewTab = document.createElement('li');
  previewTab.className = 'markup-tabs__tab';
  previewTab.dataset.tab = 'preview';
  previewTab.textContent = 'Предпросмотр';
  nav.appendChild(previewTab);

  const previewPanel = document.createElement('div');
  previewPanel.className = 'markup-tabs__panel';
  previewPanel.dataset.panel = 'preview';
  const previewContent = document.createElement('div');
  previewContent.className = 'markup-preview';
  previewPanel.appendChild(previewContent);
  panelsContainer.appendChild(previewPanel);

  if (hidePreviewButton) {
    const previewButton = formElement.querySelector('button[name=preview]');
    if (previewButton) {
      previewButton.classList.add('preview-button-js-hidden');
    }
  }

  let textareaHeight = 0;

  const switchTab = (tabName) => {
    textareaHeight = textarea.offsetHeight;

    nav.querySelectorAll('.markup-tabs__tab').forEach(t => t.classList.remove('active'));
    panelsContainer.querySelectorAll('.markup-tabs__panel').forEach(p => p.classList.remove('active'));

    if (tabName === 'editor') {
      editorTab.classList.add('active');
      editorPanel.classList.add('active');
      previewContent.style.minHeight = '';
      textarea.focus();
    } else if (tabName === 'preview') {
      previewTab.classList.add('active');
      previewPanel.classList.add('active');
      previewContent.style.minHeight = Math.max(textareaHeight, 50) + 'px';
      loadPreview();
    }
  };

  const loadPreview = () => {
    const text = textarea.value;
    if (!text.trim()) {
      previewContent.textContent = '';
      return;
    }

    previewContent.textContent = 'Загрузка...';

    const formData = new URLSearchParams();
    formData.append('text', text);
    formData.append('markup', formatMode);
    const csrf = getCsrf();
    if (csrf) {
      formData.append('csrf', csrf);
    }

    fetch('/markup/preview', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: formData.toString()
    })
    .then(response => response.json())
    .then(data => {
      previewContent.textContent = '';
      if (data.error) {
        previewContent.appendChild(Object.assign(document.createElement('div'), {className: 'error', textContent: data.error}));
      } else {
        previewContent.innerHTML = data.html;
        previewContent.querySelectorAll('a').forEach(a => a.setAttribute('target', '_blank'));
        $script.ready('hljs', function() {
          previewContent.querySelectorAll('pre code').forEach(block => {
            hljs.highlightBlock(block);
          });
        });
      }
    })
    .catch((_error) => {
      previewContent.textContent = '';
      previewContent.appendChild(Object.assign(document.createElement('div'), {className: 'error', textContent: 'Не удалось выполнить запрос, попробуйте повторить еще раз.'}));
    });
  };

  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('.markup-tabs__tab');
    if (!tab || tab.classList.contains('active')) return;
    e.preventDefault();
    switchTab(tab.dataset.tab);
  });
}

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

    const commentFormContainer = commentForm.parent();
    const isInline = commentFormContainer.is(':hidden');

    const csrf = getCsrf();

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

          if (!commentForm[0].dataset.previewTabsInitialized) {
            initPreviewTabs(commentForm[0], true);
            commentForm[0].dataset.previewTabsInitialized = 'true';
          }

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
      if (!commentForm[0].dataset.previewTabsInitialized) {
        initPreviewTabs(commentForm[0], true);
        commentForm[0].dataset.previewTabsInitialized = 'true';
      }
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
      });
    } else {
      commentForm.on("reset", () => {
      });
    }

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
        commentForm.prepend(
          $('<div class="error" error>').text('Не удалось выполнить запрос, попробуйте повторить еще раз. ' + errorThrown)
        );
        resetCaptcha();
      }).done((data) => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          window._commentSubmitting = false;
          window.addEventListener('beforeunload', warnOnUnloadComment);
          if (data.errors) {
            const errorDiv = $('<div class="error" error>');
            data.errors.forEach((v) => {
              errorDiv.append($('<span>').text(v));
              errorDiv.append($('<br>'));
            });
            commentForm.prepend(errorDiv);
          }
          resetCaptcha();
        }
      });
    });
  });
});