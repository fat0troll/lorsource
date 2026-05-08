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

$(document).ready(function () {
  function initNotificationsOpener() {
    $('button.notifications-item').on('click', function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        $(this).parent().attr('target', '_blank');
      } else {
        $(this).parent().removeAttr('target');
      }

      $(this).removeClass("event-unread-true").addClass("event-unread-false");
    });
    $('button.notifications-item').on('auxclick', function (event) {
      $(this).removeClass("event-unread-true").addClass("event-unread-false");
      $(this).parent().attr('target', '_blank');
      $(this).parent().trigger('submit');
    });
  }

  initNotificationsOpener();
});