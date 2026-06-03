(function () {
    var STORAGE_PREFIX = 'melkeMosquitoGift';
    var CLOSED_AT_KEY = STORAGE_PREFIX + 'ClosedAt';
    var FORM_SENT_KEY = 'melkeAnyFormSubmittedAt';
    var SESSION_SEEN_KEY = STORAGE_PREFIX + 'Seen';
    var SESSION_SOURCE_KEY = STORAGE_PREFIX + 'FormSource';
    var ACTIVE_DELAY = 23000;
    var CLOSE_TTL = 24 * 60 * 60 * 1000;
    var SCROLL_THRESHOLD = 0.45;
    var activeTime = 0;
    var lastActiveTick = null;
    var timerTriggered = false;
    var scrollTriggered = false;
    var pendingShow = false;
    var popup = null;
    var lastFocusedElement = null;

    function storageGet(storage, key) {
        try {
            return storage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function storageSet(storage, key, value) {
        try {
            storage.setItem(key, value);
        } catch (error) {}
    }

    function hasRecentClose() {
        var closedAt = Number(storageGet(localStorage, CLOSED_AT_KEY));
        return closedAt && Date.now() - closedAt < CLOSE_TTL;
    }

    function hasSubmittedForm() {
        return Boolean(storageGet(localStorage, FORM_SENT_KEY));
    }

    function wasSeenThisSession() {
        return Boolean(storageGet(sessionStorage, SESSION_SEEN_KEY));
    }

    function markClosed() {
        storageSet(localStorage, CLOSED_AT_KEY, String(Date.now()));
        storageSet(sessionStorage, SESSION_SEEN_KEY, '1');
    }

    function markFormSource() {
        storageSet(sessionStorage, SESSION_SOURCE_KEY, 'promo-popup');
    }

    function canShowPromo() {
        if (hasRecentClose() || hasSubmittedForm() || wasSeenThisSession()) {
            return false;
        }

        if (document.querySelector('.melke-modal.is-open, .melke-promo-popup.is-open')) {
            return false;
        }

        return !document.body.classList.contains('melke-lock');
    }

    function getBottomForm() {
        var section = document.getElementById('melke-installment') || document.querySelector('.melke-lead-form--installment');
        return section ? section.querySelector('.melke-lead-form__form') : null;
    }

    function showGiftForBottomForm() {
        var form = getBottomForm();
        if (!form) {
            return;
        }

        var submitButton = form.querySelector('.melke-lead-form__submit');
        if (!submitButton) {
            return;
        }

        var submitWrap = submitButton.closest('.melke-lead-form__submit-wrap');
        if (!submitWrap) {
            submitWrap = document.createElement('div');
            submitWrap.className = 'melke-lead-form__submit-wrap';
            submitButton.parentNode.insertBefore(submitWrap, submitButton);
            submitWrap.appendChild(submitButton);
        }

        var gift = submitWrap.querySelector('.melke-gift-offer');
        if (!gift) {
            gift = document.createElement('div');
            gift.className = 'melke-gift-offer';
            gift.setAttribute('aria-label', 'Подарок к заявке: москитная сетка');
            gift.innerHTML = '<img src="./assets/gift.png" alt="Москитная сетка в подарок">';
            submitWrap.insertBefore(gift, submitButton);
        }

        requestAnimationFrame(function () {
            gift.classList.add('is-visible');
        });
    }

    function scrollToBottomForm() {
        var target = document.getElementById('melke-installment') || getBottomForm();
        if (!target) {
            return;
        }

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closePromo(rememberClose) {
        if (!popup) {
            return;
        }

        popup.classList.remove('is-open');
        popup.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('melke-lock');

        if (rememberClose) {
            markClosed();
        }

        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    }

    function createPopup() {
        if (popup) {
            return popup;
        }

        popup = document.createElement('div');
        popup.className = 'melke-promo-popup';
        popup.setAttribute('aria-hidden', 'true');
        popup.innerHTML = [
            '<div class="melke-promo-popup__backdrop" data-promo-close></div>',
            '<div class="melke-promo-popup__dialog" role="dialog" aria-modal="true" aria-labelledby="melkePromoTitle">',
            '<button type="button" class="melke-promo-popup__close" aria-label="Закрыть" data-promo-close>×</button>',
            '<p class="melke-promo-popup__eyebrow">Акция</p>',
            '<h2 class="melke-promo-popup__title" id="melkePromoTitle">Москитная сетка в подарок!</h2>',
            '<p class="melke-promo-popup__text">Оставьте заявку и получите персональное предложение на окна Melke с подарком.</p>',
            '<button type="button" class="melke-btn melke-btn--filled melke-promo-popup__button">Получить предложение!</button>',
            '</div>'
        ].join('');
        document.body.appendChild(popup);

        popup.querySelectorAll('[data-promo-close]').forEach(function (closer) {
            closer.addEventListener('click', function () {
                closePromo(true);
            });
        });

        popup.querySelector('.melke-promo-popup__button').addEventListener('click', function () {
            markFormSource();
            showGiftForBottomForm();
            closePromo(true);
            scrollToBottomForm();
        });

        return popup;
    }

    function showPromo() {
        pendingShow = false;

        if (!canShowPromo()) {
            if (!hasRecentClose() && !hasSubmittedForm() && !wasSeenThisSession()) {
                pendingShow = true;
            }
            return;
        }

        createPopup();
        lastFocusedElement = document.activeElement;
        storageSet(sessionStorage, SESSION_SEEN_KEY, '1');
        popup.classList.add('is-open');
        popup.setAttribute('aria-hidden', 'false');
        document.body.classList.add('melke-lock');

        var actionButton = popup.querySelector('.melke-promo-popup__button');
        if (actionButton) {
            actionButton.focus();
        }
    }

    function requestPromoShow() {
        if (hasRecentClose() || hasSubmittedForm() || wasSeenThisSession()) {
            return;
        }
        pendingShow = true;
        showPromo();
    }

    function updateActiveTime() {
        if (timerTriggered || document.hidden) {
            lastActiveTick = null;
            return;
        }

        var now = Date.now();
        if (lastActiveTick !== null) {
            activeTime += now - lastActiveTick;
        }
        lastActiveTick = now;

        if (activeTime >= ACTIVE_DELAY) {
            timerTriggered = true;
            requestPromoShow();
        }
    }

    function checkScrollProgress() {
        if (scrollTriggered) {
            return;
        }

        var scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollableHeight <= 0) {
            return;
        }

        var progress = window.scrollY / scrollableHeight;
        if (progress >= SCROLL_THRESHOLD) {
            scrollTriggered = true;
            requestPromoShow();
        }
    }

    function retryPendingShow() {
        if (pendingShow) {
            showPromo();
        }
    }

    function rememberSuccessfulAjaxForms() {
        if (typeof window.fetch !== 'function') {
            return;
        }

        var originalFetch = window.fetch;
        window.fetch = function () {
            var requestUrl = arguments[0];
            var fetchResult = originalFetch.apply(this, arguments);

            return fetchResult.then(function (response) {
                var url = typeof requestUrl === 'string' ? requestUrl : requestUrl && requestUrl.url;
                var isLeadRequest = url && url.indexOf('send.php') !== -1;

                if (isLeadRequest) {
                    response.clone().json().then(function (data) {
                        if (data && data.success) {
                            storageSet(localStorage, FORM_SENT_KEY, String(Date.now()));
                            if (popup && popup.classList.contains('is-open')) {
                                closePromo(false);
                            }
                        }
                    }).catch(function () {});
                }

                return response;
            });
        };
    }

    rememberSuccessfulAjaxForms();

    if (storageGet(sessionStorage, SESSION_SOURCE_KEY) === 'promo-popup') {
        showGiftForBottomForm();
    }

    window.addEventListener('scroll', checkScrollProgress, { passive: true });
    window.addEventListener('scroll', retryPendingShow, { passive: true });
    window.addEventListener('focus', retryPendingShow);
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            lastActiveTick = null;
            return;
        }
        retryPendingShow();
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && popup && popup.classList.contains('is-open')) {
            closePromo(true);
        }
    });
    document.addEventListener('click', retryPendingShow);

    lastActiveTick = document.hidden ? null : Date.now();
    window.setInterval(function () {
        updateActiveTime();
        retryPendingShow();
    }, 1000);
})();
