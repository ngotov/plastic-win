(function () {
    'use strict';

    var ACTIVE_DELAY_MS = 23000;
    var SCROLL_TRIGGER_RATIO = 0.45;
    var HIDE_AFTER_CLOSE_MS = 24 * 60 * 60 * 1000;
    var CLOSE_STORAGE_KEY = 'giftOfferPopupClosedAt';
    var FORM_SENT_STORAGE_KEY = 'melkeLeadFormSubmitted';
    var SESSION_SHOWN_KEY = 'giftOfferPopupShown';
    var SESSION_CTA_KEY = 'giftOfferPopupCtaClicked';
    var GIFT_IMAGE_SRC = './assets/gift.png';

    var activeTimeMs = 0;
    var lastActiveTick = null;
    var timer = null;
    var triggerReached = false;
    var popupOpen = false;
    var giftShown = false;
    var giftEl = null;
    var giftRevealTimer = null;
    var scrollCheckTimer = null;
    var mediaQuery = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;

    function safeGet(storage, key) {
        try {
            return storage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function safeSet(storage, key, value) {
        try {
            storage.setItem(key, value);
        } catch (error) {
            // Storage may be unavailable in private mode; popup logic should keep working for this page view.
        }
    }

    function isElementVisible(element) {
        if (!element || element.classList.contains('gift-offer-popup') || element.closest('.gift-offer-popup')) {
            return false;
        }

        var style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }

        var rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function isOtherPopupOpen() {
        if (document.body.classList.contains('melke-lock') && !popupOpen) {
            return true;
        }

        var candidates = document.querySelectorAll([
            '.melke-modal.is-open',
            '.modal.is-open',
            '.modal.show',
            '.popup.is-open',
            '.popup.show',
            '[role="dialog"][aria-hidden="false"]',
            '[aria-modal="true"]'
        ].join(','));

        return Array.prototype.some.call(candidates, isElementVisible);
    }

    function hasRecentClose() {
        var closedAt = Number(safeGet(window.localStorage, CLOSE_STORAGE_KEY));
        return closedAt && Date.now() - closedAt < HIDE_AFTER_CLOSE_MS;
    }

    function hasSubmittedForm() {
        return safeGet(window.localStorage, FORM_SENT_STORAGE_KEY) === 'true';
    }

    function isBlockedPermanentlyForSession() {
        return safeGet(window.sessionStorage, SESSION_SHOWN_KEY) === 'true' ||
            safeGet(window.sessionStorage, SESSION_CTA_KEY) === 'true';
    }

    function canShowPopup() {
        return !popupOpen &&
            !hasRecentClose() &&
            !hasSubmittedForm() &&
            !isBlockedPermanentlyForSession() &&
            !isOtherPopupOpen();
    }

    function stopTriggers() {
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
        window.removeEventListener('scroll', handleScrollTrigger);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    function requestShowPopup() {
        if (triggerReached || hasRecentClose() || hasSubmittedForm() || isBlockedPermanentlyForSession()) {
            return;
        }

        triggerReached = true;
        stopTriggers();
        tryShowPopup();
    }

    function tryShowPopup() {
        if (!triggerReached || hasRecentClose() || hasSubmittedForm() || isBlockedPermanentlyForSession()) {
            return;
        }

        if (canShowPopup()) {
            showPopup();
            return;
        }

        window.setTimeout(tryShowPopup, 800);
    }

    function getPopup() {
        var popup = document.querySelector('.gift-offer-popup');
        if (popup) {
            return popup;
        }

        popup = document.createElement('div');
        popup.className = 'gift-offer-popup';
        popup.setAttribute('aria-hidden', 'true');
        popup.innerHTML = '' +
            '<div class="gift-offer-popup__backdrop" data-gift-offer-close></div>' +
            '<div class="gift-offer-popup__dialog" role="dialog" aria-modal="true" aria-labelledby="giftOfferPopupTitle">' +
                '<button class="gift-offer-popup__close" type="button" aria-label="Закрыть" data-gift-offer-close>×</button>' +
                '<p class="gift-offer-popup__eyebrow">Акция для посетителей сайта</p>' +
                '<h2 class="gift-offer-popup__title" id="giftOfferPopupTitle">Москитная сетка в подарок!</h2>' +
                '<p class="gift-offer-popup__text">Оставьте заявку на окна Melke и получите индивидуальное предложение с подарком к заказу.</p>' +
                '<button class="gift-offer-popup__button" type="button" data-gift-offer-action>Получить предложение!</button>' +
            '</div>';

        document.body.appendChild(popup);

        popup.querySelectorAll('[data-gift-offer-close]').forEach(function (closer) {
            closer.addEventListener('click', function () {
                closePopup(true);
            });
        });

        var action = popup.querySelector('[data-gift-offer-action]');
        if (action) {
            action.addEventListener('click', handleOfferClick);
        }

        return popup;
    }

    function showPopup() {
        var popup = getPopup();
        popupOpen = true;
        safeSet(window.sessionStorage, SESSION_SHOWN_KEY, 'true');
        popup.classList.add('is-open');
        popup.setAttribute('aria-hidden', 'false');
        document.body.classList.add('melke-lock');

        var action = popup.querySelector('[data-gift-offer-action]');
        if (action) {
            window.setTimeout(function () {
                action.focus();
            }, 80);
        }
    }

    function closePopup(saveCloseTime) {
        var popup = document.querySelector('.gift-offer-popup');
        if (!popup || !popupOpen) {
            return;
        }

        popupOpen = false;
        popup.classList.remove('is-open');
        popup.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('melke-lock');

        if (saveCloseTime) {
            safeSet(window.localStorage, CLOSE_STORAGE_KEY, String(Date.now()));
        }
    }

    function getBottomLeadForm() {
        var forms = Array.prototype.filter.call(document.querySelectorAll('.melke-lead-form__form'), function (form) {
            return !form.closest('.melke-modal');
        });

        return forms.length ? forms[forms.length - 1] : null;
    }

    function getHeaderOffset() {
        var header = document.querySelector('.melke-header');
        if (!header) {
            return 16;
        }

        return Math.ceil(header.getBoundingClientRect().height) + 16;
    }

    function scrollToBottomForm(form) {
        var target = form.closest('.melke-lead-form') || form;
        var top = window.pageYOffset + target.getBoundingClientRect().top - getHeaderOffset();
        window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        waitForScrollToForm(target, function () {
            giftRevealTimer = window.setTimeout(function () {
                showGiftInForm(form);
            }, 350);
        });
    }

    function waitForScrollToForm(target, callback) {
        var startedAt = Date.now();
        var maxWait = 1800;

        if (scrollCheckTimer) {
            window.clearInterval(scrollCheckTimer);
        }

        scrollCheckTimer = window.setInterval(function () {
            var rect = target.getBoundingClientRect();
            var visible = rect.top < window.innerHeight * 0.68 && rect.bottom > getHeaderOffset();
            if (visible || Date.now() - startedAt > maxWait) {
                window.clearInterval(scrollCheckTimer);
                scrollCheckTimer = null;
                callback();
            }
        }, 100);
    }

    function ensureGiftElement() {
        if (giftEl) {
            return giftEl;
        }

        giftEl = document.createElement('div');
        giftEl.className = 'gift-offer-gift';
        giftEl.setAttribute('aria-label', 'Подарок к заявке');
        giftEl.innerHTML = '<img src="' + GIFT_IMAGE_SRC + '" alt="Москитная сетка в подарок" loading="lazy">';
        return giftEl;
    }

    function placeGift(form) {
        var gift = ensureGiftElement();
        var submitButton = form.querySelector('.melke-lead-form__submit, button[type="submit"], input[type="submit"]');
        var consentBlock = form.querySelector('[data-consent-block]');
        var nameInput = form.querySelector('#leadNameBottom, input[name="name"], input[placeholder*="имя" i]');
        var nameRow = nameInput ? nameInput.closest('.melke-lead-form__row') || nameInput : null;
        var isMobile = mediaQuery ? mediaQuery.matches : window.innerWidth <= 767;

        if (consentBlock) {
            form.insertBefore(gift, consentBlock);
        } else if (isMobile && submitButton) {
            form.insertBefore(gift, submitButton);
        } else if (nameRow) {
            form.insertBefore(gift, nameRow);
        } else if (submitButton) {
            form.insertBefore(gift, submitButton);
        } else {
            form.insertBefore(gift, form.firstChild);
        }
    }

    function showGiftInForm(form) {
        if (!form || giftShown) {
            return;
        }

        giftShown = true;
        placeGift(form);
        window.requestAnimationFrame(function () {
            ensureGiftElement().classList.add('is-visible');
        });
    }

    function handleOfferClick() {
        safeSet(window.sessionStorage, SESSION_CTA_KEY, 'true');
        closePopup(true);

        var form = getBottomLeadForm();
        if (!form) {
            return;
        }

        scrollToBottomForm(form);
    }

    function handleEsc(event) {
        if (event.key === 'Escape' && popupOpen) {
            closePopup(true);
        }
    }

    function handleResize() {
        if (giftShown) {
            var form = getBottomLeadForm();
            if (form) {
                placeGift(form);
            }
        }
    }

    function handleVisibilityChange() {
        lastActiveTick = document.visibilityState === 'visible' ? Date.now() : null;
    }

    function handleActiveTimer() {
        if (triggerReached || document.visibilityState !== 'visible') {
            lastActiveTick = null;
            return;
        }

        var now = Date.now();
        if (lastActiveTick) {
            activeTimeMs += now - lastActiveTick;
        }
        lastActiveTick = now;

        if (activeTimeMs >= ACTIVE_DELAY_MS) {
            requestShowPopup();
        }
    }

    function handleScrollTrigger() {
        if (triggerReached) {
            return;
        }

        var doc = document.documentElement;
        var scrollable = doc.scrollHeight - window.innerHeight;
        if (scrollable <= 0) {
            return;
        }

        var ratio = (window.pageYOffset || doc.scrollTop || 0) / scrollable;
        if (ratio >= SCROLL_TRIGGER_RATIO) {
            requestShowPopup();
        }
    }

    function patchFetchForFormSuccess() {
        if (!window.fetch || window.fetch.__giftOfferPatched) {
            return;
        }

        var nativeFetch = window.fetch;
        window.fetch = function () {
            var fetchArgs = arguments;
            return nativeFetch.apply(this, fetchArgs).then(function (response) {
                var requestUrl = typeof fetchArgs[0] === 'string' ? fetchArgs[0] : (fetchArgs[0] && fetchArgs[0].url) || '';
                var isLeadRequest = requestUrl.indexOf('send.php') !== -1;

                if (isLeadRequest) {
                    response.clone().json().then(function (data) {
                        if (data && data.success) {
                            safeSet(window.localStorage, FORM_SENT_STORAGE_KEY, 'true');
                            if (popupOpen) {
                                closePopup(false);
                            }
                        }
                    }).catch(function () {
                        // Non-JSON responses are ignored so the existing form handler remains responsible for errors.
                    });
                }

                return response;
            });
        };
        window.fetch.__giftOfferPatched = true;
    }

    function init() {
        patchFetchForFormSuccess();

        if (hasRecentClose() || hasSubmittedForm() || isBlockedPermanentlyForSession()) {
            return;
        }

        document.addEventListener('keydown', handleEsc);
        window.addEventListener('resize', handleResize);
        if (mediaQuery && mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleResize);
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('scroll', handleScrollTrigger, { passive: true });
        lastActiveTick = document.visibilityState === 'visible' ? Date.now() : null;
        timer = window.setInterval(handleActiveTimer, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
